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

В `.env` задайте как минимум `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` и `INTERNAL_API_TOKEN`. Пароль базы — без символов, которые ломают URL или подстановку Compose (`@`, `:`, `/`, `$`). `OPENROUTER_API_KEY` можно оставить пустым, пока не вызывается LLM.

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

Схема таблиц в этот этап не входит. `infra/postgres/init.sql` только включает расширения. Миграции TypeORM — следующий этап, отдельным контейнером перед `core-api`.

## Лицензия

[Apache License 2.0](LICENSE).
