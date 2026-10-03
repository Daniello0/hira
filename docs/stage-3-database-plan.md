# Этап 3. База данных — план, без реализации

Статус: подготовка. Схема, сущности и миграции в этот коммит не входят.

Источник колонок — `Wiki/04-data-model.md`. Владелец миграций — `core-api` (`Wiki/01-architecture.md`). Образ PostgreSQL уже включает `vector`, `pg_trgm`, `uuid-ossp`, `pg_textsearch` v1.3.0 (`infra/postgres`, `Wiki/progress-log.md`).

Реализацию не начинать, пока не закрыты блокеры внизу. Они меняют тип колонки лексического индекса, а этот тип уже записан в Wiki.

## Что уже есть и что переиспользовать

Новый ORM и второй набор enum не заводить.

- Расширения создаёт `infra/postgres/init.sql`. Миграция может повторить `CREATE EXTENSION IF NOT EXISTS` для тестовой базы без entrypoint, но сборку расширения и `shared_preload_libraries=pg_textsearch` не дублировать: это уже команда сервиса `postgres` в `docker-compose.yml`.
- Доменные значения живут в `packages/contracts`. Postgres-enum берёт те же строки. В `apps/core-api/src/common/enums` второй копии нет — её и не создавать. Уже есть: `VacancySource`, `Language`, `VacancyStatus`, `SeniorityLevel`, `EmploymentType`, `WorkFormat`, `RateUnit`, `SkillType`, `SkillEdgeType`, `SkillImportance`, `MemoryKind`, `MessageRole`.
- `DATABASE_URL` уже проброшен в `core-api`, `retrieval-service` и `ingestion-service`. Читает его `apps/core-api/src/common/utils/env.ts` через константы `ENV`.
- Readiness сейчас — TCP (`build-probes.ts`). Это проверка порта, не версии схемы. Менять её на «таблица существует» имеет смысл только вместе с контейнером миграций, иначе сервис станет неготовым на пустой базе.
- Каталоги фич из `Wiki/01-architecture.md`: сущность может появиться без контроллера. Общее для всех таблиц (стратегия имён, колонка `vector(1024)`, базовые `created_at` / `updated_at`) — один раз в `apps/core-api/src/features/database` и `src/common`, не в каждой сущности.
- Курсовая 2026 (Alembic, эмбеддинг 384, одна таблица вакансий) — не переносить. Совпадает только идея: вакансия, хеш содержимого, вектор в PostgreSQL.

`design.mdc` в строке про избранное упоминает application status. Хозяин факта — `Wiki/04-data-model.md`: трекера отклика нет, у `favorites` его не будет.

## Как класть схему, когда блокеры закрыты

Один DataSource в `core-api`. `synchronize: false`. Индексы, которые TypeORM не выражает (HNSW, GIN `gin_trgm_ops`, BM25, generated column), — сырой SQL миграции. Сущности только отображают уже созданные колонки.

Отдельный контейнер миграций на том же образе `core-api`, другая команда, до старта HTTP. Так написано в `README.md`. `core-api`, `retrieval-service` и `ingestion-service` ждут `service_completed_successfully`. Свой TypeORM у retrieval и ingestion не заводить: схему пишет только `core-api`, остальные ходят SQL-запросами.

Порядок миграций по зависимостям:

1. Расширения, если их ещё нет.
2. `locations`.
3. Пользователи: `users`, `refresh_tokens`, `user_profiles`, `user_profile_skills`, `user_memories`, `user_documents`.
4. Вакансии: `companies`, `vacancies`, `vacancy_chunks`, `vacancy_duplicates`.
5. Граф: `skills`, `skill_aliases`, `skill_edges`, `vacancy_skills`, `occupations`, `occupation_skills`, `occupation_transitions`.
6. Диалоги и избранное: `chats`, `messages`, `message_vacancies`, `call_sessions`, `call_turns`, `search_logs`, `collections`, `favorites`.
7. Служебное: `ingestion_runs`, `feedback`.
8. Индексы из раздела 5 `Wiki/04-data-model.md` и HNSW на каждой колонке `vector(1024)` (`Wiki/design.mdc`).

Параметры HNSW не размазывать числами: `m = 16`, `ef_construction = 64`, `vector_cosine_ops`, размерность 1024. Имена — константы.

`hnsw.iterative_scan` — параметр сервера pgvector 0.8, не индекс. Образ уже `pgvector/pgvector:0.8.7-pg17`. Место для него — команда `postgres` в Compose, рядом с `shared_preload_libraries`, чтобы не включать его в каждом запросе retrieval.

Удаление пользователя снимает его строки (`Wiki/04-data-model.md` про библиотеку). Для дочерних таблиц пользователя — `ON DELETE CASCADE`. Чанки, навыки вакансии и дубликаты каскадом от вакансии. Пользовательские таблицы вакансию не удаляют.

Sparse-вектор BGE-M3 в этап 3 не входит: колонки нет в `Wiki/04-data-model.md`, абляция — этапы 9–10 и 16.

Seed. Корпус вакансий — этап 7, ESCO и IDF — этап 8, демо-пользователь — этап 4. В этапе 3 уместен справочник `locations` по ADR-018 (Беларусь). Состав seed в Wiki не записан — см. блокер.

Недостающие enum в `packages/contracts`, затем те же подписи в Postgres: `user_role`, уровень навыка профиля, источник навыка профиля, `document_kind`, `document_format`, `document_author`, `parse_status`, кто добавил избранное, `detected_by` дубликата, статус прогона ingestion, оценка feedback, источник алиаса навыка.

## Блокеры

Их нельзя закрыть выбором в коде. Нужна правка Wiki.

### 1. Лексическая колонка и BM25

`Wiki/04-data-model.md` и `Wiki/design.mdc`: `search_vector` — генерируемый `tsvector`, веса title A / skills B / company C / description D, конфигурация `russian` или `english` по `language`, плюс GIN по этому `tsvector`.

ADR-017 и `Wiki/02-retrieval-layer.md`: BM25 через `pg_textsearch` по полю `search_vector`.

Установлен `pg_textsearch` v1.3.0 (`infra/postgres/Dockerfile`). Документация расширения: индекс `USING bm25` строится по одной колонке `text`, `text_config` задаётся на индекс целиком, выражение индексировать нельзя. Расширение само вызывает `to_tsvector`. Индекса по `tsvector` и весов `setweight` в параметрах индекса нет.

Отсюда три несовместимых требования в одной колонке: тип `tsvector`, построчный выбор конфигурации, BM25-индекс расширения.

Генерируемая колонка дополнительно не может прочитать `companies` и `vacancy_skills`: в выражении `GENERATED` доступны только колонки той же строки. Навыков и названия компании в `vacancies` нет.

`Wiki/03-data-sources.md`, п. 1.5, допускает «отдельную колонку либо выбор конфигурации по полю `language`». Это ближе к двум индексам, чем к одной генерируемой колонке, но не отменяет ADR-017.

### 2. `companies.industry_id`

В `Wiki/04-data-model.md` это внешний ключ. Таблицы `industries` в карте доменов нет. Узел Industry назван в `Wiki/02-retrieval-layer.md` и не расписан колонками. Внешний ключ без цели создать нельзя.

### 3. Содержимое seed

«Seed для dev» есть в `Wiki/progress-log.md` и нигде не разложен по таблицам. Малый корпус 1000–2000 вакансий в разделе 8 `Wiki/04-data-model.md` — про объём отладки retrieval, не про SQL-seed этапа 3.

## Что сознательно не делать на этом этапе

- Не включать `synchronize`.
- Не копировать сущности в retrieval и ingestion.
- Не добавлять колонку статуса отклика.
- Не строить HNSW по полному корпусу: на пустой таблице индекс пустой, заливка эмбеддингов — этап 8.
- Не переносить Alembic-схему 2026 года.
