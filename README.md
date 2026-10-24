# Hira

Веб-приложение на основе RAG-архитектуры для автоматизированного подбора вакансий. **Hira** (Хайра) — имя приложения и AI-помощника.

Тема курсовой: «Разработка веб-приложения на основе RAG-архитектуры для автоматизированного подбора вакансий».

Решения, границы курсовой и диплома, схема сервисов — в [Wiki](Wiki/README.md).

## Репозиторий

npm workspaces:

| Путь | Что это |
|---|---|
| `packages/contracts` | Общие enum и DTO |
| `apps/web` | Next.js, порт 3000 |
| `apps/core-api` | NestJS, порт 4000 |
| `apps/retrieval-service` | Express, порт 4001, только внутри сети Compose |
| `apps/llm-service` | Express, порт 4002, только внутри сети Compose |
| `apps/ingestion-service` | Express, порт 4003, только внутри сети Compose |
| `infra/postgres` | PostgreSQL 17, pgvector, `pg_trgm`, `pg_textsearch` |

Наружу Compose публикует только `web` (3000) и `core-api` (4000). У каждого сервиса есть `GET /health` и `GET /health/ready`.

## Локальный запуск

Нужны Node.js 22+ и Docker.

```bash
cp .env.example .env
```

В `.env` задайте как минимум `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `INTERNAL_API_TOKEN` и `JWT_SECRET`. Секрет — не короче 32 символов: им подписывается access JWT. Пароль базы — без символов, которые ломают URL или подстановку Compose (`@`, `:`, `/`, `$`). `WEB_ORIGIN` — origin фронтенда для CORS с cookie; пустое значение значит `http://localhost:3000`. `OPENROUTER_API_KEY` можно оставить пустым, пока не вызывается LLM.

```bash
npm install
npm test
npm run build
COMPOSE_BAKE=0 docker compose up --build
```

`COMPOSE_BAKE=0` нужен, пока каталог репозитория содержит не-ASCII символы: Bake кладёт путь в gRPC-заголовок и сборка падает.

Первый подъём `tei` и `tei-rerank` скачивает `BAAI/bge-m3` и `BAAI/bge-reranker-v2-m3`. Пока модели не нужны:

```bash
COMPOSE_BAKE=0 docker compose up --build postgres redis core-api retrieval-service llm-service ingestion-service web
```

`retrieval-service` в этом режиме не станет ready: его readiness проверяет оба контейнера TEI.

`infra/postgres/init.sql` включает расширения. Таблицы, индексы и справочник `locations` создаёт контейнер `migrate` (`node dist/migrate.js`) до старта сервисов, которые читают базу.

## Runbook

### Порядок старта

`postgres`, `redis` → `migrate` (создаёт схему и завершается) → `core-api`, `llm-service`, `ingestion-service` → `tei-rerank` → `tei` (первый старт ~10 минут, качает модели) → `retrieval-service` → `web`. `ingestion-service` ждёт только старта `llm-service`, TEI не ждёт: эмбеддинги догоняются на 15-минутном тике, когда TEI поднимется.

### Минимальный стек без TEI

```bash
COMPOSE_BAKE=0 docker compose up --build postgres redis migrate core-api llm-service ingestion-service web
```

`retrieval-service` сюда не входит: он зависит от здоровых `tei` и `tei-rerank` и потянет их за собой. Без TEI сбор и извлечение навыков работают, прогоны `EMBED` завершаются ошибкой `TEI_EMBED_URL`/сети до подъёма TEI.

### Один прогон вручную

`ingestion-service` слушает только внутри сети Compose, запрос идёт из контейнера с внутренним токеном:

```bash
docker compose exec ingestion-service node -e "fetch('http://127.0.0.1:4003/internal/v1/runs',{method:'POST',headers:{'content-type':'application/json','X-Internal-Token':process.env.INTERNAL_API_TOKEN},body:JSON.stringify({source:'PRACA_BY',jobType:'INCREMENTAL'})}).then(r=>r.text()).then(console.log)"
```

Тело: `{ "source": "<RABOTA_BY|GSZ|HABR_CAREER|PRACA_BY|LINKEDIN|INDEED>", "jobType": "<INCREMENTAL|LIVENESS|RECONCILE|EXTRACT_SKILLS|EMBED|GRAPH>" }`. Ответ `202` — запись прогона; статус — `GET /internal/v1/runs/<id>`. Выключенный источник отвечает `400` с именем переменной, которую нужно включить. `GRAPH` (импорт ESCO и пересчёт графа навыков) принимает любой источник — он только записывается в журнал. Объём одного прогона ограничен `INGEST_LIMIT` (по умолчанию 2000), `RECONCILE` читает в 5 раз больше.

### Расписание

| Задача | Когда |
|---|---|
| `INCREMENTAL` rabota.by, ГСЗ, Хабр Карьера, praca.by | каждые 6 ч |
| `INCREMENTAL` LinkedIn, Indeed | 02:00, с суточным лимитом запросов |
| `LIVENESS` (проверка закрытых) | 03:00 |
| `GRAPH` | 04:00 |
| `RECONCILE` белорусских источников | воскресенье 05:00 |
| `EXTRACT_SKILLS`, `EMBED` | каждые 15 мин |

Тик cron с фиксированным id не ставится в очередь второй раз, пока прошлый ждёт или идёт.

### Переменные ingestion-service

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `SKILL_EXTRACTION_ENABLED` | `true` | Выключатель извлечения навыков (вызовов LLM) |
| `LLM_DAILY_BUDGET` | `200` | Вызовов `extract-skills` в сутки (UTC), счётчик в Redis; по 5 вакансий на вызов |
| `SOURCE_RABOTA_BY_ENABLED`, `SOURCE_GSZ_ENABLED`, `SOURCE_HABR_CAREER_ENABLED`, `SOURCE_PRACA_BY_ENABLED` | `true` | Источники 1–4 |
| `SOURCE_LINKEDIN_ENABLED` | `false` | LinkedIn: `robots.txt` запрещает всё для `User-agent: *`, поэтому прогон всё равно остановится на проверке robots |
| `SOURCE_INDEED_ENABLED` | `false` | Indeed: Cloudflare отвечает 403 |
| `SOURCE_LINKEDIN_DAILY_CAP`, `SOURCE_INDEED_DAILY_CAP` | `150`, `100` | Суточный лимит HTTP-запросов к источнику |
| `ESCO_HOST_DIR` | `./data/esco` | Папка с CSV ESCO v1.1.1 на хосте; монтируется в `/app/esco` только для чтения |
| `ESCO_DIR` | `/app/esco` | Путь внутри контейнера; без CSV импорт пропускается |

### Как тратить меньше LLM

- `SKILL_EXTRACTION_ENABLED=false` — навыки не извлекаются вовсе; эмбеддинги и поиск работают (эмбеддинг не ждёт навыков).
- `LLM_DAILY_BUDGET=20` — потолок вызовов в сутки; на исчерпании тик останавливается до завтра.
- Ответ `429` от llm-service останавливает тик до следующих 15 минут; вакансия, на которой модель трижды ошиблась, больше не берётся.
- Ручной прогон `EXTRACT_SKILLS` и cron не обрабатывают один источник одновременно (advisory lock).

## Лицензия

[Apache License 2.0](LICENSE).
