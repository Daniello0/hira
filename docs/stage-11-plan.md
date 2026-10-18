# Этап 11. План до кода

Статус: плана достаточно, кода оркестрации ещё нет. Процент этапа 11 в `Wiki/progress-log.md` — 0. `core-api` маршрут поиска не вызывает.

Этап 11 в журнале: «Search orchestrator, SSE (intent → results → tokens), чаты, `POST /search` для eval». Источник фактов — `Wiki/01-architecture.md` §2.2 и §4–5, `Wiki/05-api-contracts.md` §1.2, §1.3, §1.6 и §3, `Wiki/07-auth-and-memory.md` §2–3.1 и demo-лимиты, `Wiki/04-data-model.md` §3, ADR-022, ADR-028, ADR-032. Где статьи спорят, в код идёт рекомендация из §6, если обсуждение PR её не заменит.

## 1. Задача

Цель: `core-api` ведёт чаты и дирижирует один поисковый ход. Сообщение уходит наружу потоком `intent → results → token`. Отдельный `POST /api/v1/search` повторяет поиск без диалога и без генерации.

Чек-лист. Каждый пункт — цитата журнала или статьи, не догадка.

- Дирижёр, не модель. «сам поиск и сам вызов модели `core-api` не выполняет — он только дирижирует» — `Wiki/01-architecture.md` §2.2. Журнал: «Оркестрация поиска (core-api)».
- Порядок хода. «сохраняет user-сообщение, собирает контекст» → `POST /understand` → `POST /search` → `POST /generate` → «стримит на web, параллельно сохраняет assistant-сообщение + привязку к вакансиям» — `Wiki/01-architecture.md` §4.
- События. «`user-message` → `intent` → `results` → `token`* → `assistant-message` → `done`» — `Wiki/design.mdc`. Те же имена и поле `error` — `Wiki/05-api-contracts.md` §1.2. «Событие `results` приходит **до** токенов генерации».
- Чаты. «Список чатов (пагинация курсором)», создать, чат с последними сообщениями, «Переименовать / архивировать», удалить, история курсором, сообщение потоком — таблица §1.2. «Чат создаётся пустым» — `Wiki/07-auth-and-memory.md`. «Уточнение «а можно удалёнку?» действует в пределах своего чата».
- Окно. «Последние `WORKING_WINDOW_SIZE` (стартово **10**) сообщений передаются в `understand` и `generate` дословно» — `Wiki/07-auth-and-memory.md` §3.1.
- Снимок. «Показанные вакансии с объяснениями сохраняются в `message_vacancies`» — `Wiki/07-auth-and-memory.md`. Колонки — `Wiki/04-data-model.md` §3.
- Прямой поиск. «`POST /api/v1/search` — прямой поиск без чата — для отладки, демонстрации и главы 4». «Наличие «голого» `POST /api/v1/search` принципиально: он даёт воспроизводимый вход для экспериментов, не завязанный на диалог» — `Wiki/05-api-contracts.md` §1.3. Журнал: «`POST /search` для eval».
- Квота. Demo: «**1 чат**, **3 запроса** total». Зарегистрированный: «чаты без лимита по числу, **20 поисковых запросов/день**», сброс в полночь UTC, `429` и `RATE_LIMIT_EXCEEDED` — `Wiki/05-api-contracts.md` §1.6.
- Деградация. Недоступный `understand` — «сырой запрос как `rewrittenQuery`, без структурных ограничений» и поиск всё равно идёт. Недоступный `generate` — «карточки вакансий без текстового ответа». Недоступный retrieval — «честная ошибка 503» — `Wiki/01-architecture.md` §4.
- Язык ответа задаёт модель, не `core-api`. «Язык ответа Hira — язык реплики пользователя (ADR-028)».

Поверхности, которые этап не называет: телефон, второй пользователь одновременно, офлайн, язык интерфейса. Демо и зарегистрированный — разные квоты, это названо.

## Вне этого этапа

- Три уровня памяти целиком, выключатель, библиотека, вызов, предложения профиля — этап 12. Журнал этапа 11 их не называет. `POST /internal/v1/summarize-chat`, `extract-memory`, `parse-resume` не вызывать. `useMemory` принимается и не читает `user_memories`. Вопрос 5.
- `POST /internal/v1/title-chat` в `llm-service` нет. ADR-032 этот маршрут не открывает. Заголовок чата — вопрос 4.
- Карточки на экране, spinner, экран Call — этап 13. Этот этап отдаёт SSE и JSON, страницу не рисует.
- `GET /api/v1/vacancies/{id}`, `/similar`, `/skill-gap`, избранное, профиль, feedback, admin ingestion — в журнале этапа 11 нет.
- Релаксация и персонализация остаются как их оставил этап 10: `relaxationSteps` приходит из retrieval, `personalize` уходит как передал клиент и внутри retrieval не применяется.
- Бенчмарк 30 запросов и абляции на живом корпусе — этап 16. Контракт `POST /api/v1/search` для них готовится здесь.
- `Wiki/` этим планом не менять.

## 2. Что уже есть

Переиспользовать как есть:

- Таблицы и сущности чата, сообщения, снимка и телеметрии уже созданы миграцией и зарегистрированы: `chats` / `messages` / `message_vacancies` / `search_logs` в `apps/core-api/src/features/database/schema-statements.ts`, сущности `chat.entity.ts`, `message.entity.ts`, `message-vacancy.entity.ts`, `search-log.entity.ts`, список `entities.ts`. `synchronize: false` остаётся. Новых колонок нет, кроме демо-идентичности из вопроса 1.
- Контракты хода уже описаны: `UnderstandRequest` / `UnderstandResponse` (`packages/contracts/src/common/dto/llm/understand.dto.ts`), `GenerateRequest` (`generate-request.dto.ts`), `RetrievalRequest` / `RetrievalResponse` (`retrieval.dto.ts`), `CreateMessageRequest` (`create-message-request.dto.ts`), `SearchIntent`, `IntentType`, `MessageRole`. `canonicalId` наружу из модели не приходит. Новых значений enum нет.
- `llm-service` уже отвечает `{ intent, meta }` и, после первого токена, SSE `token` / `done` / `error` (`apps/llm-service/src/features/llm/llm.router.ts`). Повтор после первого токена не делается. Бюджет вызова — 20 с внутри таймаута core→llm 25 с.
- `retrieval-service` `POST /internal/v1/search` уже сливает ветви и объясняет карточки. Пустой текст — 200 и пустые ветви. Сбой ветви — 503 `RETRIEVAL_UNAVAILABLE`. Мёртвый реранкер — 200 и порядок RRF. `userId` не-uuid — 400. Нет `limit` — 10, верх 50 (`read-search-request.ts`).
- Квота поиска уже считается: `SearchQuotaService.consumeDemo` / `consumeRegistered` (`search-quota.service.ts`). Лимиты 3 и 20 — `auth.constants.ts`. Комментарий сервиса: списывать, когда ход запускает поиск. У счётчика есть `increment`, отдельного `decrement` нет (`counter.store.ts`).
- Демо-cookie `demoSessionId` ставит `DemoSessionMiddleware` (`demo-session.middleware.ts`). Bearer не даёт выписать демо. Refresh-cookie тоже не даёт. Вход по access token — `AccessTokenGuard`. Форма ошибки и `429` — `ApiExceptionFilter`, код `RATE_LIMIT_EXCEEDED`.
- Префикс `/api/v1`, cookie parser, CORS, ValidationPipe, Swagger `/docs` — `configure-http-app.ts`. Сквозной `X-Request-Id` — `request-id.interceptor.ts`.
- Compose уже передаёт `core-api` адреса `RETRIEVAL_SERVICE_URL`, `LLM_SERVICE_URL` и `INTERNAL_API_TOKEN` (`docker-compose.yml`). Заголовок внутреннего вызова — `X-Internal-Token`, как у retrieval и llm.
- Окно и текущая реплика уже разделены на стороне llm: история — `history[]`, сырой текст — `query` (`build-understand-messages.ts`). Повторять текущую реплику в `history` не нужно.
- Тесты HTTP в core-api поднимают Nest и подменяют порт хранилища, без Postgres: `auth.controller.test.ts`, `USER_STORE`.

Не переиспользовать:

- `AccessTokenGuard` как единственную дверь чата. Он требует Bearer и не знает демо-cookie. Аноним с одним чатом останется за 401.
- `probe` и клиенты retrieval/llm из тех сервисов. `core-api` их не импортирует: свой `fetch`, свои таймауты.
- Запись `search_logs` внутри retrieval. Этап 10 её не делает: во внутреннем теле нет сырого текста и `message_id`. Архитектура говорит, что retrieval «пишет только в `search_logs`» — это вопрос 6.
- `title-chat`, `summarize-chat`, `extract-memory`. Маршрутов нет, этап 12 / вопрос 4.
- Axios и отдельная библиотека SSE. В core-api HTTP-клиента нет, в Node 22 есть `fetch`. Разбор SSE — чтение `text/event-stream` по строкам `event:` / `data:`.

Открытых PR нет (`gh pr list --state open` пуст).

## 3. Решение

Один дирижёр в `core-api`. Retrieval и llm остаются как есть. Контракт внутреннего поиска не расширяется.

Кто вызывает. Либо access token, либо валидный `demoSessionId`. Оба сразу — побеждает token, cookie демо игнорируется. Только refresh-cookie, без Bearer и без демо — `401 AUTH_UNAUTHORIZED`. Чужой чат — `404`, не `403`: по ответу не видно, что чат существует.

Демо и `user_id`. Сейчас `chats.user_id` — `NOT NULL` и ссылка на `users` (`schema-statements.ts`, `chatsTable`). Демо-аккаунта нет, а статья требует чат без регистрации. Рекомендация вопроса 1: `user_id` становится nullable, появляется `demo_session_id uuid NULL`, ровно одно из двух заполнено, `demo_session_id` уникален. Один cookie — одна строка чата. Регистрация эту строку не забирает: «данные demo-сессии не переносятся при регистрации».

Первый запрос демо. `GET /api/v1/chats` или `POST /api/v1/chats` создаёт пустой чат, если строки ещё нет. Второй `POST /api/v1/chats` — `429 RATE_LIMIT_EXCEEDED`. Это лимит «1 чат», не поисковая тройка. Сейчас middleware кладёт новый id только в ответ и не в `request.cookies`, поэтому первый запрос обработчик не видит. Тот же id дописывается в `request` на этот заход. Набор cookie и условия выдачи не меняются.

Заголовок. Пока `title-chat` нет, первое сообщение при `title IS NULL` записывает обрезку текста до 256 символов. Пустой чат остаётся с `title: null`. `PATCH` меняет имя или `isArchived`. Вопрос 4.

Сообщение. `content` — строка после trim, длина 1..4000. Пустое тело — `400 VALIDATION_FAILED` до потока. Архивный чат на `POST .../messages` тоже `400` до потока. `PATCH` снимает архив, потом писать можно. Вопрос 8 про длину не задаю отдельно: 4000 — константа, не литерал в контроллере.

Поток открывается после того, как user-сообщение записано. До этого отказ — обычный JSON. Дальше `Content-Type: text/event-stream`, без буфера Nest.

Порядок одного сообщения:

1. Записать user-сообщение. Увеличить `chats.message_count` и тем самым `updated_at` (триггер на `UPDATE` чата; вставка сообщения сам чат не трогает).
2. `event: user-message`.
3. `POST /internal/v1/understand` с `query` = текст, `history` = до 10 предыдущих реплик `USER`/`ASSISTANT` по времени, `memory` = `[]`. Сводка чата не подмешивается.
4. Любой неуспех understand (сеть, таймаут 25 с, 422, 502, 503) не событие `error`. Намерение собирается эвристикой: `rewrittenQuery` = сырой текст, `role` и `seniority` = null, `skills` = `[]`, `hardConstraints` = `{}`, `softConstraints` = `{}`, `complexity` = `SIMPLE`, `intentType` = `SEARCH`. `SIMPLE` — то значение, которое retrieval уже подставляет, если сложность не прислали (`read-search-request.ts`).
5. `event: intent` с тем намерением, которое пойдёт в поиск.
6. Списать квоту только если `intentType` — `SEARCH`, `REFINE` или `COMPARE`. Отказ — `event: error` с `RATE_LIMIT_EXCEEDED`. У демо `Retry-After` нет. У зарегистрированного секунды до полуночи UTC лежат в `details.retryAfterSeconds`: заголовок уже не поставить, поток открыт. Retrieval не вызывается, assistant не пишется, `event: done` не шлётся. Сообщение пользователя остаётся.
7. `CAREER_ADVICE` и `SMALL_TALK` квоту не тратят и retrieval не зовут. `results` = `[]`. Дальше генерация. Вопрос 2.
8. Иначе `POST /internal/v1/search`. `userId` — только id зарегистрированного. Демо-uuid в retrieval не уходит: иначе он попадёт в разбор `user_profile_skills`. `limit` не передаём своим числом — retrieval поставит 10. `options` с сообщения не приходят. Таймаут 150 с — вопрос 3.
9. Сеть, таймаут или HTTP 503 — `event: error`, код наружу `SEARCH_UPSTREAM_UNAVAILABLE` (пример в `Wiki/05-api-contracts.md`), не внутренний `RETRIEVAL_UNAVAILABLE`. Карточки не пишутся. `400` от retrieval на нашем теле — дефект дирижёра, наружу `500`, не «поиск недоступен».
10. Успех — `event: results` с `{ results, diagnostics }`. Строка `search_logs`: `raw_query` = текст пользователя, `message_id` = id user-сообщения, `user_id` = аккаунт или null у демо, остальное из diagnostics и intent. Квота к этому моменту уже списана и назад не возвращается: неудачный retrieval тоже был запросом, а счётчик только растёт.
11. `POST /internal/v1/generate` читается как SSE. Каждый `token` сразу уходит клиенту тем же именем. `done` llm наружу не копируется.
12. Обрыв generate до текста или вместо текста — не `error`. Архитектура обещает карточки без прозы. Assistant пишется с пустым `content`, снимок вакансий вешается на него, `event: assistant-message`, затем `event: done`.
13. Успешный текст собирается из `delta`, пишется assistant, снимок — `message_vacancies` (`rank` с 1, `score`, `explanation`, `retrieved_by`). `token_usage` user-сообщения — `meta` understand, если он был. Assistant — `meta` из `done`, если он пришёл.
14. `event: assistant-message`, затем `event: done` с `{ messageId, totalLatencyMs }`. `messageId` — id assistant.

Клиент оборвал поток — уже полученные токены всё равно сохраняются. Повторный `POST` создаёт новые сообщения; ключа идемпотентности в контракте нет.

`POST /api/v1/search`. Тело — `RetrievalRequest`. Ответ — JSON `RetrievalResponse`, не SSE. Understand и generate не вызываются: глава 4 гоняет одно и то же намерение через `options.branches` / `rerank` (`Wiki/08-evaluation.md` §2). Квота списывается всегда: это поиск. Демо без user id. `search_logs.message_id` = null, `raw_query` = `intent.rewrittenQuery`. Отказ квоты — JSON `429` и заголовок `Retry-After` у зарегистрированного. Сбой retrieval — JSON `503` `SEARCH_UPSTREAM_UNAVAILABLE`.

История. `GET /api/v1/chats/{id}` отдаёт чат и последние 20 сообщений по времени, от старых к новым. У assistant в этом списке есть `results`: живая `VacancyDto` по `vacancy_id` плюс сохранённые `score`, `explanation`, `retrievedBy`, порядок по `rank`. Объяснение не пересчитывается. Текст вакансии может уехать, если корпус изменился: в таблице нет снимка `VacancyDto`. Вопрос 7. `GET .../messages?cursor=&limit=` отдаёт более старую страницу. Курсор — id самого старого сообщения уже отданной страницы. `GET /api/v1/chats?cursor=&limit=` — страница чатов по `updated_at` убыванию, курсор — id последнего чата страницы. По умолчанию 20, верх 50. Архивные в списке есть, флаг `isArchived` их не прячет.

## 4. Архитектура

### Файлы

Новые, рядом с тестом:

- `apps/core-api/src/features/chat/chat.store.ts` — порт чата, как `user.store.ts`.
- `apps/core-api/src/features/chat/memory-chat.store.ts` — память для HTTP-тестов.
- `apps/core-api/src/features/chat/typeorm-chat.store.ts` — запись в четыре таблицы.
- `apps/core-api/src/features/chat/chat.controller.ts` — CRUD и отдача потока.
- `apps/core-api/src/features/chat/chat.module.ts`.
- `apps/core-api/src/features/chat/read-caller.ts` — token или демо.
- `apps/core-api/src/features/chat/chat.constants.ts` — окно 10, страница 20, верх 50, длина текста 4000, длина заголовка 256.
- `apps/core-api/src/features/chat/dto/chat.dto.ts` — class-validator, как `auth.dto.ts`.
- `apps/core-api/src/features/search-orchestrator/run-turn.ts` — шаги 3–14, без Express.
- `apps/core-api/src/features/search-orchestrator/heuristic-intent.ts` — запасное намерение.
- `apps/core-api/src/features/search-orchestrator/llm-client.ts` — understand JSON и разбор SSE generate.
- `apps/core-api/src/features/search-orchestrator/retrieval-client.ts` — один `POST /internal/v1/search`.
- `apps/core-api/src/features/search-orchestrator/search-orchestrator.constants.ts` — таймауты, коды, имена событий.
- `apps/core-api/src/features/search-orchestrator/search.controller.ts` — голый `POST /api/v1/search`.
- `apps/core-api/src/features/search-orchestrator/search-orchestrator.module.ts`.
- `apps/core-api/src/features/database/migrations/1763000000000-demo-chat.ts` — только если вопрос 1 остаётся рекомендацией.

Меняются:

- `chat.entity.ts` — `userId` nullable, колонка `demoSessionId`.
- `schema-statements.ts` — то же ограничение, чтобы новая база совпала с миграцией.
- `demo-session.middleware.ts` — свежий id виден в этом же запросе.
- `app.module.ts` — модули чата и оркестратора.
- `app.constants.ts` — имена `INTERNAL_API_TOKEN`, `RETRIEVAL_SERVICE_URL`, `LLM_SERVICE_URL`. Секрет не логировать.
- `packages/contracts` — DTO списка чата, страницы и сообщения истории. Тело сообщения уже есть. Enum не трогать.

Функции короче 15–20 строк. Константы не литералы в контроллере.

### Типы

Наружу, в `packages/contracts`:

```ts
interface ChatSummary {
  id: string;
  title: string | null;
  isArchived: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageView {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  results?: VacancyResult[];
}

interface ChatPage<T> {
  items: T[];
  nextCursor: string | null;
}
```

`POST` сообщения по-прежнему `CreateMessageRequest`. `PATCH`: `{ title?: string; isArchived?: boolean }`.

Внутри дирижёра:

```ts
type Caller = { kind: 'user'; userId: string } | { kind: 'demo'; demoSessionId: string };

type TurnEvent =
  | { name: 'user-message'; data: ChatMessageView }
  | { name: 'intent'; data: SearchIntent }
  | { name: 'results'; data: { results: VacancyResult[]; diagnostics: RetrievalDiagnostics } }
  | { name: 'token'; data: { delta: string } }
  | { name: 'assistant-message'; data: ChatMessageView }
  | { name: 'done'; data: { messageId: string; totalLatencyMs: number } }
  | { name: 'error'; data: ApiErrorResponse };
```

Поиск запускают `IntentType.Search`, `IntentType.Refine`, `IntentType.Compare`. Остальные два — нет.

### Источники правды

| Значение | Где живёт | Кто пишет |
| --- | --- | --- |
| Чат, реплики, снимок вакансий | `chats`, `messages`, `message_vacancies` | `typeorm-chat.store` на один ход |
| Заголовок до первого сообщения | `chats.title` | обрезка первого текста; дальше только `PATCH` |
| Демо-личность | cookie `demoSessionId` и `chats.demo_session_id` | middleware выдаёт cookie, чат хранит копию |
| Квота поиска | Redis `quota:search:demo:` / `quota:search:user:` | `SearchQuotaService`, одно списание на поисковый ход |
| Лимит одного демо-чата | `UNIQUE (demo_session_id)` | база, не Redis |
| Намерение хода | `messages.intent` user-сообщения | understand или эвристика |
| Порядок карточек и факторы | ответ retrieval, затем снимок | retrieval считает, core-api только копирует |
| Телеметрия главы 4 | `search_logs` | core-api после ответа retrieval. Вопрос 6 |
| Межчатовая память и сводка | `user_memories`, `chats.summary` | не этот этап. В промпт не читаются |
| Оценки реранкера | память retrieval | в `core-api` не копируются, кроме diagnostics |

### Контракт HTTP

Наружу — только перечисленные маршруты §1.2 и `POST /api/v1/search`. Внутренние URL и токен клиенту не отдаются.

События потока — имена из §1.2, каждое `data` — JSON. Ошибка до открытия потока — JSON `ApiErrorResponse` и статус. Ошибка после — `event: error` и закрытие. Дважды `error` не пишется.

`POST /api/v1/search` не стримит. Тело и ответ совпадают с внутренним `RetrievalRequest` / `RetrievalResponse`.

Внутренние вызовы: `X-Internal-Token`, `X-Request-Id` из перехватчика. Повтора retrieval нет (`Wiki/01-architecture.md` §5: ретраи поиска нет). Повтор understand остаётся внутри llm-service.

### Миграции и выкладка

Одна миграция, если вопрос 1 не заменят: nullable `user_id`, `demo_session_id`, проверка «ровно одно», уникальный индекс демо. Старые строки — все с `user_id`, ограничение их не ломает.

Выкладка: сначала миграция (one-shot уже стоит перед `core-api`), затем `core-api`. Retrieval и llm не меняются. Веб этап 11 не ждёт. Пустые URL или пустой токен процесс не роняют: ход честно отвечает 503 или уходит в эвристику, `/health` жив.

### Порядок и гонки

Два поиска одного пользователя оба делают `increment`. Двадцать первый в сутки получает отказ. Два `POST /chats` демо: уникальный индекс оставляет одну строку, второй ответ — 429.

Списание стоит до retrieval, чтобы параллельные ходы не проскочили лимит. Неуспех поиска квоту не возвращает.

Обрыв SSE после `results` всё равно пишет assistant и снимок. Обрыв на understand пишет только user-сообщение: намерения ещё нет, квота не списана.

Офлайн клиента ход не догоняет. Повтор — новое сообщение.

## 5. Матрица тестов

Сначала тест, потом реализация. Живые OpenRouter, TEI и Postgres в тесты не входят. Хранилище — память. `fetch` подменяется.

Основные сценарии:

- CRUD: пустой `POST /chats` у аккаунта; чужой id — 404; `PATCH` имени и архива; `DELETE` скрывает чат из списка; страница курсором не повторяет последний id.
- Демо: первый `GET /chats` создаёт один чат и кладёт cookie; второй `POST /chats` — 429; чужой cookie этот чат не видит; Bearer важнее cookie.
- Поток поиска: порядок событий `user-message`, `intent`, `results`, `token`, `assistant-message`, `done`; `results` раньше первого `token`; в understand уходит 10 предыдущих реплик без текущего текста и с пустой `memory`.
- Уточнение: вторая реплика того же чата видит первую в `history`; другой чат — не видит.
- Квота: `SEARCH` списывает; 21-й за сутки — `error` и нет retrieval; `SMALL_TALK` счётчик не двигает; демо четвёртого поиска нет, четвёртого чата тоже.
- Деградация: understand 502 даёт эвристику и всё равно зовёт retrieval; generate обрывается после `results` — есть assistant с пустым текстом, есть снимок, нет `error`; retrieval 503 — `SEARCH_UPSTREAM_UNAVAILABLE`, снимка нет, квота уже списана.
- Голый поиск: тело с `options.branches` уходит в retrieval как есть; understand не вызывается; демо не передаёт `userId`; 429 до вызова retrieval — JSON, не поток.
- Снимок: повторное чтение чата отдаёт сохранённые `score` и `explanation`, даже если следующий поиск вернул бы другие.

Конкурентность: два параллельных поиска упираются в атомарный `increment` памяти. Уникальность демо-чата проверяется на порте, без базы: второй insert того же `demoSessionId` — отказ.

## 6. Вопросы

1. Демо-чат и `user_id`. Статья чата требует `user_id` FK. Статья квоты требует чат без пользователя. Строка `users` на каждый cookie заведёт фиктивный email. **Рекомендую:** nullable `user_id`, `demo_session_id`, ровно одно заполнено, уникальность демо. Регистрация строку не переносит.
2. Какие `intentType` ищут вакансии. Сквозной сценарий §4 всегда идёт в retrieval. Рядом лежат `SMALL_TALK` и `CAREER_ADVICE`. Квота названа «поисковые запросы», не «сообщения». **Рекомендую:** ищут и списывают квоту `SEARCH`, `REFINE`, `COMPARE`. Два остальных отвечают текстом без retrieval и без списания.
3. Таймауты. Таблица `Wiki/01-architecture.md` §5: web→core 30 с, core→retrieval 10 с, retrieval→TEI 8 с. Реранк этапа 10 ждёт 120 с (`RERANK_TIMEOUT_MS`). Журнал и ADR-022: полный ответ до 1–2 минут — норма. **Рекомендую:** core→llm оставить 25 с. core→retrieval — 150 с, чтобы живой CPU-реранк не стал 503. Поток SSE не обрывать на 30 с. Таблицу архитектуры этим планом не править.
4. Заголовок чата. `Wiki/07-auth-and-memory.md`: «генерируется LLM по первому сообщению». Маршрута `title-chat` нет, ADR-032 его не открывает. **Рекомендую:** обрезка первого сообщения до 256 символов и `PATCH`. Вызов модели для имени — не этот этап.
5. Контекст understand. §4 архитектуры кладёт в ход ещё сводку и долгую память. Журнал отдаёт три уровня этапу 12. **Рекомендую:** только окно 10. `memory: []`. `chats.summary` не читать. `useMemory` принять и не применять. `extract-memory` не звать.
6. Кто пишет `search_logs`. §2.3 архитектуры говорит, что пишет retrieval. Внутреннее тело не содержит сырой текст и `message_id`, и этап 10 лог не пишет. **Рекомендую:** пишет `core-api` после ответа retrieval. Retrieval остаётся только чтением, как сейчас.
7. Снимок карточки. §07 обещает, что старый чат выглядит как в момент разговора, даже если корпус изменился. Колонки хранят объяснение, ранг и id, не тело `VacancyDto`. Удаление вакансии каскадом снимает строку снимка. **Рекомендую:** не добавлять jsonb тела. Отдавать живую вакансию и замороженные score/explanation. Расхождение текста — известный предел схемы.
8. `POST /api/v1/search` и 20 запросов в сутки. Журнал зовёт маршрут «для eval». Глава 4 — 30 запросов и несколько абляций на одно намерение (`Wiki/08-evaluation.md`). Через квоту аккаунта этот прогон не проходит. **Рекомендую:** публичный маршрут квоту списывает, это поиск человека. Прогон этапа 16 бьёт в уже существующий `POST /internal/v1/search` внутренним токеном и квоту не тратит. Отдельного admin-обхода на публичном маршруте нет.

## 7. Effort

Уровни — для реализации после согласия с планом. `ultracode` не нужен: один сервис, оба внутренних маршрута уже отвечают, рой размажет порядок событий по нескольким чатам.

| Этап | Уровень | Почему |
| --- | --- | --- |
| Реализация | high | Поток, квота и три отказа (understand, retrieval, generate) расходятся по статусам. Контракты и оба сервиса уже есть, поэтому не xhigh. |
| Доработка по замечаниям | medium | Скорее всего сдвинутся демо-ключ, набор `intentType` и таймаут retrieval. |
| Ревью | high | Легко списать квоту на `SMALL_TALK`, отдать 503 вместо карточек без текста или пустить демо-uuid в `userId`. |
| Рефакторинг и баги | high | Типичный дефект — `results` после первого `token`, или чат демо, который регистрация внезапно усыновляет. |

## Отклонения от плана

Пока нет. Раздел дописывается при реализации, прежний текст не стирается.
