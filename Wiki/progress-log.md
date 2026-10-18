# Progress Log

Статус: активен · Последнее обновление: 2026-10-18

Журнал этапов разработки продукта. Обновляется по мере выполнения — меняй **%** в последней колонке и дату в шапке.

**Ориентир защиты:** через 2–3 месяца (декабрь 2026 – январь 2027).  
**Политика (ADR-022):** качество и новизна > скорость; мощные модели; индексация overnight; latency на CPU — не блокер.  
**Общий прогресс (среднее по этапам):** ~69%

| # | Этап | Ключевые deliverables | % |
|---|---|---|---|
| 1 | **Проектирование и Wiki** | Vision, architecture, retrieval, ADR **001–027**, продукт **Hira** ([11-hira.md](11-hira.md)), схемы, Q28 benchmark | **95** |
| 2 | **Monorepo и инфраструктура** | npm workspaces, `packages/contracts`, `docker-compose.yml` (PostgreSQL, Redis, TEI, сервисы), `.env.example`, health checks | **90** |
| 3 | **База данных** | TypeORM entities, миграции, `vector`, `pg_trgm`, `pg_textsearch`, HNSW/BM25-индексы, seed для dev | **90** |
| 4 | **Auth и core-api (фундамент)** | Register/login, JWT + refresh, argon2id, demo session, rate limits Redis (3 / 20 day), Swagger | **100** |
| 5 | **llm-service** | OpenRouter, `/understand` + json_schema, `/generate` (SSE), Redis cache, ретраи | **100** |
| 6 | **embedding-runtime + CPU benchmark** | FP32 benchmark ✅ [`cpu-tei-benchmark/`](../cpu-tei-benchmark/); prod: TEI + **BGE-M3 + bge-reranker-v2-m3** в обычном Compose, без профиля ([ADR-033](10-decision-log.md)); арена 8192. Реранкер становится healthy раньше энкодера. 2026-10-17 оба живы вместе: `/embed` 1024 FP32, `/rerank` с оценкой ([ADR-034](10-decision-log.md)), `retrieval-service` `GET /health/ready` — 200 | **100** |
| 7 | **Ingestion: источники 1–3** | rabota.by (публичные страницы, [ADR-035](10-decision-log.md)), ГСЗ, Хабр Карьера; normalize, курс НБ РБ на календарные сутки Минска, dedupe simhash, BullMQ, cron, `POST/GET /internal/v1/runs`. Навыки и эмбеддинги — этап 8. Живой снимок по 5 вакансий с каждого источника записан | **100** |
| 8 | **Ingestion: навыки и граф** | extract-skills, ESCO, `vacancy_skills`, PMI/IDF nightly, embed → pgvector (**overnight**) | **75** |
| 9 | **Retrieval: lexical + dense** | BM25 (`pg_textsearch`), HNSW (BGE-M3), чанкинг, parallel top-100 | **75** |
| 10 | **Retrieval: graph + fusion + rerank** | Graph CTE ≤2 hop, RRF, **`bge-reranker-v2-m3`** top-20, explain; light reranker — абляции | **90** |
| 11 | **Оркестрация поиска (core-api)** | Search orchestrator, SSE (intent → results → tokens), чаты, `POST /search` для eval | **90** |
| 12 | **Память, библиотека, вызов (backend)** | 3-tier memory, выключатель межчатовой памяти, библиотека PDF/md/txt, call sessions, profile suggestions. Живой `core-api` после миграции `Stage12Memory1764000000000` (ADR-040) | **90** |
| 13 | **Frontend: чат, стриминг, вызов** | Next.js, dark EN UI, SSE, vacancy cards, match explanation, экран Call, spinner «Searching…» | **80** |
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

**Этап 13.** Экраны чата, стрима и вызова есть в `apps/web`. Демо ведёт чат, аккаунт открывает Call. Живой поиск в этой сессии ответил `Search is temporarily unavailable`, поэтому раскрытие карточки на стенде не смотрели. Поля `companyName`, `locationLabel`, `canonicalName`, `searchQuota` и `intent` в истории есть в коде и тестах; запущенный образ `core-api` их ещё не отдаёт.

**Этап 12** отвечает из живого `core-api`. Миграция `Stage12Memory1764000000000` применена. Демо на библиотеке, памяти и вызове получает `403`. Чужой документ, факт, навык и вызов — `404`. Реплика в завершённый вызов — `400`, повторный `end` — `200` с тем же временем. PDF резюме разобран локально: предложение `EDUCATION` было в `GET /profile/suggestions` и попало в профиль только после accept. В этой базе `skills` пустая, поэтому имя навыка из резюме предложением не становится, пока не загружен ESCO (этап 8).

**Этап 8.** Пайплайн закрыт: навыки, иерархия и алиасы ESCO, ночной PMI/IDF, эмбеддинги. Полные CSV с портала кладутся в `ESCO_DIR` (ADR-038); в репозитории их нет.

2026-10-17 лимит Docker — 23.22 ГиБ. Одновременный старт обоих TEI получил OOM (exit 137): пик загрузки второй модели около 13 ГиБ. Если реранкер уже healthy, энкодер поднимается рядом. В покое энкодер занял 13.24 ГиБ, реранкер 5.94 ГиБ. `/embed` вернул 1024 конечных числа, `/rerank` — оценку `0.000049707` для пробы «вакансия» / «разработчик Python». `GET /health/ready` у `retrieval-service` ответил 200: `postgres`, `tei` и `tei-rerank` в состоянии `up`. В Compose энкодер зависит от `service_healthy` реранкера.

Прогон ingestion по-прежнему берёт один источник. При `INGEST_LIMIT=5` ГСЗ, Хабр Карьера и rabota.by завершились `PARTIAL`: список длиннее лимита, записано по 5 вакансий. Курс НБ РБ кэшируется на календарные сутки Минска; сбой курса не роняет вакансии в BYN и попадает в `errors`. Ошибка отдельной вакансии тоже пишется туда, с `externalId`, и не отменяет остальные карточки того же прогона. Ночная проверка живости запрашивает карточку: открытая обновляет `last_seen_at`, архив ставит `CLOSED`, отсутствующая страница — `EXPIRED`.
