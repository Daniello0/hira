# Этап 12. План до кода

Статус на момент плана: кода памяти, библиотеки и вызова ещё нет. Таблицы и сущности уже созданы миграцией этапа 3. Уровень 1 (окно 10) уже читает этап 11 и в промпт кладёт пустую память.

Этап 12 в журнале: «3-tier memory, выключатель межчатовой памяти, библиотека PDF/md/txt, call sessions, profile suggestions». Источник фактов — `Wiki/07-auth-and-memory.md` §3–4, `Wiki/11-hira.md` §4.2–4.4, `Wiki/05-api-contracts.md` §1.5 и §1.8 и §3, `Wiki/04-data-model.md` §2–4, `Wiki/01-architecture.md` §2.2 и §4, ADR-008, ADR-016, ADR-021, ADR-024, ADR-025, ADR-026, ADR-032. Где статьи спорят или колонки не хватает, в код идёт рекомендация из §6, если обсуждение PR её не заменит.

## 1. Задача

Цель: зарегистрированный пользователь получает три уровня памяти, может выключить межчатовую, хранит PDF/md/txt и говорит с Hira вызовом, который не становится чатом. Навык и предпочтение из диалога или резюме попадают в профиль только после подтверждения.

Чек-лист. Каждый пункт — цитата журнала или статьи, не догадка.

- Три уровня. «Последние `WORKING_WINDOW_SIZE` (стартово **10**) сообщений» дословно в `understand` и `generate`. Сводка: «новая сводка = f(старая сводка, вытесненные сообщения)», формат из четырёх блоков, пересборка каждые **8** сообщений. Долгая память: `confidence < 0.7` отбрасывается, дубликат при косинусе выше 0.9, `CONTRADICTS` ставит `revoked_at` и пишет новый факт, в контекст — все `CONSTRAINT`, все закреплённые и top-5 остальных. `GOAL` живёт 90 дней — `Wiki/07-auth-and-memory.md` §3.1–3.3.
- Извлечение не блокирует ответ. «асинхронно (fire-and-forget, не блокируя ответ)» и шаг 7 архитектуры — `Wiki/01-architecture.md` §4.
- Выключатель. «`users.cross_chat_memory_enabled`, по умолчанию true. Выключено — факты не читаются и не пишутся; окно и сводка текущего чата остаются; накопленные факты не стираются сами. Библиотека от этой настройки не зависит. Флаг реплики `useMemory: false` сохраняется» — ADR-026. То же в `Wiki/11-hira.md` §4.2.
- Экран памяти на бэкенде. «видит всё, что о нём сохранено, включая источник»; удалить один факт и «всю память можно стереть» — `Wiki/07-auth-and-memory.md` §4. Маршруты — таблица `Wiki/05-api-contracts.md` §1.5.
- Профиль не равен памяти. «Автоматического перетекания памяти в профиль нет — только предложение пользователю подтвердить» — ADR-008. «Навык, извлечённый из диалога… может быть предложен»; то же для формата, зарплаты и локации — `Wiki/07-auth-and-memory.md` §3.5. Журнал: «profile suggestions».
- Резюме. «извлекает текст локально, вызывает `llm-service` `/parse-resume`». Принятые навыки → `user_profile_skills` с `source=RESUME`. «Повторный парсинг того же файла — из кэша по hash». Файл остаётся документом `RESUME` — `Wiki/07-auth-and-memory.md` §3.6, ADR-024.
- Библиотека. «PDF — только резюме, загружает пользователь. md/txt создаёт пользователь или Hira, запись после подтверждения. В контекст попадают закреплённые файлы и несколько ближайших по эмбеддингу, без отдельного гибридного поиска». «Demo-сессии библиотеки нет» — ADR-024. Путь `storage/{userId}/{documentId}` — `Wiki/11-hira.md` §4.3.
- Вызов. «Сессия не попадает в список чатов; транскрипт — `call_sessions` / `call_turns`». Речь — в браузере. «Поиск вакансий переиспользует тот же пайплайн, что чат, и только такая реплика списывает дневной лимит. Вызов — для зарегистрированных» — ADR-025. «Реплика вызова списывает дневной лимит только если запустила поиск» — `Wiki/05-api-contracts.md` §1.6.
- Демо. «Библиотека и вызов demo недоступны» — §1.6. «Всё ниже требует аккаунта; demo-сессия получает `403`» — §1.8.
- В промпт внешней модели не уходят email и id пользователя — `Wiki/07-auth-and-memory.md` §4.
- Журнал этапа: «Память, библиотека, вызов (backend)».

Поверхности, которые этап не называет: телефон, второй пользователь одновременно, офлайн, язык интерфейса, распознавание речи. Демо и аккаунт названы отдельно. Речь остаётся в браузере, этот этап её не слышит.

## Вне этого этапа

- Экраны чата, Call, Library, Profile, Memory — этапы 13 и 14. Здесь JSON и SSE, страница не рисуется.
- `POST /internal/v1/title-chat` не вызывать. Заголовок чата остаётся обрезкой первого сообщения.
- Избранное, коллекции, feedback, карточка вакансии, skill-gap, похожие — в журнале этапа 12 нет.
- `profile_embedding` не считать. Персонализация retrieval остаётся как после этапа 11: флаг уходит, внутри ветвей не применяется.
- Понижение `confidence` «при следующем пересчёте» формулой не задано и колонки «когда подтверждался» нет. Вопрос 4. В этот заход confidence не затухает.
- MCP, автоотклик, статусы `APPLIED`, DOCX, телефония, удаление аккаунта как маршрут — нет. Каскад `ON DELETE CASCADE` уже на строках; файлы с диска снимает удаление документа, не удаление пользователя.
- Источники 4–6 и бенчмарк — этапы 15 и 16. `POST /api/v1/search` память и файлы не читает.
- `Wiki/` этим планом не менять.

## 2. Что уже есть

Переиспользовать как есть:

- Таблицы и сущности уже есть, `synchronize: false`. `users.cross_chat_memory_enabled` default true (`schema-statements.ts`, `usersTable`, около строки 195; `user.entity.ts`). `user_memories`, `user_documents`, `call_sessions`, `call_turns`, `user_profiles`, `user_profile_skills` — `schema-statements.ts` и сущности в `apps/core-api/src/features/user/` и `features/call/`. HNSW `vector_cosine_ops` уже на `user_memories.embedding` и `user_documents.embedding` (`hnswIndex`, около строки 619). Нового векторного индекса не нужно.
- Enum уже в `packages/contracts`: `MemoryKind`, `DocumentKind`, `DocumentFormat`, `ParseStatus`, `AuthorKind`, `ProfileSkillSource`, `SkillLevel`. `MemoryFactDto` уже описывает факт без эмбеддинга (`memory-fact.dto.ts`).
- Окно 10 уже режется: `WORKING_WINDOW_SIZE` (`chat.constants.ts:2`), `promptHistory` (`history-window.ts`). Ход чата уже пишет user-сообщение, зовёт understand с `memory: []`, затем retrieval и generate (`orchestrate-search.ts`, `resolveIntent` около строки 145). Квоту списывают `SEARCH`, `REFINE`, `COMPARE`. Сбой understand — эвристика. Сбой generate — карточки без текста. Сбой retrieval — `error`. Этот порядок не переставлять.
- `CreateMessageRequest.useMemory` уже в контракте (`create-message-request.dto.ts`) и в `chat.dto.ts`. Этап 11 поле принимает и не применяет. Здесь оно начинает работать.
- `GET /api/v1/auth/me` уже отдаёт `crossChatMemoryEnabled` (`current-user.dto.ts`, `toCurrentUser` в `user.store.ts`). Колонка читается из `users` (`typeorm-user.store.ts`). Отдельный GET настройки не нужен: экран читает `/me`, запись — `PATCH /api/v1/settings/memory`.
- Квота — `SearchQuotaService`. Вызов списывает тот же счётчик, второго лимита нет.
- Внутренний вызов llm: `upstream-gateway.ts`, таймаут 25 с, заголовок `X-Internal-Token`. Ретраи и json_schema живут в llm-service, бюджет 20 с (`llm.constants.ts`). Образец маршрута со схемой — `extract-skills` (`extract-skills.schema.ts`, `llm.router.ts`). Кэш Redis по хешу — `prompt-cache.ts`, TTL understand 24 ч. `parse-resume` кэшируется так же, ключ — SHA-256 текста резюме.
- Каскад навыка по имени уже есть у retrieval: точное имя, точный алиас, триграмм `similarity >= 0.8` (`load-link-hits.ts`, `TRIGRAM_MATCH_THRESHOLD` в `search.constants.ts:54`). core-api этот модуль не импортирует. Порог копируется константой, SQL — своим запросом. Векторный шаг каскада не повторять: эмбеддинги навыков могут быть пустыми, а имя резюме обычно совпадает буквально.
- TEI `/embed` уже описан дважды, пакета общего нет. Тело `{ inputs, truncate: true }`, ширина 1024 (`retrieval-service` `embed-query.ts` около строк 14–34; `ingestion-service` `embed-client.ts`). core-api получает третий тонкий клиент с тем же телом. Чужой сервис не импортировать.
- Демо и аккаунт уже различает `resolveCaller` (`resolve-actor.ts`). Bearer важнее cookie. Нет ни того ни другого — `401`. Чужой чат — `404`.
- Ошибки наружу — `ApiHttpException` и `ApiErrorResponse` (`api-http.exception.ts`).

Не переиспользовать:

- `memory: []` как постоянное поведение. Это заглушка этапа 11.
- Запись файла из модели без `POST`/`PATCH` документа. «не отдельный тихий эндпоинт» — `Wiki/05-api-contracts.md` §1.8.
- `message_vacancies` для вызова. Снимок карточек вызова — `call_turns.results` jsonb (`schema-statements.ts`, `callTurnsTable`).
- Клиент эмбеддингов retrieval и ingestion как import. Граница сервисов — копия тела запроса, не общий пакет.
- DOCX и `pdf-parse`. ADR-024 оставляет один путь, PDF. `unpdf` 1.9.0 — MIT (`npm view unpdf license`).

Открытых PR нет (`gh pr list --state open` пуст).

## 3. Решение

Один дирижёр хода остаётся в `core-api`. llm-service получает три маршрута. Retrieval не меняется. Поиск вакансий по-прежнему не знает про файлы и факты: они попадают в промпт до understand.

Кто вызывает новые маршруты §1.5 и §1.8. Только аккаунт. Демо-cookie на библиотеке, вызове, памяти, профиле, предложениях и `PATCH` настройки — `403` `ACCOUNT_REQUIRED`. Нет Bearer и нет демо — по-прежнему `401`. Чужой id — `404`.

### Память в ходе чата

Сборка контекста стоит до `POST /understand` и не открывает поток заново. Окно — как сейчас, 10 предыдущих реплик, текущий текст в `query`.

Сводка чата уходит отдельным полем `summary`, не репликой истории. Иначе окно перестанет быть десятью сообщениями.

Межчатовая память читается только если одновременно: вызывающий — аккаунт, `users.cross_chat_memory_enabled`, у этой реплики `useMemory !== false`. Иначе `memory: []`. Уже записанные строки не трогать. Демо факты не читает и не пишет: у демо нет строки `users`.

В `memory[]` по-прежнему только `{ content }`, как ждёт `UnderstandRequest`. Состав:

- все живые `CONSTRAINT`;
- все живые закреплённые, без повтора id;
- до 5 остальных живых, у которых эмбеддинг не пуст, по косинусу к эмбеддингу текущей реплики.

Живой факт: `revoked_at IS NULL` и (`expires_at IS NULL` или `expires_at > now()`). Косинус — `1 - (embedding <=> query)`. Набор одного пользователя маленький, поэтому это точный `ORDER BY`, не поиск по HNSW. Индекс HNSW остаётся как есть.

Эмбеддинг реплики считает core-api через TEI. TEI молчит, URL пуст или вектор короче 1024 — в промпт всё равно идут ограничения и закреплённые, top-5 пропускается, ход не становится `error`. То же для документов ниже.

Документы в `memory[]` не класть. «Их нельзя сливать в одну память» — `Wiki/11-hira.md` §3. Они уходят полем `documents: { title, kind, content }[]`. Туда входят все закреплённые этого пользователя и до 3 незакреплённых с непустым эмбеддингом, ближайших к той же реплике. Общий бюджет текста — 12 000 символов: сначала закреплённые, потом ближайшие, каждый хвост обрезается. Библиотека читается и при выключенной памяти, и при `useMemory: false`.

`generate` получает те же `summary` и `documents`, что ушли в understand, плюс прежние `intent`, `results`, `history`. Иначе ответ «по моему резюме» не видит файл. Email и id пользователя в эти поля не попадают.

`POST /api/v1/search` этот контекст не собирает.

### Сводка

После `event: done`, не до него. Условие: `message_count` чата больше 10 и делится на 8. В сводку уходит прежний `chats.summary` и все сообщения вне текущей десятки, не только «новые с прошлого раза». Так пропущенный пересчёт не теряет вытесненное, и отдельная колонка курсора не нужна. Вопрос 5.

llm-service возвращает четыре строки и сам склеивает текст шаблона из §3.2. В `chats.summary` пишется уже склейка, плюс `summary_updated_at`. Сбой маршрута оставляет старую сводку и пишется в лог. Демо-чат сводку получает: это уровень чата, не межчатовая память.

### Запись фактов

После `done`, тем же несблокированным хвостом, если межчатовую память читать было можно. Модель получает последние реплики обмена (user и assistant этого хода) и уже живые факты `{ id, kind, content }`. Ответ — кандидаты и предложения профиля. Вопрос 3.

Запись кандидата:

- `confidence < 0.7` — мимо;
- `ADD`: эмбеддинг текста; если косинус к живому факту этого пользователя выше 0.9 — мимо как дубликат;
- `UPDATE`: цель принадлежит этому пользователю и жива; меняются `content`, `kind`, `confidence`, эмбеддинг; чужой или пустой `targetMemoryId` — мимо;
- `CONTRADICTS`: у цели `revoked_at = now()`, затем правила `ADD` для нового текста;
- `GOAL` получает `expires_at = now() + 90 дней`, остальные виды — `NULL`;
- провенанс — id user-сообщения этого хода.

TEI на записи молчит — факт сохраняется с `embedding NULL`, проверка дубликата пропускается. На экране он виден, в top-5 не попадёт, пока вектор не появится. Повтора эмбеддинга очередью нет.

Хвост одного пользователя сериализуется в памяти процесса: второй ход не читает факты, пока первый хвост не дописал. Два реплики `core-api` этим не закрываются; в Compose процесс один.

### Выключатель и флаг реплики

`PATCH /api/v1/settings/memory` с `{ crossChatMemory: boolean }` пишет колонку. Ответ — тот же объект. Следующий `GET /auth/me` уже видит значение. Токен не перевыпускается: флага в JWT нет.

`useMemory` отсутствует — это `true`. `false` на одном сообщении не читает и не пишет факты, даже если настройка включена. Значение хранится. Колонки под него в `messages` нет — вопрос 1.

`DELETE /api/v1/memory/{id}` ставит `revoked_at`, строку не стирает: так записан конфликт. `DELETE /api/v1/memory` делает это всем живым фактам пользователя. `GET` возвращает строки с `revoked_at IS NULL`, включая просроченные цели, чтобы их можно было стереть руками. В промпт просроченные не идут.

`PATCH /api/v1/memory/{id}` принимает `content` и `isPinned`. Новый текст заново эмбеддится. Уверенность не меняется. Закрепление вектор не трогает.

### Библиотека

`POST /api/v1/documents` двух тел.

JSON, без файла: `kind` один из `PREFERENCES` / `LETTER` / `SCRIPT` / `NOTE`, `format` `MD` или `TXT`, `title`, `content`. `created_by = USER`. `PREFERENCES` закреплены сразу. Остальные — нет.

`multipart`, поле `file`: это резюме. `kind` только `RESUME`, `format` только `PDF`. Иной kind — `400`. Размер больше 10 МиБ — `400`. Текст вынимает `unpdf` локально, файл в OpenRouter не уходит. Пустой текст — `400`, строка не создаётся. `content_hash` — SHA-256 извлечённого текста. `is_pinned = true`. `parse_status` стартует `PENDING`.

Файл пишется в `LIBRARY_ROOT/{userId}/{documentId}`. В колонке путь как в статье: `storage/{userId}/{documentId}`. В Docker `LIBRARY_ROOT=/app/storage`, том смонтирован туда. Рабочий каталог процесса — `/app/apps/core-api` (`node-service.Dockerfile`), поэтому относительный `storage/` от cwd не использовать. Каталог создаётся при записи. Удаление документа снимает и строку, и файл. Чужой `userId` в путь не подставляется: id берётся из токена, документ — uuid, который выдаём мы.

После вставки PDF вызывается `parse-resume`. Успех — `parse_status SUCCESS` и предложения. Сбой llm — файл остаётся, статус `FAILED`, предложений нет, `POST` всё равно `201`: документ уже лежит. Повтор того же текста бьёт в Redis-кэш llm-service на 24 ч, вторую строку библиотеки это не запрещает.

`GET /documents` — список без тела: id, kind, title, format, isPinned, parseStatus, createdAt. `GET /documents/{id}` добавляет `extractedText`. `PATCH` меняет `title` и `isPinned` у любого файла; `content` — только у md/txt, тогда обновляются текст, хеш и эмбеддинг. Правка тела PDF — `400`. `DELETE` — `204`.

Эмбеддинг документа считается после записи текста, тем же TEI. Сбой оставляет `embedding NULL`: закреплённый файл в контекст всё равно попадает, ближайшим он не станет.

Hira не пишет файл сама. Текст письма остаётся в ответе ассистента. Клиент после подтверждения зовёт обычный `POST` или `PATCH`. Отдельного маршрута «сохрани молча» нет.

### Профиль и предложения

`GET`/`PUT /api/v1/profile` и `GET`/`POST`/`DELETE /api/v1/profile/skills` входят в этап: предложение некуда принять, если профиля нельзя прочитать и записать. Журнал называет предложения, таблица §1.5 кладёт профиль рядом. Вопрос 8. `profile_embedding` остаётся `NULL`.

`PUT` создаёт строку `user_profiles`, если её не было, и заменяет присланные поля. Навык руками — `source = SELF_REPORTED`, `confidence = 1`, уровень обязателен. Повторный `POST` того же `skill_id` — `409`.

Предложения живут в новой таблице `profile_suggestions`. Вопрос 1. `GET /api/v1/profile/suggestions` отдаёт только `PENDING`. `dismiss` ставит `DISMISSED` и профиль не трогает. `accept`:

- `SKILL` — вставка в `user_profile_skills`. Если строка уже есть с `SELF_REPORTED`, она не перезаписывается, предложение всё равно `ACCEPTED`. Иначе уровень из предложения или `CONFIDENT`, источник — `EXTRACTED_FROM_CHAT` или `EXTRACTED_FROM_RESUME`, уверенность из предложения. `skill_id` уже разрешён в момент создания. Неразрешённое имя в список не попадает.
- `WORK_FORMAT`, `EMPLOYMENT`, `ROLE` — добавить значение в массив профиля, если его там нет.
- `SALARY` — записать `salary_expectation_min` и `currency`.
- `LOCATION` — id из `locations`, подобранный по городу. Нет города — предложение не создаётся.
- `EDUCATION` — дописать текст к `education`. Опыт из резюме иначе некуда класть: отдельной таблицы стажа нет. Вопрос 7.

Имя навыка режется тем же порогом 0.8: точное имя, точный алиас, иначе лучший триграмм. Ничья — меньший `skill_id`.

Повтор того же живого предложения (тот же user, kind и jsonb) не создаёт вторую строку.

Откуда предложения. Хвост `extract-memory` несёт `suggestions[]` рядом с фактами: навык, формат, занятость, зарплата, город, роль. Один вызов модели, не второй. `parse-resume` несёт `skills[]` и `experience[]`; опыт становится `EDUCATION`.

### Вызов

`POST /api/v1/calls` создаёт сессию: `started_at = now()`, `ended_at NULL`. В `chats` строка не пишется.

`POST /api/v1/calls/{id}/turns` с `{ content, useMemory? }` открывает тот же SSE, что сообщение чата: `user-message → intent → results → token → assistant-message → done`. Имена событий не переименовывать — §1.8 просит тот же набор. История — последние 10 реплик этой сессии. Сводки у вызова нет: колонки нет. Вопрос 9.

Поиск, квота, эвристика understand и карточки без текста — тот же код, что у чата. Порт другой: реплики пишутся в `call_turns`, карточки — в `results` jsonb ассистента (тело `VacancyResult` на момент хода). `search_logs.message_id` остаётся `NULL`, `raw_query` — текст реплики, `user_id` — аккаунт.

Завершённая сессия на новую реплику — `400`. `POST .../end` ставит `ended_at`. Повторный end — `200` и прежнее время. Чужая сессия — `404`.

Факты из вызова пишутся тем же хвостом, провенанс — id user-реплики вызова, не `messages`. Библиотека в промпт вызова входит.

Речь не синтезируется и не распознаётся. Субтитры — это `content` реплик.

## 4. Архитектура

### Файлы

Новые, рядом с тестом:

- `packages/contracts/src/common/enums/memory-operation.enum.ts` — `ADD`, `UPDATE`, `CONTRADICTS`.
- `packages/contracts/src/common/enums/profile-suggestion-kind.enum.ts` — `SKILL`, `WORK_FORMAT`, `EMPLOYMENT`, `SALARY`, `LOCATION`, `ROLE`, `EDUCATION`.
- `packages/contracts/src/common/enums/profile-suggestion-status.enum.ts` — `PENDING`, `ACCEPTED`, `DISMISSED`.
- `packages/contracts/src/common/dto/llm/summarize-chat.dto.ts`
- `packages/contracts/src/common/dto/llm/extract-memory.dto.ts`
- `packages/contracts/src/common/dto/llm/parse-resume.dto.ts`
- `packages/contracts/src/common/dto/llm/prompt-document.dto.ts`
- `packages/contracts/src/common/dto/memory/memory-settings.dto.ts`
- `packages/contracts/src/common/dto/document/document.dto.ts`
- `packages/contracts/src/common/dto/profile/profile.dto.ts`
- `packages/contracts/src/common/dto/profile/profile-suggestion.dto.ts`
- `packages/contracts/src/common/dto/call/call.dto.ts`
- `apps/llm-service/src/features/summarize-chat/` — схема, склейка четырёх блоков, сервис.
- `apps/llm-service/src/features/extract-memory/` — схема кандидатов и предложений.
- `apps/llm-service/src/features/parse-resume/` — схема и кэш по хешу текста.
- `apps/core-api/src/features/embed/tei-embed.ts` — один `POST /embed`, ширина 1024.
- `apps/core-api/src/features/memory/` — порт фактов, отбор, применение кандидатов, контроллер, модуль, константы.
- `apps/core-api/src/features/library/` — порт документов, запись файла, текст PDF, контроллер, модуль.
- `apps/core-api/src/features/profile/` — профиль, навыки, предложения, привязка имени к `skills`.
- `apps/core-api/src/features/call/` — порт сессии поверх уже существующих сущностей, контроллер, модуль.
- `apps/core-api/src/features/search-orchestrator/assemble-context.ts` — окно уже снаружи; здесь сводка, факты, документы.
- `apps/core-api/src/features/search-orchestrator/turn-follow-up.ts` — сводка и extract после `done`.
- `apps/core-api/src/features/database/migrations/1764000000000-stage-12-memory.ts`

Меняются:

- `understand.dto.ts`, `generate-request.dto.ts` — необязательные `summary` и `documents`. Старый вызов без них остаётся валидным.
- `memory-fact.dto.ts` — `sourceCallTurnId`.
- `llm-request.schema.ts` — новые поля, иначе strict-схема ответит 400.
- `llm.router.ts`, `build-llm-router.ts`, `llm.constants.ts` — три маршрута, имена схем, префикс кэша резюме.
- `build-understand-messages.ts`, `build-generate-messages.ts` — сводка и документы отдельными блоками, не строками `memory`.
- `orchestrate-search.ts` — вместо `memory: []` результат сборки; после `done` хвост. Прямой поиск не трогать.
- `upstream-gateway.ts` — методы summarize, extract, parse.
- `user.store.ts` — `setCrossChatMemory`.
- `message.entity.ts`, `call-turn.entity.ts`, `user-memory.entity.ts` — новые колонки.
- `schema-statements.ts`, `database.constants.ts`, `entities.ts` — таблица предложений и те же колонки, чтобы новая база совпала с миграцией.
- `database.schema.test.ts` — имя таблицы в ожидаемом списке.
- `app.module.ts` — четыре модуля.
- `docker-compose.yml` — у `core-api` `TEI_EMBED_URL` и `LIBRARY_ROOT`, том `library-data` на `/app/storage`. `depends_on: tei` не добавлять: ход жив без векторов, а совместный старт TEI и так упирается в память Docker.
- `apps/core-api/package.json` — зависимость `unpdf`.

Функции короче 15–20 строк. Пороги — именованные константы, не литералы в контроллере.

### Типы

Наружу, в `packages/contracts`:

```ts
interface PromptDocument {
  title: string;
  kind: DocumentKind;
  content: string;
}

interface SummarizeChatRequest {
  previousSummary: string | null;
  messages: PromptTurn[];
}

interface SummarizeChatResponse {
  summary: string;
}

interface MemoryCandidate {
  kind: MemoryKind;
  content: string;
  confidence: number;
  operation: MemoryOperation;
  targetMemoryId?: string;
}

interface ExtractMemoryRequest {
  messages: PromptTurn[];
  existingMemory: { id: string; kind: MemoryKind; content: string }[];
}

interface ExtractMemoryResponse {
  candidates: MemoryCandidate[];
  suggestions: ProfileSuggestionDraft[];
}

interface ParseResumeRequest {
  resumeText: string;
}

interface ParseResumeResponse {
  skills: { surface: string; level: SkillLevel | null; years: number | null }[];
  experience: { text: string }[];
}

interface MemorySettings {
  crossChatMemory: boolean;
}

interface ProfileSuggestionDraft {
  kind: ProfileSuggestionKind;
  payload: Record<string, unknown>;
}
```

`sourceMessageId` в кандидата модель не кладёт: его знает только ход. `MemoryOperation` — enum, не союз строк.

Внутри:

```ts
type MemoryRead = { facts: { content: string }[] };

type FollowUp = {
  summarize: boolean;
  extract: boolean;
  userId: string | null;
  sourceMessageId: string | null;
  sourceCallTurnId: string | null;
};
```

Поиск по-прежнему запускают `IntentType.Search`, `Refine`, `Compare`.

### Источники правды

| Значение | Где живёт | Кто пишет |
| --- | --- | --- |
| Окно реплик | `messages` / `call_turns` | ход, как сейчас; сборка только читает |
| Сводка чата | `chats.summary`, `summary_updated_at` | хвост summarize; сбой не затирает |
| Факт и его вектор | `user_memories` | хвост extract и `PATCH`/`DELETE` памяти |
| Выключатель | `users.cross_chat_memory_enabled` | `PATCH /settings/memory`; читает ещё `/auth/me` |
| Флаг одной реплики | `messages.use_memory`, `call_turns.use_memory` | вставка реплики. Вопрос 1 |
| Провенанс факта | `source_message_id` или `source_call_turn_id`, не оба | хвост extract |
| Файл | том `LIBRARY_ROOT` и `user_documents` | библиотека; модель не пишет |
| Текст, который видит Hira | `user_documents.extracted_text` | PDF — unpdf; md/txt — тело запроса |
| Разбор резюме | `parse_status` и `profile_suggestions` | `parse-resume`; повтор текста — Redis llm-service |
| Предложение в профиль | `profile_suggestions` | extract, parse-resume; accept / dismiss |
| Профиль и навыки | `user_profiles`, `user_profile_skills` | `PUT`/`POST` и accept |
| Транскрипт вызова | `call_sessions`, `call_turns` | модуль вызова; в `chats` нет |
| Карточки вызова | `call_turns.results` | ход, снимок ответа retrieval |
| Квота | прежние ключи Redis | тот же `SearchQuotaService` |
| Вектор реплики | нигде, только на время хода | TEI; в таблицу запроса не пишется |

### Контракт HTTP

Наружу — маршруты §1.5 и §1.8 плюс уже существующие чаты. Новые внутренние: `POST /internal/v1/summarize-chat`, `/extract-memory`, `/parse-resume`. Тело summarize — с `previousSummary`, хотя строка в §3 этого поля не показывает: без него формула `f(старая сводка, вытесненные)` невыполнима. Вопрос 2.

События вызова — те же имена, что у чата. Ошибка до потока — JSON. Ошибка retrieval после открытия — `event: error`. Хвост памяти ошибкой потока не становится.

`understand` и `generate` принимают `summary?: string | null` и `documents?: PromptDocument[]`. Пустой список и отсутствие поля значат одно и то же.

### Миграции и выкладка

Одна миграция:

- `messages.use_memory boolean NOT NULL DEFAULT true`;
- `call_turns.use_memory boolean NOT NULL DEFAULT true`;
- `user_memories.source_call_turn_id uuid NULL REFERENCES call_turns (id) ON DELETE SET NULL`;
- проверка: не заполнены оба провенанса сразу;
- enum `profile_suggestion_kind`, `profile_suggestion_status`;
- таблица `profile_suggestions` (`user_id` CASCADE, `kind`, `status` default `PENDING`, `payload jsonb`, `source profile_skill_source`, необязательные `source_message_id`, `source_document_id`, `source_call_turn_id`, уникальность живого дубля по `(user_id, kind, payload)` где `status = PENDING`).

Старые строки получают `use_memory = true`. Фактов с двумя провенансами ещё нет.

Порядок: сначала llm-service (старый core-api новые поля не шлёт), затем миграция one-shot, затем core-api. Веб не ждёт. Пустой `TEI_EMBED_URL` процесс не роняет. Недоступный новый маршрут llm не роняет уже открытый ответ: сводка и факты просто не обновляются, PDF остаётся `FAILED`.

### Порядок и гонки

`done` уходит до хвоста. Клиент, который закрыл поток, не отменяет запись факта: хвост уже запущен после сохранения ассистента.

Два хода одного пользователя дописывают память по очереди в одном процессе. Два поиска по-прежнему оба делают `increment` квоты. Вызов и чат делят один дневной счётчик.

Повторный `POST` реплики создаёт новую реплику. Ключа идемпотентности в контракте нет.

Офлайн клиент ход не догоняет. Файл, записанный на диск, и упавшая вставка строки: вставка сначала, файл вторым; если файл не лег — строку удалить и ответить `500`. Иначе в библиотеке останется путь без байтов.

## 5. Матрица тестов

Сначала тест, потом реализация. Живые OpenRouter, TEI, Postgres и PDF с диска в модульные тесты не входят. Хранилище — память. `fetch` и разбор PDF подменяются.

Основные сценарии:

- Чат с включённой памятью: в understand уходят ограничения, закреплённые и не больше пяти ближайших; документ в `memory[]` не попадает; сводка — отдельным полем. `useMemory: false` и выключенная настройка дают `memory: []`, окно и сводку не выключают, закреплённый файл в `documents` остаётся.
- Демо на `POST /documents`, `POST /calls`, `GET /memory`, `PATCH /settings/memory` — `403`. Без cookie и без Bearer — `401`. Чужой документ и чужая сессия — `404`.
- Порог: кандидат 0.69 не пишется; 0.7 пишется; косинус 0.91 к живому факту не создаёт второй; `CONTRADICTS` ставит `revoked_at` и добавляет новый; `GOAL` получает срок 90 дней; просроченный не попадает в промпт и попадает в `GET`.
- `DELETE` одного и всех ставит `revoked_at`. `PATCH` текста меняет содержание. Выключение настройки строки не удаляет.
- Сводка: 8 сообщений при окне 10 её не зовут; 16 зовут с прежней сводкой и сообщениями вне десятки; сбой llm оставляет старый текст. Хвост стартует после события `done`.
- Библиотека: md создаётся незакреплённым, preferences и PDF — закреплёнными; PDF больше лимита — `400` и файла нет; пустой текст PDF — `400`; правка тела PDF — `400`; удаление снимает запись порта файлов. Повтор того же текста резюме второй раз не зовёт модель, если кэш ответил.
- Предложение: accept навыка пишет `user_profile_skills` и не затирает `SELF_REPORTED`; dismiss профиль не меняет; неизвестное имя навыка в `GET` не появляется; повтор payload не двоит `PENDING`.
- Вызов: сессии нет в списке чатов; реплика `SEARCH` списывает ту же квоту и кладёт карточки в `results`; `SMALL_TALK` счётчик не двигает; завершённая сессия отвечает `400`; второй `end` не сдвигает `ended_at`. Деградация understand / retrieval / generate совпадает с чатом.
- Прямой `POST /api/v1/search` не шлёт память и документы.
- Сбой TEI на чтении не даёт `error` в потоке: ограничения и закреплённые файлы на месте, ближайших нет.

Конкурентность: два хвоста одного пользователя применяются по очереди, второй видит факт первого. Два разных пользователя друг друга не ждут.

## 6. Вопросы

1. Колонок и таблицы в `Wiki/04-data-model.md` нет, а поведение без них не сохранить. ADR-026 требует сохранить флаг реплики. Провенанс вызова не может ссылаться на `messages`. `GET /profile/suggestions` некуда писать. **Рекомендую:** миграция из §4 — `use_memory` у сообщения и реплики вызова, `source_call_turn_id`, таблица `profile_suggestions`. Статью модели обновить уже после кода, не этим планом.
2. `POST /understand` в §3 контракта — это `{ query, history, memory }`. Сводка и файлы туда не входят, а архитектура и библиотека кладут их в контекст. Сливать файлы в `memory[]` запрещает `Wiki/11-hira.md` §3. **Рекомендую:** необязательные `summary` и `documents[]` у understand и generate. `memory[]` остаётся фактами.
3. `extract-memory` в контракте возвращает только кандидатов памяти. Навыки и предпочтения профиля — другая сущность (ADR-008). **Рекомендую:** в том же ответе массив `suggestions`, без второго вызова модели.
4. «Память, не подтверждавшаяся долго, понижается в confidence» — без формулы и без колонки даты подтверждения. **Рекомендую:** confidence не затухает. Просроченный `GOAL` выпадает из промпта и остаётся в `GET`, пока его не удалят.
5. Инкремент сводки «только вытесненные с прошлого раза» требует помнить границу. Колонки границы нет. **Рекомендую:** каждый пересчёт шлёт прежнюю сводку и все сообщения вне текущей десятки. Новую колонку не заводить.
6. «Несколько» ближайших файлов и потолок текста в промпте не заданы. **Рекомендую:** 3 ближайших и 12 000 символов на все документы хода, закреплённые первыми. PDF не больше 10 МиБ, md/txt не длиннее 100 000 символов.
7. Опыт из `/parse-resume` в схеме некуда класть, кроме `user_profiles.education`. **Рекомендую:** предложение `EDUCATION`, accept дописывает текст. Имя навыка без попадания в `skills` / `skill_aliases` не становится предложением.
8. Журнал называет предложения, а §1.5 рядом описывает весь профиль. **Рекомендую:** сделать `GET`/`PUT` профиля и навыки: иначе accept нечем показать. `profile_embedding` не заполнять. Избранное не трогать.
9. У вызова нет сводки в модели данных. **Рекомендую:** последние 10 реплик сессии, без `summarize-chat`.

## 7. Effort

Уровни — для реализации после согласия с планом. `ultracode` не нужен: сводка, факты и вызов сходятся в одном ходе `orchestrate-search.ts`. Рой разведёт порядок `done` и хвоста по разным чатам и стоит отдельного большого расхода. Это не уровень effort, а многоагентный режим.

| Этап | Уровень | Почему |
| --- | --- | --- |
| Реализация | xhigh | Три маршрута llm, файл на диске и уже идущий SSE-ход. Окно, квота и деградация уже есть, поэтому не max. |
| Доработка по замечаниям | medium | Скорее всего сдвинутся бюджет символов, судьба опыта резюме и граница сводки. |
| Ревью | high | Легко положить файл в `memory[]`, списать квоту на разговор вызова или стереть `SELF_REPORTED` при accept. |
| Рефакторинг и баги | high | Типичный дефект — хвост до `done`, PDF без строки в базе или факт демо, у которого нет `users`. |
