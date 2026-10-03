# 01. Архитектура системы

Статус: черновик · Последнее обновление: 2026-10-03

---

## 1. Принципы декомпозиции

Микросервисы выделены не «чтобы было», а по трём реальным осям, каждую из которых можно защитить на кафедре:

1. **Разная природа нагрузки.** CRUD-операции (чаты, избранное) — это быстрые транзакции. Поиск — это CPU/GPU-нагрузка на энкодер и реранкер. Ingestion — это долгие I/O-bound задачи с внешними сайтами. Складывать их в один процесс значит гарантированно ловить взаимные блокировки (ровно то, что было в курсовой 2026, где синхронный HTTP-вызов к LLM блокировал event loop FastAPI).
2. **Разный цикл жизни и разные зависимости.** Модели энкодера/реранкера тянут за собой тяжёлый рантайм; ядро приложения должно оставаться лёгким и быстро перезапускаться.
3. **Разная изоляция отказов.** Падение LLM-провайдера не должно ронять авторизацию; падение парсера не должно ронять поиск.

**Анти-цель:** не строить distributed monolith. Никакого service mesh, никакого Kafka, никакой саги. Синхронный REST между сервисами, одна база, один репозиторий, один `docker compose up`.

---

## 2. Состав сервисов

![Архитектура системы](diagrams/architecture.png)

Исходник схемы — `diagrams/architecture.dot` (Graphviz), рендер командой:

```bash
cd Wiki/diagrams && dot -Tpng -Gdpi=150 architecture.dot -o architecture.png
```

Текстовая версия той же схемы:

```
                            ┌──────────────────────────┐
                            │   web  (Next.js 15)      │
                            │   React + Tailwind       │
                            │   :3000                  │
                            └────────────┬─────────────┘
                                         │ REST + SSE (стриминг ответа)
                                         ▼
                            ┌──────────────────────────┐
                            │  core-api  (NestJS)      │
                            │  auth · chats · messages │
                            │  favorites · profile     │
                            │  оркестрация поиска      │
                            │  Swagger  :4000          │
                            └───┬──────────┬───────────┘
                                │          │
                ┌───────────────┘          └───────────────┐
                ▼                                          ▼
   ┌────────────────────────┐                 ┌────────────────────────┐
   │ retrieval-service      │                 │ llm-service            │
   │ (Express)  :4001       │                 │ (Express)  :4002       │
   │ BM25 + dense + graph   │                 │ провайдер-агностик     │
   │ RRF · rerank · explain │                 │ query understanding    │
   └──────┬─────────┬───────┘                 │ generation · memory    │
          │         │                         └───────────┬────────────┘
          │         ▼                                     │
          │  ┌──────────────────┐                         ▼
          │  │ embedding-runtime│               ┌──────────────────────┐
          │  │ (HF TEI)  :80    │               │ OpenRouter (внешний) │
          │  │ tei + tei-rerank │               │ dev + prod           │
          │  └──────────────────┘               └──────────────────────┘
          │
          ▼
   ┌─────────────────────────────────────────────────────┐
   │              PostgreSQL 17 + pgvector                │
   │   реляционные данные · векторы · граф навыков        │
   │                      :5432                           │
   └─────────────────────────────────────────────────────┘
                              ▲
                              │
   ┌──────────────────────────┴──────────────────────────┐
   │ ingestion-service (Express + node-cron)  :4003      │
   │ rabota.by · ГСЗ · Хабр Карьера · praca.by ·         │
   │ LinkedIn · Indeed                                    │
   │ нормализация → извлечение навыков → граф → векторы  │
   └─────────────────────────────────────────────────────┘
```

### 2.1 `web` — Next.js 15 (App Router)

- React 19, TypeScript strict, Tailwind CSS v4, Zustand для клиентского состояния.
- Server Components для списков чатов и избранного, Client Components для самого чата.
- Стриминг ответа ассистента через SSE.
- Не ходит напрямую ни в какой сервис кроме `core-api`.
- Подробности — [06-frontend.md](06-frontend.md).

### 2.2 `core-api` — NestJS

Единственная точка входа для фронтенда. Отвечает за:

- аутентификацию (JWT access/refresh, argon2id), авторизацию, rate limiting;
- CRUD: пользователи, чаты, сообщения, избранное, коллекции, память, библиотека документов, сессии вызова;
- файлы библиотеки на томе Docker (`storage/{userId}/…`); отдельного storage-сервиса нет;
- **оркестрацию поискового сценария**: собрать контекст (история чата или вызова, межчатовая память если включена, закреплённые и ближайшие документы) → вызвать `llm-service` для понимания запроса → вызвать `retrieval-service` → вызвать `llm-service` для генерации ответа → сохранить сообщение и результаты;
- владение схемой БД и миграциями (TypeORM);
- Swagger/OpenAPI как источник истины по внешнему контракту.

Важно: сам поиск и сам вызов модели `core-api` не выполняет — он только дирижирует. Это держит его тонким и тестируемым.

### 2.3 `retrieval-service` — Express

Единственный сервис, который знает, *как* устроен поиск. Принимает структурированное намерение (не сырой текст) и возвращает ранжированный список вакансий с пофакторным объяснением.

- Три параллельные ветви поиска: лексическая (BM25), плотная (pgvector), графовая (обход графа навыков).
- Слияние Reciprocal Rank Fusion, затем cross-encoder реранкинг.
- Читает PostgreSQL напрямую (read-only пул), пишет только в `search_logs`.
- Держит HTTP-клиент к `embedding-runtime`.
- Полное описание — [02-retrieval-layer.md](02-retrieval-layer.md).

### 2.4 `llm-service` — Express

Провайдер-агностичный шлюз к языковым моделям. Задачи:

| Задача | Что делает |
|---|---|
| `understand` | Сырой запрос + история + память → структурированное намерение (роль, навыки, грейд, формат, зарплата, локация, жёсткие/мягкие ограничения) через structured output |
| `generate` | Вопрос + найденные вакансии + объяснения → связный ответ со стримингом |
| `summarize-chat` | Схлопывание длинной истории в сводку (mid-term память) |
| `extract-memory` | Выделение устойчивых фактов о пользователе из диалога |
| `extract-skills` | Извлечение и нормализация навыков из описания вакансии (вызывается из `ingestion-service`) |

Внутри — роутинг по провайдерам, единый интерфейс, ретраи с backoff, таймауты, учёт токенов и стоимости, кэш по хешу промпта.

**Провайдер (Q27): OpenRouter** — единственный провайдер на dev и prod. Google AI Studio недоступен (регион). Для `json_schema` выбираем модели с structured output, **даже платные**. `llm-service` остаётся провайдер-агностичным (переключение модели — через конфиг).

### 2.5 `ingestion-service` — Express + cron

- Коннекторы к источникам (см. [03-data-sources.md](03-data-sources.md)).
- Пайплайн: `fetch → normalize → dedupe → extract skills → link to graph → embed → index`.
- Расписание через `node-cron` внутри сервиса; очередь задач — **BullMQ на Redis** (Q6).
- Идемпотентность: каждая вакансия имеет `(source, external_id)` как естественный ключ; изменение контента детектируется по `content_hash`, что инвалидирует эмбеддинг и извлечённые навыки.
- Каждый прогон пишет в `ingestion_runs`: сколько получено, добавлено, обновлено, закрыто, ошибки.

### 2.6 `embedding-runtime` — Hugging Face Text Embeddings Inference

Два контейнера TEI (CPU-образ), по одной модели. `tei` поднимает энкодер `BAAI/bge-m3` (`/embed`), `tei-rerank` — `BAAI/bge-reranker-v2-m3` (`/rerank`). Внутри сети Compose оба слушают порт 80. Модели в формате ONNX с INT8-квантованием. Это позволяет не писать ни строчки Python и при этом использовать современные модели.

Машина разработки — Intel i9-9880H, инференс только на CPU. Prod-реранкер — `BAAI/bge-reranker-v2-m3` (ADR-022): на top-20 это несколько секунд, и это принято. Модель ~278M — абляция, не прод. Подробности — [02-retrieval-layer.md](02-retrieval-layer.md), п. 4.2.

Запасной вариант, если TEI на Intel-маке окажется капризным: Transformers.js v3 прямо в Node, без отдельного контейнера.

### 2.7 PostgreSQL

Одна инстанция, локально. Расширения: `vector` (pgvector, HNSW-индекс), `pg_trgm` (нечёткое сопоставление навыков), `pg_textsearch` (BM25, конфигурация по языку документа — ADR-017). Граф навыков моделируется реляционно (таблица рёбер + рекурсивные CTE), а не отдельной графовой СУБД — обоснование в [02-retrieval-layer.md](02-retrieval-layer.md), раздел «Почему не Neo4j».

---

## 3. Структура репозитория

Monorepo, npm workspaces.

```
job-finder-ai/
├── docker-compose.yml
├── package.json                  # workspaces
├── docs/                         # ADR + design (копия Wiki на момент сдачи)
├── packages/
│   └── contracts/                # общие TypeScript-типы, DTO, enum'ы
│       └── src/
│           ├── common/enums/
│           └── common/dto/
├── apps/
│   ├── web/                      # Next.js
│   │   └── src/
│   │       ├── app/
│   │       ├── common/components/
│   │       └── features/
│   │           ├── auth/
│   │           ├── chat/
│   │           ├── favorites/
│   │           └── profile/
│   ├── core-api/                 # NestJS
│   │   └── src/
│   │       ├── common/{constants,enums,dto,utils}/
│   │       └── features/
│   │           ├── database/
│   │           ├── auth/
│   │           ├── user/
│   │           ├── chat/
│   │           ├── message/
│   │           ├── favorite/
│   │           ├── memory/
│   │           ├── search-orchestrator/
│   │           └── health/
│   ├── retrieval-service/        # Express
│   │   └── src/
│   │       ├── common/
│   │       └── features/
│   │           ├── lexical/
│   │           ├── dense/
│   │           ├── graph/
│   │           ├── fusion/
│   │           ├── rerank/
│   │           └── explain/
│   ├── llm-service/              # Express
│   │   └── src/features/{provider,understand,generate,memory,skills}/
│   └── ingestion-service/        # Express
│       └── src/features/{connectors,normalize,dedupe,skills,embed,scheduler}/
└── infra/
    ├── postgres/init.sql
    └── tei/
```

Структура внутри каждого приложения следует конвенции проекта: `src/common/` для переиспользуемого, `src/features/<feature>/` для бизнес-логики, суффиксы `.service.ts`, `.controller.ts`, `.entity.ts`, `.module.ts`, `.utils.ts`, `.constants.ts`.

`packages/contracts` — принципиальный момент: DTO и enum'ы (`MatchFactor`, `EmploymentType`, `SeniorityLevel`, `VacancySource`, `RetrievalBranch`) объявлены один раз и импортируются всеми сервисами, включая фронтенд. Это убирает главный минус микросервисов на TypeScript — рассинхрон контрактов.

---

## 4. Сквозной сценарий поиска

```
1. web           POST /api/v1/chats/{id}/messages { content }
2. core-api      сохраняет user-сообщение, собирает контекст:
                   - последние N сообщений чата
                   - сводка чата (mid-term)
                   - релевантные факты профиля (long-term)
3. core-api  ──▶  llm-service  POST /understand
                   { query, history, memory }
                 ◀── SearchIntent { role, skills[], seniority,
                       hardConstraints{}, softConstraints{},
                       rewrittenQuery, complexity }
4. core-api  ──▶  retrieval-service  POST /search
                   { intent, userId, limit }
                   ├─ ветвь lexical   (Postgres FTS / BM25)
                   ├─ ветвь dense     (pgvector HNSW)     ── параллельно
                   └─ ветвь graph     (обход графа навыков)
                   → RRF-слияние
                   → применение жёстких ограничений + релаксация
                   → cross-encoder реранк top-50 → top-10
                   → расчёт пофакторных объяснений
                 ◀── { results[], diagnostics{} }
5. core-api  ──▶  llm-service  POST /generate  (stream)
                   { intent, results, history }
                 ◀── SSE поток текста
6. core-api      стримит на web, параллельно сохраняет
                 assistant-сообщение + привязку к вакансиям
7. core-api  ──▶  llm-service  POST /extract-memory  (асинхронно, fire-and-forget)
```

Шаг 7 не блокирует ответ пользователю.

**Деградация.** Если `llm-service` недоступен на шаге 3 — `core-api` строит намерение эвристически (сырой запрос как `rewrittenQuery`, без структурных ограничений) и идёт в поиск. Если недоступен на шаге 5 — отдаёт карточки вакансий без текстового ответа. Если недоступен `retrieval-service` — честная ошибка 503. Никаких «тихих» 500, как было в курсовой 2026.

---

## 5. Межсервисное взаимодействие

| Свойство | Решение |
|---|---|
| Протокол | HTTP/1.1, JSON, REST |
| Аутентификация | Общий внутренний токен в заголовке `X-Internal-Token`; сервисы не доступны снаружи Docker-сети |
| Трассировка | `X-Request-Id` пробрасывается сквозь все хопы и пишется в логи |
| Таймауты | web→core 30 с; core→llm 25 с; core→retrieval 10 с; retrieval→TEI 8 с (запас на CPU-инференс) |
| Ретраи | Только на идемпотентных GET и на вызовах LLM (до 2 попыток, экспоненциальный backoff). На поиске ретраев нет |
| Формат ошибок | Единый `ApiErrorResponse { errorCode, message, details?, requestId }` во всех сервисах |
| Логирование | Структурированный JSON (pino), уровень из env |
| Health | Каждый сервис отдаёт `GET /health` (liveness) и `GET /health/ready` (readiness с проверкой зависимостей) |

---

## 6. Развёртывание

`docker-compose.yml` поднимает: `postgres`, **`redis`**, `tei`, `tei-rerank`, `core-api`, `retrieval-service`, `llm-service`, `ingestion-service`, `web`. Внутри сети: retrieval `4001`, llm `4002`, ingestion `4003`, оба TEI — `80`. Наружу торчат только `web:3000` и `core-api:4000` (для Swagger).

### Redis

| Назначение | Технология |
|---|---|
| Кэш ответов LLM | Redis + TTL по хешу промпта |
| Очереди ingestion | BullMQ (extract-skills, embed, reindex) |
| Rate limiting | Счётчики запросов пользователя (20/day) и demo (3 total) |

Postgres как очередь не используем — BullMQ даёт retries, backoff и visibility из коробки.

Миграции применяются отдельным one-shot контейнером перед стартом `core-api`.

Секреты (ключи LLM-провайдеров, пароль БД) — только через переменные окружения, `.env` в `.gitignore`, в репозитории лежит `.env.example` с именами переменных без значений.

---

## 7. Открытые вопросы по этому документу

Закрыты: Q2, Q6 (Redis), Q10 (ingestion — отдельный сервис), Q27 (OpenRouter).

Остаётся: Q28 (замер TEI на CPU — первая неделя разработки).
