# 04. Модель данных

Статус: черновик · Последнее обновление: 2026-10-03

СУБД: PostgreSQL 17, локально. Расширения: `vector` (pgvector), `pg_trgm`, `pg_textsearch` (BM25, ADR-017), `uuid-ossp`. ORM: TypeORM, миграции живут в `core-api`.

Соглашения: `snake_case` в БД, `camelCase` в TypeScript, PK — `uuid` (кроме справочников, где `serial` достаточно), везде `created_at` / `updated_at`.

---

## 1. Карта доменов

```
  ┌─── ПОЛЬЗОВАТЕЛИ ────────────────────────────────┐
  │  users · refresh_tokens · user_profiles         │
  │  user_profile_skills · user_memories            │
  │  user_documents                                 │
  └─────────────────────────────────────────────────┘
  ┌─── ДИАЛОГИ ─────────────────────────────────────┐
  │  chats · messages · message_vacancies           │
  │  call_sessions · call_turns · search_logs       │
  └─────────────────────────────────────────────────┘
  ┌─── ИЗБРАННОЕ ───────────────────────────────────┐
  │  collections · favorites                        │
  └─────────────────────────────────────────────────┘
  ┌─── ВАКАНСИИ ────────────────────────────────────┐
  │  vacancies · vacancy_chunks · companies         │
  │  locations · vacancy_duplicates                 │
  └─────────────────────────────────────────────────┘
  ┌─── ГРАФ ЗНАНИЙ ─────────────────────────────────┐
  │  skills · skill_edges · skill_aliases           │
  │  vacancy_skills · occupations                   │
  │  occupation_skills · occupation_transitions     │
  └─────────────────────────────────────────────────┘
  ┌─── СЛУЖЕБНОЕ ───────────────────────────────────┐
  │  ingestion_runs · feedback                      │
  └─────────────────────────────────────────────────┘
```

---

## 2. Пользователи и память

### `users`

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `varchar(320)` UNIQUE NOT NULL | нормализованный lowercase |
| `password_hash` | `varchar(255)` NOT NULL | argon2id |
| `display_name` | `varchar(128)` | |
| `role` | `user_role` enum | `USER` / `ADMIN` |
| `email_verified_at` | `timestamptz` NULL | |
| `cross_chat_memory_enabled` | `boolean` NOT NULL DEFAULT true | уровень 3; окно и сводка чата не зависят |
| `created_at`, `updated_at` | `timestamptz` | |

### `refresh_tokens`

`id`, `user_id` FK, `token_hash` (хранится хеш, не сам токен), `expires_at`, `revoked_at`, `user_agent`, `ip`. Ротация при каждом обновлении, обнаружение переиспользования отозванного токена → отзыв всей семьи токенов.

### `user_profiles`

Структурированный профиль соискателя: `user_id` PK/FK, `headline`, `about`, `seniority` (enum), `desired_roles` (`text[]`), `preferred_work_format` (enum[]), `preferred_employment` (enum[]), `preferred_locations` (`int[]` → `locations`), `salary_expectation_min`, `currency`, `education`, `profile_embedding` `vector(1024)`.

`profile_embedding` — центроид профиля, используется для персонализации (шаг S5) и для сценария «покажи, что мне подходит» без явного запроса.

### `user_profile_skills`

Связь пользователя с графом навыков: `user_id`, `skill_id`, `level` (enum `BASIC`/`CONFIDENT`/`EXPERT`), `years`, `source` (`SELF_REPORTED` / `EXTRACTED_FROM_CHAT` / `EXTRACTED_FROM_RESUME`), `confidence` (0..1). PK `(user_id, skill_id)`.

Поле `source` важно: навык, вытащенный LLM из переписки, и навык, указанный вручную, — это разный уровень доверия, и в UI они помечаются по-разному.

### `user_memories`

Долговременная память (подробно — [07-auth-and-memory.md](07-auth-and-memory.md)):

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | |
| `kind` | `memory_kind` enum | `PREFERENCE` / `CONSTRAINT` / `FACT` / `GOAL` |
| `content` | `text` | формулировка факта |
| `embedding` | `vector(1024)` | для семантического извлечения |
| `confidence` | `real` | 0..1 |
| `source_message_id` | `uuid` FK NULL | провенанс: откуда взято |
| `is_pinned` | `boolean` | закреплено пользователем вручную |
| `expires_at` | `timestamptz` NULL | для временных фактов |
| `revoked_at` | `timestamptz` NULL | пользователь удалил |

Провенанс (`source_message_id`) и возможность удаления — обязательны: пользователь должен видеть, откуда система это взяла, и иметь возможность стереть.

---

## 3. Диалоги

### `chats`

`id`, `user_id` FK, `title` (генерируется LLM по первому сообщению), `summary` (mid-term память, обновляется каждые N сообщений), `summary_updated_at`, `message_count`, `is_archived`, `created_at`, `updated_at`.

### `messages`

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `uuid` PK | |
| `chat_id` | `uuid` FK | |
| `role` | `message_role` enum | `USER` / `ASSISTANT` / `SYSTEM` |
| `content` | `text` | |
| `intent` | `jsonb` NULL | сохранённый `SearchIntent` для user-сообщений |
| `diagnostics` | `jsonb` NULL | шаги релаксации, веса ветвей, тайминги |
| `token_usage` | `jsonb` NULL | учёт стоимости |
| `created_at` | `timestamptz` | |

`intent` и `diagnostics` в `jsonb` — это ровно та информация, которая в курсовой 2026 вычислялась и выбрасывалась. Здесь она сохраняется и становится материалом для главы 4.

### `message_vacancies`

Какие вакансии были показаны в ответ на сообщение: `message_id`, `vacancy_id`, `rank`, `score`, `explanation` (`jsonb` — тот самый `MatchExplanation`), `retrieved_by` (`text[]` — какие ветви нашли). PK `(message_id, vacancy_id)`.

Хранение объяснения снимком, а не пересчётом: выдача воспроизводима при повторном открытии чата, даже если корпус изменился.

### `search_logs`

Телеметрия поиска для главы 4: `id`, `user_id` NULL, `message_id` NULL, `raw_query`, `intent` `jsonb`, `branch_timings` `jsonb`, `candidate_counts` `jsonb`, `total_latency_ms`, `rerank_applied`, `relaxation_steps` `jsonb`, `created_at`.

---

## 4. Избранное

### `collections`

`id`, `user_id` FK, `name`, `description`, `is_default`, `created_at`.

### `favorites`

`id`, `user_id` FK, `vacancy_id` FK, `collection_id` FK NULL, `note` `text`, `added_by` (enum `USER` / `ASSISTANT` — кто добавил: пользователь или LLM по предложению), `created_at`. UNIQUE `(user_id, vacancy_id)`.

**Нет трекера статуса отклика** (Q15 → диплом). Favorites = список сохранённых вакансий для просмотра, не CRM.

### `user_documents`

Библиотека пользователя (ADR-024, поведение — [11-hira.md](11-hira.md)). Отдельной `user_resumes` нет: резюме — строка с `kind = RESUME`.

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | изоляция хранилища |
| `kind` | `document_kind` enum | `RESUME` / `PREFERENCES` / `LETTER` / `SCRIPT` / `NOTE` |
| `title` | `varchar(256)` | |
| `format` | `document_format` enum | `PDF` только у `RESUME`; остальные — `MD` / `TXT` |
| `storage_path` | `varchar(1024)` | файл на томе, `storage/{userId}/{documentId}` |
| `content_hash` | `char(64)` | повторный разбор резюме |
| `extracted_text` | `text` | текст PDF или тело md/txt — то, что видит Hira |
| `embedding` | `vector(1024)` NULL | отбор в контекст, не гибридный retrieval |
| `is_pinned` | `boolean` | закреплённые всегда в контексте; резюме и предпочтения — да по умолчанию |
| `created_by` | `document_author` enum | `USER` / `ASSISTANT` |
| `parse_status` | `parse_status` enum NULL | для PDF: `PENDING` / `SUCCESS` / `FAILED` |
| `created_at`, `updated_at` | `timestamptz` | |

Чужой `user_id` в выборку не попадает. Удаление аккаунта удаляет строки и файлы.

### `call_sessions` и `call_turns`

Голосовой вызов не является чатом (ADR-025).

`call_sessions`: `id`, `user_id` FK, `started_at`, `ended_at` NULL, `created_at`.

`call_turns`: `id`, `session_id` FK, `role` (`USER` / `ASSISTANT`), `content` (транскрипт), `results` `jsonb` NULL (снимок карточек, если был поиск), `created_at`.

В `chats` эти строки не пишутся. Извлечение памяти идёт из `content`, только если `users.cross_chat_memory_enabled`.

---

## 5. Вакансии

### `vacancies`

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `uuid` PK | |
| `source` | `vacancy_source` enum | `RABOTA_BY` / `GSZ` / `HABR_CAREER` / `PRACA_BY` / `LINKEDIN` / `INDEED` |
| `language` | `char(2)` | `ru` / `en`; определяет конфигурацию FTS |
| `external_id` | `varchar(128)` | id в источнике |
| `url` | `varchar(2048)` | |
| `title` | `varchar(512)` NOT NULL | |
| `company_id` | `uuid` FK NULL | |
| `location_id` | `int` FK NULL | |
| `description` | `text` | очищенный Markdown |
| `description_raw` | `text` | исходный HTML, на случай перепарсинга |
| `seniority` | `seniority_level` enum NULL | |
| `employment` | `employment_type` enum NULL | |
| `work_format` | `work_format` enum NULL | |
| `schedule` | `varchar(128)` NULL | |
| `salary_min`, `salary_max` | `numeric(12,2)` NULL | |
| `salary_currency` | `char(3)` NULL | |
| `salary_min_byn`, `salary_max_byn` | `numeric(12,2)` NULL | приведённые, для сравнимой фильтрации |
| `is_gross` | `boolean` NULL | |
| `rate_amount` | `numeric(12,2)` NULL | ставка для фриланса/проектной занятости |
| `rate_unit` | `rate_unit` enum NULL | `HOUR` / `DAY` / `PROJECT` |
| `project_duration_days` | `int` NULL | длительность проекта, если указана |
| `is_foreign_remote` | `boolean` | зарубежная удалённая (Q30); фильтр в UI |
| `status` | `vacancy_status` enum | `ACTIVE` / `EXPIRED` / `CLOSED` / `DUPLICATE` |
| `published_at` | `timestamptz` | |
| `first_seen_at`, `last_seen_at` | `timestamptz` | |
| `content_hash` | `char(64)` | детекция изменений |
| `skills_extracted_at` | `timestamptz` NULL | NULL → в очередь на извлечение |
| `embedding` | `vector(1024)` NULL | NULL → в очередь на векторизацию |
| `search_vector` | `tsvector` GENERATED | для лексической ветви |
| `created_at`, `updated_at` | `timestamptz` | |

Ограничения и индексы:

```sql
UNIQUE (source, external_id);
CREATE INDEX idx_vac_emb_hnsw ON vacancies USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_vac_fts ON vacancies USING gin (search_vector);
CREATE INDEX idx_vac_status_seen ON vacancies (status, last_seen_at DESC);
CREATE INDEX idx_vac_filters ON vacancies (status, seniority, work_format, employment);
CREATE INDEX idx_vac_title_trgm ON vacancies USING gin (title gin_trgm_ops);
```

`search_vector` — генерируемая колонка со взвешиванием: `setweight(to_tsvector(<cfg>, title), 'A') || setweight(..., skills, 'B') || setweight(..., company, 'C') || setweight(..., description, 'D')`, где `<cfg>` выбирается по `language` (`russian` или `english`). Поскольку генерируемая колонка в PostgreSQL требует `IMMUTABLE`-выражения, конфигурация подставляется через обёртку-функцию с явным `CASE` по языку, а не через переменную.

Двуязычие корпуса — прямое следствие подключения LinkedIn и Indeed, см. [03-data-sources.md](03-data-sources.md), п. 1.5.

### `vacancy_chunks`

Чанки описания для плотного поиска: `id`, `vacancy_id` FK, `chunk_index`, `content`, `embedding` `vector(1024)`, `token_count`. HNSW-индекс по `embedding`. UNIQUE `(vacancy_id, chunk_index)`.

### `companies`

`id`, `name`, `normalized_name` (для дедупа), `unp` (УНП, если удалось извлечь), `website`, `industry_id` FK NULL, `logo_url`, `description`. Индекс `gin (normalized_name gin_trgm_ops)`.

### `locations`

`id` serial, `region`, `city`, `parent_id` (самоссылка для иерархии «область → город»), `lat`, `lon`.

### `vacancy_duplicates`

`canonical_vacancy_id` FK, `duplicate_vacancy_id` FK, `similarity`, `detected_by` (enum `EXACT` / `FUZZY` / `EMBEDDING`), `created_at`. PK `(canonical_vacancy_id, duplicate_vacancy_id)`.

---

## 6. Граф знаний

Это структурное отличие от курсовой 2026, где графа не было вовсе.

### `skills`

| Колонка | Тип | Комментарий |
|---|---|---|
| `id` | `int` serial PK | |
| `canonical_name` | `varchar(256)` UNIQUE | канон: «Kubernetes» |
| `skill_type` | `skill_type` enum | `HARD` / `SOFT` / `TOOL` / `LANGUAGE` / `DOMAIN` |
| `esco_uri` | `varchar(256)` NULL | привязка к таксономии, если есть |
| `description` | `text` NULL | |
| `embedding` | `vector(1024)` | для нечёткого линковки навыков |
| `idf` | `real` | обратная частота по корпусу, пересчитывается ночью |
| `vacancy_count` | `int` | денормализация для быстрой статистики |
| `needs_review` | `boolean` | автосозданный узел, не проверенный человеком |

### `skill_aliases`

`id`, `skill_id` FK, `alias`, `lang` (`ru` / `en`), `source` (`ESCO` / `ESCO_TRANSLATED` / `MANUAL` / `LLM`). UNIQUE `(alias, lang)`. Индекс `gin (alias gin_trgm_ops)`.

Таблица двуязычная по построению: у одного узла `Kubernetes` будут алиасы `kubernetes`, `k8s` (en) и `кубернетес`, `к8с` (ru). Это то, что связывает англоязычные вакансии LinkedIn/Indeed с русскоязычными запросами через один и тот же узел графа. Значение `ESCO_TRANSLATED` помечает метки, полученные машинным переводом, — их качество отслеживается отдельно и они первыми идут на ручную вычитку.

### `skill_edges` — рёбра графа

| Колонка | Тип | Комментарий |
|---|---|---|
| `source_skill_id` | `int` FK | |
| `target_skill_id` | `int` FK | |
| `edge_type` | `skill_edge_type` enum | `ALTERNATIVE_OF` / `BROADER` / `NARROWER` / `RELATED_TO` / `PREREQUISITE_OF` |
| `weight` | `real` | 0..1 |
| `evidence` | `varchar(64)` | `TAXONOMY` / `COOCCURRENCE` / `LLM` |

PK `(source_skill_id, target_skill_id, edge_type)`. Индексы по обоим направлениям — обход идёт в обе стороны.

`RELATED_TO` считается из корпуса: для пары навыков берётся нормализованная поточечная взаимная информация (PMI) по совместной встречаемости в вакансиях, рёбра ниже порога отбрасываются. Это заменяет три зашитых доменных словаря из курсовой 2026 обоснованной статистикой.

### `vacancy_skills`

`vacancy_id` FK, `skill_id` FK, `importance` (enum `REQUIRED` / `PREFERRED` / `MENTIONED`), `weight` (0..1), `evidence_span` (`text` — цитата из описания, обоснование извлечения). PK `(vacancy_id, skill_id)`.

`evidence_span` — это то, что позволяет в UI показать «требуется Docker, потому что в описании: "опыт контейнеризации приложений (Docker)"». Объяснимость без галлюцинаций.

### `occupations`, `occupation_skills`, `occupation_transitions`

- `occupations`: `id`, `canonical_name`, `esco_uri`, `embedding`, `description`.
- `occupation_skills`: `occupation_id`, `skill_id`, `typicality` (0..1) — насколько навык характерен для профессии.
- `occupation_transitions`: `from_occupation_id`, `to_occupation_id`, `frequency`, `skill_gap` (`int[]` — каких навыков не хватает для перехода). Основа сценария US-6 «куда расти».

### Пример обхода (S1c) на рекурсивном CTE

```sql
WITH RECURSIVE expanded AS (
    SELECT id AS skill_id, 1.0::real AS w, 0 AS hop
    FROM skills WHERE id = ANY($1)

    UNION ALL

    SELECT e.target_skill_id,
           x.w * e.weight * CASE e.edge_type
               WHEN 'ALTERNATIVE_OF' THEN 1.0
               WHEN 'NARROWER'       THEN 0.8
               WHEN 'RELATED_TO'     THEN 0.6
               ELSE 0.4 END,
           x.hop + 1
    FROM expanded x
    JOIN skill_edges e ON e.source_skill_id = x.skill_id
    WHERE x.hop < 2 AND x.w > 0.25
)
SELECT vs.vacancy_id,
       SUM(x.w * vs.weight * s.idf) / NULLIF(SUM(s.idf), 0) AS coverage_score
FROM (SELECT skill_id, MAX(w) AS w FROM expanded GROUP BY skill_id) x
JOIN vacancy_skills vs ON vs.skill_id = x.skill_id
JOIN skills s          ON s.id = x.skill_id
JOIN vacancies v       ON v.id = vs.vacancy_id AND v.status = 'ACTIVE'
GROUP BY vs.vacancy_id
ORDER BY coverage_score DESC
LIMIT 100;
```

Ограничения `hop < 2` и `w > 0.25` — защита от «расползания» графа, о которой предупреждают обзоры GraphRAG.

---

## 7. Служебное

### `ingestion_runs`

`id`, `source`, `job_type`, `started_at`, `finished_at`, `status` (`RUNNING` / `SUCCESS` / `PARTIAL` / `FAILED`), `fetched`, `created`, `updated`, `skipped`, `failed`, `errors` `jsonb`.

### `feedback`

Явный сигнал качества от пользователя: `id`, `user_id`, `message_id`, `vacancy_id` NULL, `rating` (enum `RELEVANT` / `IRRELEVANT`), `comment`, `created_at`.

Это не только продуктовая фича — это ещё и способ бесплатно собрать часть разметки для бенчмарка главы 4.

---

## 8. Оценка объёма

При 15 000 вакансий (целевой размер скорректирован вниз с 20 000 — см. [02-retrieval-layer.md](02-retrieval-layer.md), п. 4.0: индексация идёт на CPU):

| Данные | Оценка |
|---|---|
| `vacancies` (текст) | ~90 МБ |
| `vacancies.embedding` (1024 × float4) | 15 000 × 4 КБ ≈ 60 МБ |
| `vacancy_chunks` (~3 чанка на вакансию) | 45 000 × 4 КБ ≈ 180 МБ |
| HNSW-индексы | ~1.5× от векторов ≈ 360 МБ |
| Граф (`skills` ~8 000, `skill_edges` ~150 000, `vacancy_skills` ~220 000) | ~50 МБ |
| **Итого** | **~750 МБ** |

Для локального PostgreSQL — нормально, 32 ГБ RAM на машине разработки позволяют держать рабочий набор в кэше.

**Время построения индекса важнее размера.** 60 000 эмбеддингов при 10 шт/с на CPU — около 1.7 часа. Практические следствия:

- полная переиндексация запускается на ночь, а не по ходу отладки;
- на время разработки держим отдельный «малый» снимок корпуса на 1000–2000 вакансий, на котором прогоняются тесты и итерации;
- в абляциях сравниваем не больше двух энкодеров, иначе переиндексация съест дни.

---

## 9. Открытые вопросы

Закрыты: Q7 (resume upload → документ `RESUME` в `user_documents`), Q15 (нет status tracker в курсовой), Q30 (`is_foreign_remote`), Q34–Q38 (Hira, библиотека, вызов, выключатель памяти, дипломный автоотклик) — [11-hira.md](11-hira.md).
