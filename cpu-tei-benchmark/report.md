 # CPU Benchmark Report (Q28)

> **Краткая выжимка по результатам** [`benchmark-results.txt`](benchmark-results.txt)  
> Дата: 2026-09-20 · Машина: MacBook Pro 15" 2019, **Intel i9-9880H**, 32 GB RAM, **без CUDA**

---

## 1. Что измеряли

Скрипт [`benchmark.py`](benchmark.py) прогнал на **CPU (PyTorch FP32)** те же классы моделей, что заложены в Wiki:

| Компонент | Модель | Роль |
|---|---|---|
| Encoder (prod) | `BAAI/bge-m3` | dense-ветвь, 1024d |
| Encoder (baseline) | `paraphrase-multilingual-MiniLM-L12-v2` | курсовая 2026 |
| Reranker (prod) | `BAAI/bge-reranker-base` (~278M) | cross-encoder top-20 |
| Reranker (reject) | `BAAI/bge-reranker-v2-m3` (~568M) | слишком тяжёлый для CPU |

**Важно:** продакшн-план — **HF TEI + ONNX INT8**. Этот прогон — **FP32 PyTorch**, поэтому числа **хуже**, чем будет в TEI (ожидаемо **~1.5–2×** ускорение).

---

## 2. Ключевые цифры (факт)

### BGE-M3 (production encoder)

| Операция | Измерено | Оценка в Wiki |
|---|---|---|
| Query ~32 tok | **117 ms** (mean) | 50–100 ms |
| Doc ~512 tok | **670 ms** | 60–120 ms* |
| Batch index (512 tok, batch=16) | **1.5 docs/s** | 8–15 docs/s |
| Полная переиндексация 60k emb. | **~11.2 ч** | ~1.7 ч |

\*В Wiki 60–120 ms — для **оптимизированного TEI/ONNX**, не для сырого transformers FP32.

### MiniLM (baseline 2026)

| Операция | Измерено |
|---|---|
| Query | **23 ms** |
| Batch index | **27 docs/s** |
| 60k embeddings | **~0.6 ч** |

**Вывод:** BGE-M3 **~18× медленнее** MiniLM на индексации в этом прогоне. Качество выше, но цена по CPU — реальная.

### Reranker

| Конфигурация | Измерено | Wiki (INT8 278M) |
|---|---|---|
| `bge-reranker-base` top-20 @256 tok | **1958 ms** (~98 ms/пара) | ~500 ms total |
| `bge-reranker-v2-m3` top-20 @256 tok | **6501 ms** | ~2000 ms |
| `bge-reranker-v2-m3` top-50 @512 tok | **37.4 s** | ~5 s |

**Вывод:** тяжёлый reranker **v2-m3 на CPU неприемлем**. Даже лёгкий base в FP32 **в 4× медленнее** Wiki-оценки для INT8.

### Симulated pipeline (без LLM, без Postgres)

| Сценарий | Latency |
|---|---|
| Без rerank (encode + SQL + fusion) | **510 ms** |
| С rerank top-20 (измеренный) | **2468 ms** |
| Wiki target p95 | **2500 ms** |
| Запас | **32 ms** |

Пайплайн **формально влезает** в 2500 ms, но **без запаса** — любой всплеск (холодный старт, GC, параллельная нагрузка) вылезет за бюджет.

---

## 3. Estimated time — сервисы, модули, фичи

Легенда колонок:

| Колонка | Смысл |
|---|---|
| **FP32** | Измерено в этом бенчмарке или прямо следует из него |
| **INT8 (TEI)** | Прогноз для prod (`×1.7` к FP32 там, где применимо) |
| **Оценка** | Не замерялось; порядок величины из Wiki / типичного поведения стека |

`*` — параллельно с другими шагами (не суммируется в wall-clock).  
`—` — не применимо / мгновенно.

### 3.1 Инфраструктура: cold start и загрузка

| Компонент | Сценарий | FP32 | INT8 (TEI) | Оценка | Комментарий |
|---|---|---:|---:|---:|---|
| **Docker Compose** | Первый `docker compose up` (pull образов) | — | — | **5–20 мин** | TEI + Postgres + Redis + 5 сервисов; зависит от сети |
| **Docker Compose** | Повторный старт (образы есть) | — | — | **30–90 с** | Postgres init + health ready |
| **PostgreSQL** | Старт + migrations (пустая БД) | — | — | **10–30 с** | + дольше, если HNSW/BM25 на большом корпусе |
| **Redis** | Старт | — | — | **1–3 с** | |
| **embedding-runtime (TEI)** | Cold start, загрузка BGE-M3 в RAM | **~11 с**† | **~15–30 с** | **~20–60 с** | †transformers load; TEI + ONNX — отдельный pull весов |
| **embedding-runtime (TEI)** | Cold start, reranker 278M | **~2.5 с** | **~5–10 с** | **~10–20 с** | В TEI может быть второй процесс/модель |
| **embedding-runtime (TEI)** | Первый скачивание весов BGE-M3 | — | — | **5–15 мин** | ~2 GB, один раз |
| **llm-service** | Старт процесса (без LLM) | — | — | **2–5 с** | Express + конфиг |
| **core-api** | Старт + TypeORM connect | — | — | **5–15 с** | |
| **ingestion-service** | Старт + BullMQ connect | — | — | **3–8 с** | |
| **web (Next.js)** | `next dev` первый compile | — | — | **15–45 с** | Prod build дольше |
| **web (Next.js)** | `next start` (prod) | — | — | **2–5 с** | |
| **HF cache** | Повторный запуск benchmark.py | — | — | **~6 мин** | Модели уже локально |
| **HF cache** | Первый запуск benchmark.py | — | — | **~15–25 мин** | Скачивание 3–4 моделей |

**Ожидание «всё поднялось» (dev, повторно):** ~**1–2 мин** после образов.  
**Ожидание «всё с нуля на новой машине»:** ~**20–40 мин** (pull + weights + migrations).

---

### 3.2 Микросервисы — runtime на один запрос

| Сервис | Операция | FP32 | INT8 (TEI) | Оценка | Комментарий |
|---|---|---:|---:|---:|---|
| **core-api** | Auth login (argon2id) | — | — | **200–400 ms** | Намеренно медленный hash |
| **core-api** | JWT validate + load user | — | — | **5–15 ms** | |
| **core-api** | Orchestration overhead (SSE hub) | — | — | **20–50 ms** | Без downstream |
| **core-api** | Rate-limit check (Redis) | — | — | **1–3 ms** | |
| **llm-service** | `/understand` (OpenRouter, cache miss) | — | — | **800–2500 ms** | Зависит от модели; json_schema медленнее |
| **llm-service** | `/understand` (cache hit, Redis) | — | — | **5–20 ms** | |
| **llm-service** | `/generate` TTFT | — | — | **500–2000 ms** | До первого SSE `token` |
| **llm-service** | `/generate` полный ответ (~150 tok) | — | — | **2–6 s** | Стриминг; пользователь видит раньше |
| **llm-service** | `/summarize-chat` | — | — | **1–4 s** | Фоново, не блокирует ответ |
| **llm-service** | `/extract-memory` | — | — | **1–3 s** | Async fire-and-forget |
| **llm-service** | `/extract-skills` 1 вакансия | — | — | **1–3 s** | Ingestion batch |
| **llm-service** | `/parse-resume` | — | — | **2–5 s** | После локального PDF parse |
| **retrieval-service** | HTTP + JSON parse | — | — | **5–15 ms** | |
| **retrieval-service** | **Полный `/search`** (с rerank) | **2468 ms** | **~1660 ms** | **≤2500 ms** target | См. §2; без LLM |
| **retrieval-service** | **Полный `/search`** (rerank off) | **510 ms** | **~300 ms** | **≤900 ms** target | Деградация |
| **ingestion-service** | 1 вакансия end-to-end (API source) | — | — | **0.5–2 s** | Без LLM skills |
| **ingestion-service** | 1 вакансия + extract-skills | — | — | **2–5 s** | |
| **web** | SSE render `results` → карточки | — | — | **50–150 ms** | После получения event |

---

### 3.3 retrieval-service — модули поиска (один запрос)

Ветви **BM25 + dense + graph** идут **параллельно** → wall-clock ≈ `max(ветви)`, не сумма.

| Модуль | Операция | FP32 | INT8 (TEI) | Оценка | Комментарий |
|---|---|---:|---:|---:|---|
| **lexical (BM25)** | `pg_textsearch` top-100 | — | — | **50–150 ms** | Зависит от корпуса; без нейросети |
| **dense** | TEI `/embed` query ~32 tok | **117 ms** | **~65 ms** | | Внутри critical path |
| **dense** | pgvector HNSW top-100 | — | — | **80–250 ms** | 15k–50k вакансий, CPU |
| **graph (S1c)** | Link skills + recursive CTE | — | — | **30–120 ms** | ≤2 hop, ≤200 nodes |
| **parallel branches** | `max(BM25, dense, graph)` | — | — | **150–350 ms** | Wiki: 200–400 ms |
| **fusion (RRF)** | Merge 3 lists | — | — | **5–15 ms** | In-memory |
| **filters** | Hard constraints + SQL | — | — | **20–80 ms** | Может overlap с HNSW |
| **relaxation** | Soft constraint drops (0–3 шага) | — | — | **+0–150 ms** | Если пул мал |
| **rerank** | cross-encoder top-20 @256 tok | **1958 ms** | **~1150 ms** | | **Главный bottleneck** |
| **explain** | Deterministic factor breakdown | — | — | **10–40 ms** | Код, не LLM |
| **personalize** | Profile overlap adjust | — | — | **5–20 ms** | ±15% score |

**Сумма critical path (с rerank):** encode query → parallel SQL → RRF → rerank → explain ≈ **117 + 300 + 50 + 1958 + 30 ≈ 2460 ms** (сходится с замером).

---

### 3.4 LLM — задачи и ожидание

| Задача | Когда вызывается | Cache | Оценка latency | Пользователь ждёт? |
|---|---|---|---:|---|
| `understand` | Каждое сообщение в чате | Redis, disk (eval) | **0.8–2.5 s** | Да* — event `intent` |
| `generate` | После search | — | TTFT **0.5–2 s**, full **2–6 s** | Да — стриминг текста |
| `title-chat` | Первое сообщение чата | — | **0.5–1.5 s** | Нет — фон |
| `summarize-chat` | Каждые ~8 сообщений | — | **1–4 s** | Нет — фон |
| `extract-memory` | После каждого turn | — | **1–3 s** | Нет — async |
| `extract-skills` | Ingestion | `content_hash` | **1–3 s / vacancy** | Нет — очередь |
| `parse-resume` | Upload PDF/DOCX | hash файла | **2–5 s** | Да — modal |

\* Карточки вакансий (`results`) приходят **до** токенов `generate` — perceived wait ниже.

---

### 3.5 Фичи продукта — что видит пользователь

| Фича | UX-сценарий | Estimated wait (typical) | Estimated wait (p95) | Доминирует |
|---|---|---:|---:|---|
| **Demo chat** | Первый запрос без регистрации | **3–5 s** | **6–8 s** | understand + search + TTFT |
| **Demo chat** | Повторный запрос (warm cache) | **2–4 s** | **5–6 s** | search + generate |
| **Registered chat** | Сообщение с памятью и профилем | **3–6 s** | **7–9 s** | + чуть больше context в LLM |
| **Chat** | До карточек вакансий (`results` event) | **1.5–3 s** | **4 s** | understand + search |
| **Chat** | До первого слова ответа (TTFT) | **2–4 s** | **5 s** | + generate TTFT |
| **Chat** | Полный ответ + карточки | **4–8 s** | **10 s** | generate stream |
| **Search** | `POST /search` (debug, no chat) | **0.5–2.5 s** | **3 s** | retrieval only |
| **Favorites** | Добавить / список | **50–200 ms** | **500 ms** | CRUD Postgres |
| **Profile** | Загрузка + edit skills | **100–300 ms** | **500 ms** | |
| **Resume upload** | PDF → parse → suggestions | **3–8 s** | **12 s** | PDF extract + LLM |
| **Memory screen** | Load / delete fact | **50–150 ms** | **300 ms** | |
| **Billing page** | Static mock | **<100 ms** | **200 ms** | SSR static |
| **Auth register** | Sign up | **0.5–1 s** | **2 s** | argon2id |
| **Auth login** | Sign in | **0.3–0.8 s** | **1.5 s** | |

**Wiki targets для сравнения:** search p95 **≤2500 ms** (без LLM); TTFT **≤4000 ms** (с LLM).

---

### 3.6 Offline / batch — ingestion и индексация

| Job | Объём | FP32 | INT8 (TEI) | Оценка | Когда запускать |
|---|---|---:|---:|---:|---|
| **HH API fetch** | 10k vacancies | — | — | **10–30 мин** | Rate limits API |
| **HTML connector** | 1 source, 1k pages | — | — | **20–60 мин** | Throttle 1 req/10s |
| **Normalize + dedupe** | 15k vacancies | — | — | **2–5 мин** | CPU/SQL |
| **extract-skills** | 15k vacancies (no cache) | — | — | **4–12 ч** | LLM batch; дорого |
| **extract-skills** | 15k (cache hit re-run) | — | — | **5–15 мин** | Только изменённые |
| **extract-skills dev** | 500–1000 subset | — | — | **15–40 мин** | Первая отладка |
| **Embed index** | 60k embeddings | **11.2 ч** | **~6.5 ч** | **5–11 ч** | **Overnight** |
| **Embed index** | 2k dev snapshot | **~22 мин** | **~13 мин** | **10–25 мин** | Локальная разработка |
| **MiniLM reindex** (ablation) | 60k embeddings | **0.6 ч** | — | **~35 мин** | Baseline 2026 |
| **BM25 index build** | 15k docs | — | — | **1–3 мин** | Postgres |
| **Graph PMI nightly** | skill_edges recompute | — | — | **5–20 мин** | cron 03:00 |
| **Full ingestion run** | 3 sources + skills + embed | — | — | **12–24 ч** | Первый prod corpus |
| **Incremental cron** | Δ за 6h | — | — | **5–30 мин** | Без full reindex |

---

### 3.7 End-to-end timelines (сводка)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  USER MESSAGE  →  results visible  →  answer complete                   │
│       0 s            1.5–3 s (typ)        4–8 s (typ)                   │
│                      p95 ~4 s             p95 ~10 s                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  RETRIEVAL ONLY (no LLM)                                                │
│  FP32 + rerank:  ~2.5 s   │   INT8 + rerank: ~1.7 s   │  no rerank: 0.5 s │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  FIRST-TIME DEV SETUP                                                   │
│  clone → docker up → migrations → dev snapshot index  ≈  1–3 hours    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  PRODUCTION CORPUS BUILD (once)                                         │
│  fetch + skills + embed  ≈  overnight (12–24 h)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Где пользователь ждёт дольше всего (top-5)

| # | Bottleneck | Typical | Mitigation |
|---|---|---:|---|
| 1 | **Cross-encoder rerank** top-20 | **1.2–2.0 s** | TEI INT8; optional off |
| 2 | **LLM `/understand`** | **0.8–2.5 s** | Cache; быстрая модель с json_schema |
| 3 | **LLM `/generate`** (full) | **2–6 s** | Streaming; карточки раньше текста |
| 4 | **BGE-M3 query embed** | **65–120 ms** | TEI; уже мало vs rerank |
| 5 | **OpenRouter cold / rate limit** | **+1–5 s** spikes | Retry; paid tier |

---

## 4. Ограничения и блокеры

### Блокер 1: torch 2.2.2 + BGE-M3

`SentenceTransformer('BAAI/bge-m3')` **падает** из-за CVE-2025-32434 (нужен torch ≥2.6, на macOS x86 pip его не отдаёт).

**Обход в бенчмарке:** `transformers` + `use_safetensors=True`.  
**Для продакшна:** TEI Docker **не зависит** от этого бага — модели грузятся через ONNX Runtime.

### Блокер 2: индексация BGE-M3 на CPU

11+ часов на 60k embeddings (FP32) vs 0.6 ч у MiniLM.

| Риск | Митигация |
|---|---|
| Долгая первичная индексация | Запуск **ночью**; dev — снимок 1–2k вакансий |
| Переиндексация при абляциях | Не больше **2** энкодеров в главе 4 (уже в Wiki) |
| TEI INT8 | Ожидаемо **~5–7 ч** вместо 11 — всё равно overnight |

### Блокер 3: reranker съедает бюджет

~2 s из 2.5 s — только rerank (FP32).

| Риск | Митигация |
|---|---|
| p95 > 2500 ms | **TEI INT8** (~1–1.3 s rerank) — обязателен |
| Всё равно tight | **Graceful degradation:** rerank off → fused order (уже в ADR) |
| jina-reranker-v2-base | Запланирован в Wiki — **стоит отдельно замерить** в TEI |

### Не блокер, но важно

- **MPS: True** в PyTorch на Intel — **не используем**; prod = CPU ONNX.
- **RAM 32 GB** — хватает (пик ~1.5 GB RSS на все модели по очереди).
- **16 logical CPUs**, torch threads = 8 — нормально.

---

## 5. Что подтверждается / что менять

### Подтверждается (оставляем)

| Решение | Почему |
|---|---|
| BGE-M3 encoder | Качество + кросс-язык; query 117 ms терпимо |
| Reranker **278M**, не 568M | v2-m3: 6.5 s top-20 — **отбраковывается** |
| top-**20**, не 50 | top-50 v2-m3 = **37 s** |
| Truncate **256 tok** на rerank | Меньше вход → меньше latency |
| TEI + ONNX INT8 | Без этого FP32 впритык |
| Rerank **optional** | Fallback при SLA |

### Стоит уточнить / заменить

| Было | Рекомендация после бенчмарка |
|---|---|
| Wiki: index ~1.7 h | Обновить на **5–11 h** (INT8–FP32), «overnight job» |
| Wiki: rerank ~500 ms | FP32 = **~2 s**; INT8 цель **~800–1000 ms** |
| `bge-reranker-base` | Оставить как **fallback**; primary — **`jina-reranker-v2-base-multilingual`** (замерить в TEI) |
| PyTorch в Node (Transformers.js) | Запасной путь OK, но **TEI приоритетнее** — батчинг лучше |

### Не делать на этом железе

- `bge-reranker-v2-m3` в prod
- top-50 rerank на CPU
- Ожидать sub-second rerank без INT8
- Полагаться на SentenceTransformer для BGE-M3 без safetensors/TEI

---

## 6. Прогноз для prod (TEI INT8)

Экstrapolation ×1.7 (середина между 1.5× и 2×):

| Операция | FP32 (факт) | INT8 (прогноз) |
|---|---|---|
| BGE-M3 query | 117 ms | **~65 ms** |
| Rerank top-20 | 1958 ms | **~1150 ms** |
| Pipeline total | 2468 ms | **~1660 ms** |
| Headroom vs 2500 ms | 32 ms | **~840 ms** |

С INT8 конфигурация **жизнеспособна** с комфортным запасом.

---

## 7. Следующие шаги (этап 6 progress-log)

1. **Поднять TEI CPU Docker** с BGE-M3 + jina-reranker, повторить HTTP-бенчмарк (latency `/embed`, `/rerank`).
2. **Зафиксировать** финальные latency targets в Wiki после TEI-прогона.
3. **Не блокировать** разработку: monorepo + DB можно начинать параллельно; ingestion full index — overnight.

---

## 8. Файлы в этой фиче

| Файл | Назначение |
|---|---|
| [`benchmark.py`](benchmark.py) | Скрипт замеров |
| [`benchmark-results.txt`](benchmark-results.txt) | Сырые данные прогона |
| [`report.md`](report.md) | Этот отчёт |

Повторный запуск: `python3 benchmark.py` (модели кэшируются в `~/.cache/huggingface`, ~10–15 мин после первого раза).
