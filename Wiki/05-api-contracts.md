# 05. API-контракты

Статус: черновик · Последнее обновление: 2026-10-24

Общие правила: JSON, `camelCase`, версионирование префиксом `/api/v1`, валидация через `class-validator` (NestJS) и Yup/Zod в Express-сервисах, Swagger UI `core-api` на `/docs`.

Единый формат ошибки во всех сервисах:

```ts
interface ApiErrorResponse {
  errorCode: string;      // 'AUTH_INVALID_CREDENTIALS', 'SEARCH_UPSTREAM_UNAVAILABLE'
  message: string;        // человекочитаемое, безопасное для показа
  details?: unknown;      // подробности валидации
  requestId: string;      // сквозной идентификатор для трассировки
}
```

---

## 1. Внешний API (`core-api`, потребитель — `web`)

### 1.1 Аутентификация

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Регистрация. Тело: `{ email, password, displayName? }` |
| `POST` | `/api/v1/auth/login` | Вход. Возвращает `accessToken` в теле, `refreshToken` в httpOnly cookie |
| `POST` | `/api/v1/auth/refresh` | Ротация пары токенов |
| `POST` | `/api/v1/auth/logout` | Отзыв refresh-токена |
| `GET` | `/api/v1/auth/me` | Текущий пользователь |

Коды auth: `VALIDATION_FAILED` (400), `AUTH_EMAIL_TAKEN` (409), `AUTH_INVALID_CREDENTIALS` (401), `AUTH_REFRESH_INVALID` (401), `AUTH_REFRESH_REUSED` (401), `AUTH_UNAUTHORIZED` (401). Лимит входа и поисковая квота отвечают `RATE_LIMIT_EXCEEDED` (429) — §1.6.

`GET /api/v1/auth/me` добавляет `searchQuota: { used, limit }`. Чтение не списывает квоту. Нет ключа Redis — `used: 0`, `limit: 20`. Демо этот маршрут не вызывает.

### 1.2 Чаты и сообщения

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/chats` | Список чатов (пагинация курсором) |
| `POST` | `/api/v1/chats` | Создать чат |
| `GET` | `/api/v1/chats/{chatId}` | Чат с последними сообщениями |
| `PATCH` | `/api/v1/chats/{chatId}` | Переименовать / архивировать |
| `DELETE` | `/api/v1/chats/{chatId}` | Удалить |
| `GET` | `/api/v1/chats/{chatId}/messages` | История, пагинация курсором |
| `POST` | `/api/v1/chats/{chatId}/messages` | **Главный эндпоинт.** Отправить сообщение, получить SSE-поток ответа |

Курсор списка чатов и истории — непрозрачная позиция `(время, id)` на момент выдачи страницы. Следующая страница строго старше этой позиции, даже если граничный чат потом обновился.

#### `POST /api/v1/chats/{chatId}/messages`

Запрос: `{ content: string, useMemory?: boolean }`

Ответ: `text/event-stream`, последовательность событий:

```
event: user-message      data: { id, role: "USER", content, createdAt }
event: intent            data: SearchIntent
event: results           data: { results: VacancyResult[], diagnostics }
event: token             data: { delta: "текст" }          ← много раз
event: assistant-message data: { id, role: "ASSISTANT", content, createdAt }
event: done              data: { messageId, totalLatencyMs }
event: error             data: ApiErrorResponse
```

Событие `results` приходит **до** токенов генерации — карточки вакансий отрисовываются сразу, текст дописывается поверх. Это заметно улучшает воспринимаемую скорость.

`GET` чата и истории кладут `intent` и `diagnostics` на сообщение пользователя, когда ход их уже записал. У ассистента по-прежнему `results`. `VacancyDto` в потоке и в истории включает `companyName` и `locationLabel` (город и регион). `GET /profile/skills` включает `canonicalName`.

Поток открывается после записи user-сообщения. Сбой `understand` не даёт `error`: намерение строится эвристически, `rewrittenQuery` равен тексту реплики. Квота списывается после `intent` и только для `SEARCH`, `REFINE`, `COMPARE`; отказ — `event: error` с `RATE_LIMIT_EXCEEDED`, без `done`. `SMALL_TALK` и `CAREER_ADVICE` не ищут и квоту не тратят. Сбой retrieval — `event: error` с `SEARCH_UPSTREAM_UNAVAILABLE`, снимок не пишется. Сбой `generate` оставляет карточки и пустой или частичный текст, затем `assistant-message` и `done`, без `error`.

### 1.3 Вакансии

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/vacancies/{id}` | Полная карточка, включая навыки с `evidence_span` |
| `GET` | `/api/v1/vacancies/{id}/similar` | Похожие (плотный поиск по эмбеддингу вакансии) |
| `GET` | `/api/v1/vacancies/{id}/skill-gap` | Разрыв навыков относительно профиля текущего пользователя (US-6) |
| `POST` | `/api/v1/search` | Прямой поиск без чата — для отладки, демонстрации и главы 4 |

Наличие «голого» `POST /api/v1/search` принципиально: он даёт воспроизводимый вход для экспериментов, не завязанный на диалог.

Тело и ответ совпадают с внутренним `RetrievalRequest` / `RetrievalResponse`. `understand` и `generate` не вызываются: абляции гоняют одно и то же намерение. `userId` из тела игнорируется; в retrieval он подставляется только у зарегистрированного. В `search_logs` пишется строка с `message_id = null` и `raw_query = intent.rewrittenQuery`. Запрос всегда списывает поисковую квоту. Отказ — JSON `429`. Сбой retrieval — JSON `503` `SEARCH_UPSTREAM_UNAVAILABLE`. Прогон главы 4 бьёт во внутренний `POST /internal/v1/search` и квоту не тратит.

### 1.4 Избранное и коллекции

| Метод | Путь |
|---|---|
| `GET` / `POST` | `/api/v1/favorites` |
| `PATCH` / `DELETE` | `/api/v1/favorites/{id}` |
| `GET` / `POST` | `/api/v1/collections` |
| `PATCH` / `DELETE` | `/api/v1/collections/{id}` |

`GET /favorites` принимает `collectionId` и `q` (подстрока заметки, без учёта регистра) и возвращает сохранённые вакансии с краткой карточкой. `POST` с тем же `vacancyId` отвечает `200` уже существующей строкой; `addedBy` ставит сервер (`USER`). Первое сохранение кладёт вакансию в коллекцию по умолчанию `Saved`. Чужой `collectionId` и отсутствующая вакансия — `404`. `DELETE /collections/{id}` оставляет избранное, а `collectionId` у него становится пустым. Демо-сессия на этих маршрутах получает `403`.

### 1.5 Профиль и память

| Метод | Путь | Описание |
|---|---|---|
| `GET` / `PUT` | `/api/v1/profile` | Профиль соискателя |
| `GET` / `POST` / `DELETE` | `/api/v1/profile/skills` | Навыки пользователя |
| `GET` | `/api/v1/skills?q=` | Автодополнение каталога (`skills` + `skill_aliases`). Короче 2 символов — пустой список, иначе до 20 совпадений, порог trigram 0.8. Только аккаунт |
| `GET` | `/api/v1/memory` | Что система запомнила, с провенансом |
| `PATCH` | `/api/v1/memory/{id}` | Закрепить / отредактировать |
| `DELETE` | `/api/v1/memory/{id}` | Забыть конкретный факт |
| `DELETE` | `/api/v1/memory` | Забыть всё |
| `GET` | `/api/v1/profile/suggestions` | Ожидающие предложения из диалога (навыки, предпочтения) |
| `POST` | `/api/v1/profile/suggestions/{id}/accept` | Принять предложение → запись в профиль |
| `POST` | `/api/v1/profile/suggestions/{id}/dismiss` | Отклонить предложение |

### 1.6 Demo, лимиты и rate limiting (Q17)

| Режим | Лимиты | Идентификация |
|---|---|---|
| Demo (без регистрации) | **1 чат**, **3 запроса** total | Redis-счётчик по `demoSessionId` (cookie) |
| Registered | чаты без лимита по числу, **20 поисковых запросов/день** | Redis-счётчик по `userId`, сброс в полночь UTC |

При превышении — `429` с `errorCode: 'RATE_LIMIT_EXCEEDED'` и заголовком `Retry-After`. Страница **Billing / Prices** — статический mock в `web` (monthly/yearly), без backend-оплаты.

Demo-чат создаётся автоматически при первом запросе без auth; данные demo-сессии не переносятся при регистрации. Библиотека и вызов demo недоступны. Реплика вызова списывает дневной лимит только если запустила поиск.

### 1.7 Обратная связь и служебное

| Метод | Путь |
|---|---|
| `POST` | `/api/v1/feedback` |
| `GET` | `/health`, `/health/ready` |
| `GET` | `/api/v1/admin/ingestion/runs` (роль `ADMIN`) |

### 1.8 Библиотека, настройка памяти, вызов

Поведение — [11-hira.md](11-hira.md). Всё ниже требует аккаунта; demo-сессия получает `403`. Чужой документ, факт, навык профиля или вызов — `404`. Реплика в уже завершённый вызов — `400`. `POST /calls/{id}/end` отвечает `200`; повтор не сдвигает время завершения.

| Метод | Путь | Описание |
|---|---|---|
| `GET` / `POST` | `/api/v1/documents` | Список библиотеки; создание md/txt или загрузка PDF |
| `GET` / `PATCH` / `DELETE` | `/api/v1/documents/{id}` | Текст, правка md/txt, закрепление, удаление |
| `PATCH` | `/api/v1/settings/memory` | `{ "crossChatMemory": boolean }` |
| `POST` | `/api/v1/calls` | Начать вызов |
| `POST` | `/api/v1/calls/{id}/turns` | Реплика транскрипта; ответ SSE, тот же набор событий, что у сообщения чата, если нужен поиск |
| `POST` | `/api/v1/calls/{id}/end` | Завершить |

Сохранение файла, который предложила Hira, — обычный `POST`/`PATCH` документов после подтверждения в UI, не отдельный «тихий» эндпоинт.

---

## 2. Внутренний API: `retrieval-service`

### `POST /internal/v1/search`

```ts
interface RetrievalRequest {
  intent: SearchIntent;
  userId?: string;            // uuid; отсутствует → поиск без персонализации; не-uuid → 400
  limit: number;              // 1..50, по умолчанию 10
  options?: {
    branches?: RetrievalBranch[];   // подмножество ветвей — для абляций; повтор считается один раз
    rerank?: boolean;               // отключение реранкера — для абляций
    branchWeights?: Record<RetrievalBranch, number>;
    personalize?: boolean;
  };
}

interface RetrievalResponse {
  results: VacancyResult[];
  diagnostics: {
    branchTimings: Record<RetrievalBranch, number>;
    candidateCounts: Record<RetrievalBranch, number>;
    fusedCount: number;
    relaxationSteps: RelaxationStep[];
    rerankApplied: boolean;
    totalLatencyMs: number;
  };
}

interface VacancyResult {
  vacancy: VacancyDto;
  score: number;                     // 0..100
  explanation: MatchExplanation;
  retrievedBy: RetrievalBranch[];
}
```

Поле `options` — не украшение, а инструмент: именно через него главa 4 гоняет абляции (`branches: ['DENSE']` воспроизводит поведение курсовой 2026, `branches: ['LEXICAL','DENSE','GRAPH'], rerank: true` — полный пайплайн) без изменения кода.

### `POST /internal/v1/similar`, `POST /internal/v1/skill-gap`

Похожие вакансии и расчёт разрыва навыков — тоже здесь, потому что оба требуют доступа к векторам и графу.

---

## 3. Внутренний API: `llm-service`

| Метод | Путь | Вход → Выход |
|---|---|---|
| `POST` | `/internal/v1/understand` | `{ query, history[], memory[], summary?, documents? }` → `{ intent: SearchIntent, meta }` |
| `POST` | `/internal/v1/generate` | `{ intent, results[], history[], summary?, documents? }` → SSE `token` / `done` / `error` |
| `POST` | `/internal/v1/summarize-chat` | `{ previousSummary, messages[] }` → `{ summary }` |
| `POST` | `/internal/v1/extract-memory` | `{ messages[], existingMemory[] }` → `{ candidates: MemoryCandidate[], suggestions[] }` |
| `POST` | `/internal/v1/extract-skills` | `{ vacancies: { id, title, description }[] }` → `{ results: ExtractedSkills[] }` |
| `POST` | `/internal/v1/title-chat` | `{ firstMessage }` → `{ title }` |
| `POST` | `/internal/v1/parse-resume` | `{ resumeText }` → `{ skills[], experience[] }` |

Для `/understand`: `history[]` — `{ role: USER | ASSISTANT, content }`, `memory[]` — `{ content }`. `summary` — сводка текущего чата, не факт памяти. `documents[]` — `{ title, kind, content }` закреплённых и ближайших файлов; в `memory[]` они не входят. `canonicalId` в `intent.skills` всегда `null` — [02-retrieval-layer.md](02-retrieval-layer.md), S0.

`/parse-resume` не создаёт строки профиля. `core-api` превращает `skills[]` и `experience[]` в `profile_suggestions`. Повтор того же текста берётся из Redis на 24 часа.

`meta` — `{ tokenUsage: { promptTokens, completionTokens, totalTokens } }`.

`/generate` до первого токена отвечает JSON. После первого токена:

```
event: token   data: { delta }
event: done    data: { meta }
event: error   data: ApiErrorResponse
```

Общие свойства:

- structured output (JSON Schema, `strict: true`) на маршрутах со структурой; `/generate` — обычный текст;
- **ретраи** — первая попытка и ещё две. Один бюджет на невалидный JSON и на транспорт (обрыв, 408, 429, 5xx): текст ошибки валидации дописывается в следующий промпт. 400 и 401 не повторяются. После первого токена `/generate` не повторяется. Вызов укладывается в 20 с, чтобы остаться внутри таймаута core→llm 25 с из [01-architecture.md](01-architecture.md);
- `LLM_INVALID_OUTPUT` — 422, попытки кончились. `LLM_UPSTREAM_UNAVAILABLE` — 502. `LLM_NOT_CONFIGURED` — 503, пустой ключ или `OPENROUTER_MODEL`. `VALIDATION_FAILED` — 400;
- заголовок `X-LLM-Provider: openrouter` на ответе understand/generate, включая 422 и 502;
- учёт токенов — `meta.tokenUsage`, без прайса. Кэш успешного understand — Redis, [ADR-032](10-decision-log.md). Сбой Redis не роняет запрос. `/generate` не кэшируется;
- пустой список в `hardConstraints` наружу не попадает, пол зарплаты `0` сохраняется;
- запрос к OpenRouter требует эндпоинт, который принимает переданные параметры (`provider.require_parameters`), и ставит `reasoning.effort` в `minimal`, чтобы ответ уложился в бюджет 20 с.

---

## 4. Внутренний API: `ingestion-service`

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/internal/v1/runs` | Запустить прогон вручную: `{ source, jobType }` |
| `GET` | `/internal/v1/runs` | История прогонов |
| `GET` | `/internal/v1/runs/{id}` | Детали |
| `POST` | `/internal/v1/reindex` | Принудительная переиндексация: `{ scope: 'EMBEDDINGS' \| 'SKILLS' \| 'ALL', vacancyIds? }` |

---

## 5. Общие DTO (`packages/contracts`)

Живут в одном месте и импортируются всеми, включая фронтенд:

```
packages/contracts/src/
├── common/enums/
│   ├── seniority-level.enum.ts
│   ├── work-format.enum.ts
│   ├── employment-type.enum.ts
│   ├── vacancy-source.enum.ts
│   ├── vacancy-status.enum.ts
│   ├── retrieval-branch.enum.ts
│   ├── query-complexity.enum.ts
│   ├── intent-type.enum.ts
│   ├── skill-type.enum.ts
│   ├── skill-edge-type.enum.ts
│   ├── skill-importance.enum.ts
│   ├── memory-kind.enum.ts
│   ├── message-role.enum.ts
│   ├── match-factor.enum.ts
│   ├── language.enum.ts
│   ├── rate-unit.enum.ts
│   └── favorite-status.enum.ts
└── common/dto/
    ├── vacancy/
    ├── search/
    ├── chat/
    ├── memory/
    └── error/
```

`favorite-status.enum.ts` в пакете пока нет: у избранного в [04-data-model.md](04-data-model.md) нет статуса (трекер отклика снят, Q15), значения для enum не заданы. `MatchFactor`, `Language` и `RateUnit` добавлены вместе с каркасом: факторы объяснения из [02-retrieval-layer.md](02-retrieval-layer.md), язык и единица ставки — из модели вакансии.

Конвенция проекта запрещает дублировать доменные значения строковыми литеральными юнионами — только `enum` из этой папки, и на бэкенде, и на фронтенде.

---

## 6. Статус открытых вопросов

Закрыты: Q16 (SSE), Q17 (demo-лимиты + Billing page), Q7 (resume upload), Q22 (profile suggestions).

Актуальный список открытого — [09-open-questions.md](09-open-questions.md). Объяснение Q11 лежит в [llm-lexical-graph-summary.md](llm-lexical-graph-summary.md).
