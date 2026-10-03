# Progress Log

Статус: активен · Последнее обновление: 2026-10-03

Журнал этапов разработки продукта. Обновляется по мере выполнения — меняй **%** в последней колонке и дату в шапке.

**Ориентир защиты:** через 2–3 месяца (декабрь 2026 – январь 2027).  
**Политика (ADR-022):** качество и новизна > скорость; мощные модели; индексация overnight; latency на CPU — не блокер.  
**Общий прогресс (среднее по этапам):** ~20%

| # | Этап | Ключевые deliverables | % |
|---|---|---|---|
| 1 | **Проектирование и Wiki** | Vision, architecture, retrieval, ADR **001–027**, продукт **Hira** ([11-hira.md](11-hira.md)), схемы, Q28 benchmark | **95** |
| 2 | **Monorepo и инфраструктура** | npm workspaces, `packages/contracts`, `docker-compose.yml` (PostgreSQL, Redis, TEI, сервисы), `.env.example`, health checks | **90** |
| 3 | **База данных** | TypeORM entities, миграции, `vector`, `pg_trgm`, `pg_textsearch`, HNSW/BM25-индексы, seed для dev | **90** |
| 4 | **Auth и core-api (фундамент)** | Register/login, JWT + refresh, argon2id, demo session, rate limits Redis (3 / 20 day), Swagger | 0 |
| 5 | **llm-service** | OpenRouter, `/understand` + json_schema, `/generate` (SSE), Redis cache, ретраи | 0 |
| 6 | **embedding-runtime + CPU benchmark** | FP32 benchmark ✅ [`cpu-tei-benchmark/`](../cpu-tei-benchmark/); prod: TEI + **BGE-M3 + bge-reranker-v2-m3**; TEI Docker — опционально | **70** |
| 7 | **Ingestion: источники 1–3** | rabota.by (HH API), ГСЗ, Хабр Карьера; normalize, dedupe, BullMQ, cron | 0 |
| 8 | **Ingestion: навыки и граф** | extract-skills, ESCO, `vacancy_skills`, PMI/IDF nightly, embed → pgvector (**overnight**) | 0 |
| 9 | **Retrieval: lexical + dense** | BM25 (`pg_textsearch`), HNSW (BGE-M3), чанкинг, parallel top-100 | 0 |
| 10 | **Retrieval: graph + fusion + rerank** | Graph CTE ≤2 hop, RRF, **`bge-reranker-v2-m3`** top-20, explain; light reranker — абляции | 0 |
| 11 | **Оркестрация поиска (core-api)** | Search orchestrator, SSE (intent → results → tokens), чаты, `POST /search` для eval | 0 |
| 12 | **Память, библиотека, вызов (backend)** | 3-tier memory, выключатель межчатовой памяти, библиотека PDF/md/txt, call sessions, profile suggestions | 0 |
| 13 | **Frontend: чат, стриминг, вызов** | Next.js, dark EN UI, SSE, vacancy cards, match explanation, экран Call, spinner «Searching…» | 0 |
| 14 | **Frontend: профиль, библиотека, избранное, billing** | Profile, library, favorites, memory, mock `/billing` | 0 |
| 15 | **Ingestion: источники 4–6** | praca.by, LinkedIn, Indeed; `is_foreign_remote` + filter | 0 |
| 16 | **Экспериментальная оценка** | 30 queries (+16 из 2026), qrels, абляции, latency **фиксируется честно** (не SLA) | 0 |
| 17 | **Интеграция и подготовка к защите** | Vitest ≥70%, `docker compose up`, runbook, smoke E2E | 0 |

---

## Легенда %

| Диапазон | Смысл |
|---|---|
| 0 | Не начато |
| 1–25 | Каркас / spike / частичный прототип |
| 26–50 | Основной функционал есть, не интегрирован |
| 51–75 | Работает end-to-end, остаются edge cases |
| 76–99 | Готово, мелкие правки / полировка |
| 100 | Закрыто, принято |

## Зависимости (критический путь)

```
1 Wiki ──► 2 Monorepo ──► 3 DB ──► 4 Auth
                              │
         6 TEI/benchmark ◄────┼────► 7 Ingestion 1-3 ──► 8 Skills/graph (overnight)
                              │              │
                              └──────► 9 Retrieval L+D ──► 10 Graph+RRF+v2-m3
                                              │
                              5 llm-service ◄─┴──► 11 Orchestration ──► 13-14 Frontend
                                              │
                                         16 Evaluation (после 10 + корпус)
                                              │
                                         17 Integration
```

Этапы **15** и **16** можно параллелить с **13–14**, если корпус 1–3 достаточен для демо.

## Замеры latency (ориентиры, ADR-022)

| Что | Время (i9-9880H, FP32) |
|---|---|
| Retrieval + v2-m3 rerank | **~7–8 s** |
| Полный чат | **~10–20 s** (до 1–2 min OK) |
| Индексация 60k emb. | **~11 h overnight** |

Подробно: [`cpu-tei-benchmark/report.md`](../cpu-tei-benchmark/report.md), [`llm-lexical-graph-summary.md`](llm-lexical-graph-summary.md) §8.

## Следующий шаг

**Этап 4** — регистрация, JWT и refresh. Этап 3 поднят: миграция `InitialSchema` в `core-api`, контейнер `migrate` до сервисов с базой, HNSW и два частичных BM25-индекса, seed `locations`. Корпус вакансий по-прежнему этап 7. Контейнеры `tei` и `tei-rerank` описаны в Compose; первый запуск качает модели и нужен перед retrieval.
