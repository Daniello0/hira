# Progress Log

Статус: активен · Последнее обновление: 2026-10-11

Журнал этапов разработки продукта. Обновляется по мере выполнения — меняй **%** в последней колонке и дату в шапке.

**Ориентир защиты:** через 2–3 месяца (декабрь 2026 – январь 2027).  
**Политика (ADR-022):** качество и новизна > скорость; мощные модели; индексация overnight; latency на CPU — не блокер.  
**Общий прогресс (среднее по этапам):** ~37%

| # | Этап | Ключевые deliverables | % |
|---|---|---|---|
| 1 | **Проектирование и Wiki** | Vision, architecture, retrieval, ADR **001–027**, продукт **Hira** ([11-hira.md](11-hira.md)), схемы, Q28 benchmark | **95** |
| 2 | **Monorepo и инфраструктура** | npm workspaces, `packages/contracts`, `docker-compose.yml` (PostgreSQL, Redis, TEI, сервисы), `.env.example`, health checks | **90** |
| 3 | **База данных** | TypeORM entities, миграции, `vector`, `pg_trgm`, `pg_textsearch`, HNSW/BM25-индексы, seed для dev | **90** |
| 4 | **Auth и core-api (фундамент)** | Register/login, JWT + refresh, argon2id, demo session, rate limits Redis (3 / 20 day), Swagger | **100** |
| 5 | **llm-service** | OpenRouter, `/understand` + json_schema, `/generate` (SSE), Redis cache, ретраи | **100** |
| 6 | **embedding-runtime + CPU benchmark** | FP32 benchmark ✅ [`cpu-tei-benchmark/`](../cpu-tei-benchmark/); prod: TEI + **BGE-M3 + bge-reranker-v2-m3** в обычном Compose, без профиля ([ADR-033](10-decision-log.md)); арена 8192; живые `/embed` (1024, ONNX FP32) и `/rerank` (safetensors, [ADR-034](10-decision-log.md)). Оба процесса вместе в лимит Docker 16 ГБ не влезли | **90** |
| 7 | **Ingestion: источники 1–3** | rabota.by (HH API), ГСЗ, Хабр Карьера; normalize, dedupe simhash, BullMQ, cron, `POST/GET /internal/v1/runs`. Навыки и эмбеддинги — этап 8. Живой снимок ГСЗ и Хабра по 5 вакансий записан. rabota.by без токена приложения — HTTP 403 | **70** |
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

**Этапы 6 и 7.** TEI входит в обычный `docker compose up` ([ADR-033](10-decision-log.md)), арена батча — 8192. 2026-10-11 `/embed` вернул вектор из 1024 чисел (`model_dtype: float32`, ONNX). `/rerank` вернул оценку; реранкер — safetensors через Candle ([ADR-034](10-decision-log.md)). В покое энкодер занял около 13.4 ГиБ, реранкер около 5.9 ГиБ, поэтому вместе их не держали: лимит Docker 15.6 ГиБ. `retrieval-service` из-за этого не стартовал. В Compose он ждёт `GET /health` обоих, а `GET /health/ready` проверяет размер вектора и оценку реранкера.

`POST /internal/v1/runs` — один источник за запрос. ГСЗ и Хабр Карьера при `INGEST_LIMIT=5` приняты (`202`) и завершились `PARTIAL`: список длиннее лимита, записано по 5 вакансий, ошибок нет. rabota.by не снимался: неавторизованный `GET /vacancies` отвечает 403 `forbidden`. Менять ли ADR-004, не решено.

Ingestion пишет вакансии источников 1–3 в уже существующие таблицы: список и карточка, нормализация, upsert по `(source, external_id)`, simhash-дедуп, протухание через 48 часов. `node-cron` только кладёт задачи в BullMQ (`bull:ingestion`). `extract-skills`, граф и векторы остаются этапом 8. Дальше — решение по ADR-004 либо этап 8.
