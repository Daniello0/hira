#!/usr/bin/env python3
"""
CPU inference benchmark for JobFinder AI v2 (Q28).

Measures bi-encoder and cross-encoder latency on the local machine using
PyTorch CPU (same model weights as planned TEI stack; INT8 ONNX may be ~1.5–2× faster).

Usage:
    python3 benchmark.py

Output:
    benchmark-results.txt (same directory)
"""

from __future__ import annotations

import gc
import os
import platform
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, stdev
from typing import Callable

import psutil
import torch
import torch.nn.functional as F
from sentence_transformers import CrossEncoder, SentenceTransformer
from transformers import AutoModel, AutoTokenizer

FEATURE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = FEATURE_DIR / "benchmark-results.txt"

# Planned production models (Wiki ADR-003, ADR-009)
ENCODER_MODEL = "BAAI/bge-m3"
RERANKER_LIGHT = "BAAI/bge-reranker-base"  # ~278M, fallback in ADR
RERANKER_HEAVY = "BAAI/bge-reranker-v2-m3"  # ~568M, rejected for CPU prod
BASELINE_ENCODER = "paraphrase-multilingual-MiniLM-L12-v2"  # 2026 coursework

WARMUP_RUNS = 2
QUERY_ITERS = 8
DOC_ITERS = 5
RERANK_PAIR_ITERS = 3

SAMPLE_QUERY = (
    "Junior Python developer remote Minsk FastAPI PostgreSQL Docker internship"
)
SAMPLE_QUERY_RU = (
    "Джунior Python разработчик удалёнка Минск FastAPI PostgreSQL стажировка"
)

DOC_256 = (
    "Junior Python Developer — EPAM Systems, Minsk / Remote. "
    "Requirements: Python 3.10+, FastAPI, PostgreSQL, Docker, Git, REST API, "
    "basic SQL, Linux. Nice to have: Kubernetes, CI/CD, pytest. "
    "We offer mentorship, hybrid format, English B1+. "
    "Salary: 1500–2200 BYN. Full-time, no experience required for graduates."
)

DOC_512 = (
    DOC_256
    + " "
    + (
        "Responsibilities: develop microservices, write unit tests, participate in code review, "
        "work with product owner, deploy to staging, monitor logs, fix bugs in legacy modules, "
        "document APIs in Swagger, integrate with external HR systems, optimize SQL queries, "
        "participate in agile ceremonies. Stack also includes Redis, RabbitMQ, TypeScript frontend "
        "collaboration, Jira, Confluence. Company provides courses, certification budget, "
        "modern MacBook or Linux laptop, flexible start time, medical insurance after probation."
    )
)


@dataclass
class TimingStats:
    label: str
    samples_ms: list[float]

    @property
    def mean_ms(self) -> float:
        return mean(self.samples_ms)

    @property
    def median_ms(self) -> float:
        return median(self.samples_ms)

    @property
    def stdev_ms(self) -> float:
        return stdev(self.samples_ms) if len(self.samples_ms) > 1 else 0.0

    @property
    def p95_ms(self) -> float:
        sorted_vals = sorted(self.samples_ms)
        idx = min(int(len(sorted_vals) * 0.95), len(sorted_vals) - 1)
        return sorted_vals[idx]

    def line(self) -> str:
        return (
            f"{self.label}: "
            f"mean={self.mean_ms:.1f}ms median={self.median_ms:.1f}ms "
            f"p95={self.p95_ms:.1f}ms stdev={self.stdev_ms:.1f}ms "
            f"(n={len(self.samples_ms)})"
        )


def log(lines: list[str], text: str) -> None:
    lines.append(text)
    print(text)


def rss_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


class BgeM3Encoder:
    """BGE-M3 via transformers + safetensors (works when torch<2.6 blocks torch.load)."""

    def __init__(self, model_id: str) -> None:
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id, use_safetensors=True)
        self.model.eval()
        self.model.to("cpu")

    @staticmethod
    def _mean_pooling(model_output: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        mask = attention_mask.unsqueeze(-1).expand(model_output.size()).float()
        summed = torch.sum(model_output * mask, dim=1)
        counts = torch.clamp(mask.sum(dim=1), min=1e-9)
        return summed / counts

    def encode(
        self,
        sentences: str | list[str],
        batch_size: int = 8,
        normalize_embeddings: bool = True,
        show_progress_bar: bool = False,  # noqa: ARG002 — API parity with SentenceTransformer
        max_length: int = 512,
    ) -> torch.Tensor:
        if isinstance(sentences, str):
            sentences = [sentences]
        all_embeddings: list[torch.Tensor] = []
        for start in range(0, len(sentences), batch_size):
            batch = sentences[start : start + batch_size]
            encoded = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            with torch.no_grad():
                outputs = self.model(**encoded)
                pooled = self._mean_pooling(outputs.last_hidden_state, encoded["attention_mask"])
                if normalize_embeddings:
                    pooled = F.normalize(pooled, p=2, dim=1)
            all_embeddings.append(pooled)
        return torch.cat(all_embeddings, dim=0)


def load_encoder(model_id: str) -> SentenceTransformer | BgeM3Encoder:
    if model_id == ENCODER_MODEL:
        try:
            return SentenceTransformer(model_id, device="cpu")
        except Exception:
            return BgeM3Encoder(model_id)
    return SentenceTransformer(model_id, device="cpu")


def run_timed(fn: Callable[[], None], iterations: int, warmup: int) -> list[float]:
    for _ in range(warmup):
        fn()
    samples: list[float] = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - t0) * 1000)
    return samples


def collect_system_info(lines: list[str]) -> None:
    log(lines, "=" * 72)
    log(lines, "JobFinder AI v2 — CPU Neural Inference Benchmark (Q28)")
    log(lines, f"Timestamp (UTC): {datetime.now(timezone.utc).isoformat()}")
    log(lines, "=" * 72)
    log(lines, "")
    log(lines, "[SYSTEM]")
    log(lines, f"  platform     : {platform.platform()}")
    log(lines, f"  machine      : {platform.machine()}")
    log(lines, f"  processor    : {platform.processor()}")
    log(lines, f"  python       : {sys.version.split()[0]}")
    log(lines, f"  torch        : {torch.__version__}")
    log(lines, f"  torch threads: {torch.get_num_threads()}")
    log(lines, f"  cuda avail   : {torch.cuda.is_available()}")
    mps = getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()
    log(lines, f"  mps avail    : {mps} (benchmark forces CPU regardless)")
    log(lines, f"  ram total GB : {psutil.virtual_memory().total / (1024**3):.1f}")

    try:
        brand = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
        log(lines, f"  cpu brand    : {brand}")
    except (OSError, subprocess.CalledProcessError):
        pass

    try:
        cores = subprocess.check_output(["sysctl", "-n", "hw.logicalcpu"], text=True).strip()
        log(lines, f"  logical cpus : {cores}")
    except (OSError, subprocess.CalledProcessError):
        pass

    log(lines, "")
    log(lines, "[NOTE] PyTorch FP32 CPU run. Production TEI uses ONNX INT8 — expect ~1.5–2× speedup.")
    log(lines, "")


def benchmark_encoder(
    lines: list[str],
    model_id: str,
    label: str,
    use_bge_instructions: bool,
) -> SentenceTransformer | None:
    log(lines, f"[ENCODER] {label} ({model_id})")
    mem_before = rss_mb()
    t_load = time.perf_counter()
    try:
        model = load_encoder(model_id)
        backend = "transformers+safetensors" if isinstance(model, BgeM3Encoder) else "sentence-transformers"
        log(lines, f"  backend      : {backend}")
    except Exception as exc:  # noqa: BLE001 — benchmark should continue on model load failure
        log(lines, f"  LOAD FAILED: {exc}")
        log(lines, "")
        return None

    load_ms = (time.perf_counter() - t_load) * 1000
    log(lines, f"  load time    : {load_ms:.0f} ms")
    log(lines, f"  rss after load: {rss_mb():.0f} MB (delta +{rss_mb() - mem_before:.0f} MB)")

    def encode_query() -> None:
        text = SAMPLE_QUERY_RU if "MiniLM" not in model_id else SAMPLE_QUERY_RU
        if use_bge_instructions:
            model.encode(
                f"Represent this sentence for searching relevant passages: {text}",
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        else:
            model.encode(text, normalize_embeddings=True, show_progress_bar=False)

    def encode_doc_256() -> None:
        if use_bge_instructions:
            model.encode(DOC_256, normalize_embeddings=True, show_progress_bar=False)
        else:
            model.encode(DOC_256, normalize_embeddings=True, show_progress_bar=False)

    def encode_doc_512() -> None:
        if use_bge_instructions:
            model.encode(DOC_512, normalize_embeddings=True, show_progress_bar=False)
        else:
            model.encode(DOC_512, normalize_embeddings=True, show_progress_bar=False)

    q_stats = TimingStats("query ~32 tok", run_timed(encode_query, QUERY_ITERS, WARMUP_RUNS))
    d256_stats = TimingStats("doc ~256 tok", run_timed(encode_doc_256, DOC_ITERS, WARMUP_RUNS))
    d512_stats = TimingStats("doc ~512 tok", run_timed(encode_doc_512, DOC_ITERS, WARMUP_RUNS))

    for stat in (q_stats, d256_stats, d512_stats):
        log(lines, f"  {stat.line()}")

    # Batch throughput (indexing simulation)
    docs = [DOC_512] * 32
    batch_sizes = [1, 4, 8, 16]
    log(lines, "  batch throughput (32 docs, ~512 tok each):")
    best_docs_per_sec = 0.0
    best_bs = batch_sizes[0]
    for bs in batch_sizes:
        t0 = time.perf_counter()
        model.encode(docs, batch_size=bs, normalize_embeddings=True, show_progress_bar=False)
        elapsed = time.perf_counter() - t0
        docs_per_sec = 32 / elapsed
        if docs_per_sec > best_docs_per_sec:
            best_docs_per_sec = docs_per_sec
            best_bs = bs
        log(lines, f"    batch_size={bs:2d} -> {docs_per_sec:.2f} docs/s ({elapsed * 1000:.0f} ms total)")

    total_embeddings = 15_000 * 4
    index_hours = total_embeddings / best_docs_per_sec / 3600
    log(
        lines,
        f"  index estimate : {total_embeddings} embeddings @ {best_docs_per_sec:.2f} docs/s "
        f"(best batch={best_bs}) -> {index_hours:.2f} h",
    )

    log(lines, "")
    return model


def benchmark_reranker(
    lines: list[str],
    model_id: str,
    label: str,
    top_k: int,
    doc_chars: int,
    pair_iters: int,
) -> None:
    log(lines, f"[RERANKER] {label} ({model_id}) top-{top_k}, doc~{doc_chars} chars")
    mem_before = rss_mb()
    t_load = time.perf_counter()
    try:
        model = CrossEncoder(model_id, device="cpu")
    except Exception as exc:  # noqa: BLE001
        log(lines, f"  LOAD FAILED: {exc}")
        log(lines, "")
        return

    load_ms = (time.perf_counter() - t_load) * 1000
    log(lines, f"  load time    : {load_ms:.0f} ms")
    log(lines, f"  rss after load: {rss_mb():.0f} MB (delta +{rss_mb() - mem_before:.0f} MB)")

    doc = DOC_256 if doc_chars <= 300 else DOC_512
    pairs = [(SAMPLE_QUERY_RU, doc)] * top_k

    def rerank_batch() -> None:
        model.predict(pairs, show_progress_bar=False)

    samples = run_timed(rerank_batch, pair_iters, WARMUP_RUNS)
    batch_stats = TimingStats(f"top-{top_k} pairs", samples)
    log(lines, f"  {batch_stats.line()}")
    per_pair_ms = batch_stats.mean_ms / top_k
    log(lines, f"  per pair (approx): {per_pair_ms:.1f} ms")

    log(lines, "")

    del model
    gc.collect()


def simulate_search_pipeline(lines: list[str], encoder_q_ms: float, rerank_top20_ms: float) -> None:
    log(lines, "[PIPELINE SIMULATION] Planned hybrid search (no LLM, no Postgres)")
    log(lines, "  Assumptions from Wiki:")
    log(lines, "    - 3 parallel branches (BM25 + dense + graph): 200-400 ms SQL (use 300 ms)")
    log(lines, "    - RRF + filters + explain: 50 ms")
    log(lines, "    - 1x query encode (dense branch)")
    log(lines, "")

    bm25_graph_ms = 300
    fusion_ms = 50
    no_rerank = encoder_q_ms + bm25_graph_ms + fusion_ms
    with_rerank = no_rerank + rerank_top20_ms
    target_p95 = 2500

    log(lines, f"  dense query encode     : {encoder_q_ms:.0f} ms (measured BGE-M3 mean)")
    log(lines, f"  lexical + graph (est.) : {bm25_graph_ms} ms")
    log(lines, f"  fusion + explain (est.): {fusion_ms} ms")
    log(lines, f"  rerank top-20 (meas.)  : {rerank_top20_ms:.0f} ms")
    log(lines, "")
    log(lines, f"  TOTAL without rerank   : {no_rerank:.0f} ms")
    log(lines, f"  TOTAL with rerank      : {with_rerank:.0f} ms")
    log(lines, f"  Wiki target p95        : {target_p95} ms")
    log(lines, f"  headroom with rerank   : {target_p95 - with_rerank:.0f} ms")
    log(lines, "")


def main() -> None:
    lines: list[str] = []
    collect_system_info(lines)

    bge_q_mean = 0.0
    rerank20_mean = 0.0

    enc = benchmark_encoder(lines, ENCODER_MODEL, "BGE-M3 (production)", use_bge_instructions=True)
    if enc is not None:
        # Re-run single query measure for pipeline (already in logs; quick re-sample)
        samples = run_timed(
            lambda: enc.encode(
                f"Represent this sentence for searching relevant passages: {SAMPLE_QUERY_RU}",
                normalize_embeddings=True,
                show_progress_bar=False,
            ),
            5,
            1,
        )
        bge_q_mean = mean(samples)
        del enc
        gc.collect()

    benchmark_encoder(lines, BASELINE_ENCODER, "MiniLM-L12-v2 (2026 baseline)", use_bge_instructions=False)

    log(lines, "[RERANKER COMPARISON]")
    pairs20 = [(SAMPLE_QUERY_RU, DOC_256)] * 20
    try:
        rerank_light = CrossEncoder(RERANKER_LIGHT, device="cpu")
        samples20 = run_timed(
            lambda: rerank_light.predict(pairs20, show_progress_bar=False),
            RERANK_PAIR_ITERS,
            WARMUP_RUNS,
        )
        rerank20_mean = mean(samples20)
        log(lines, TimingStats(f"{RERANKER_LIGHT} top-20 @256tok", samples20).line())
        del rerank_light
        gc.collect()
    except Exception as exc:  # noqa: BLE001
        log(lines, f"  {RERANKER_LIGHT} FAILED: {exc}")

    benchmark_reranker(lines, RERANKER_HEAVY, "bge-reranker-v2-m3 (568M)", 20, 256, RERANK_PAIR_ITERS)
    benchmark_reranker(lines, RERANKER_HEAVY, "bge-reranker-v2-m3 (568M)", 50, 512, 2)

    if bge_q_mean > 0 and rerank20_mean > 0:
        simulate_search_pipeline(lines, bge_q_mean, rerank20_mean)

    log(lines, "[END]")
    OUTPUT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nResults written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
