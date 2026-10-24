# Этап 14. План до кода

Статус на момент плана: экраны чата, стрима и вызова есть в `apps/web` (этап 13 закрыт). Профиль, библиотека, избранное, память и mock `/billing` в UI отсутствуют: в боковой колонке только подписи без маршрутов (`apps/web/src/features/chat/chat-sidebar.tsx:20-21`, `137-142`). Бэкенд этапа 12 отдаёт профиль, память, библиотеку и предложения; REST избранного и коллекций в `core-api` не реализован — есть только сущности и ограничения БД (`apps/core-api/src/features/favorite/`).

Этап 14 в журнале: «Frontend: профиль, библиотека, избранное, billing» и deliverables «Profile, library, favorites, memory, mock `/billing`». Источник фактов — `Wiki/progress-log.md` строка 26, `Wiki/06-frontend.md` §1–2.3–2.8 и §5, `Wiki/05-api-contracts.md` §1.4–1.5 и §1.8, `Wiki/07-auth-and-memory.md` §3.4–3.6 и §4, `Wiki/11-hira.md` §3–4.3, `Wiki/04-data-model.md` §4, ADR-008, ADR-019, ADR-021, ADR-024, ADR-026, ADR-029. Где статья шире журнала, в код идёт рекомендация из §6, если обсуждение PR её не заменит.

План лежит в `docs/stage-14-plan.md`, как планы этапов 8–13. Каталога `specs/` в этом репозитории нет.

## 1. Задача

Цель: зарегистрированный пользователь на английском тёмном UI управляет профилем, библиотекой файлов, списком избранных вакансий и фактами памяти; любой посетитель видит mock-страницу тарифов. Демо по-прежнему ограничено чатом и не открывает поверхности аккаунта.

Чек-лист. Каждый пункт — цитата журнала или статьи, не догадка.

- Журнал этапа 14: «Profile, library, favorites, memory, mock `/billing`» — `Wiki/progress-log.md`.
- Маршруты в макете: `/favorites`, `/profile`, `/memory`, `/library`, `/billing` — `Wiki/06-frontend.md` §1.
- Избранное. «Отдельного «каталога вакансий» нет»; «просмотр сохранённых вакансий — через Favorites»; «LLM или пользователь добавляет в избранное из чата, затем список доступен на `/favorites`»; «сетка/список карточек, группировка по коллекциям, поиск по заметкам»; для закрытых — «vacancy no longer active» — §2.3.
- Карточка в чате. «кнопка «в избранное»» — §2.2 (этап 13 сознательно отложил).
- Профиль. «Форма профиля + редактор навыков»; «Резюме загружается в библиотеку (PDF), не отдельной формой на этом экране»; «modal навыков после разбора тот же»; «автодополнение по графу (`skills` + `skill_aliases`)»; источники навыка manual / resume / dialog — §2.4.
- Предложения. «toast/modal «Add Python to your profile?» — accept → профиль, dismiss → игнор. Без автозаписи» — §2.4, ADR-008, ADR-021.
- Память. Список с типом, уверенностью, датой, ссылкой на источник; «закрепить, отредактировать, забыть, забыть всё»; переключатель **Cross-chat memory** — §2.5, `Wiki/11-hira.md` §4.2.
- Библиотека. Список по видам Resume, Preferences, Letters, Scripts, Notes; PDF — загрузка резюме и тот же modal навыков; md/txt — просмотр и правка; закрепление — §2.6, ADR-024.
- Billing. «Mock-страница `/billing`: карточки тарифов Free / Pro / Team, переключатель **monthly / yearly** … CTA «Upgrade» без реальной оплаты» — §2.8, ADR-019.
- Демо. «При исчерпании — banner «Sign up for 20 queries/day» + ссылка на `/billing`»; у аккаунта счётчик запросов в sidebar — §5, ADR-029.
- Аккаунт-only. «Библиотека и вызов demo недоступны»; «Всё ниже требует аккаунта; demo-сессия получает `403`» — `Wiki/05-api-contracts.md` §1.6 и §1.8.
- Язык UI — English only; тёмная тема — §5.
- REST избранного и коллекций перечислен в Wiki, хотя журнал называет этап frontend: «`GET` / `POST` `/api/v1/favorites`», «`PATCH` / `DELETE` `/api/v1/favorites/{id}`», коллекции — §1.4.

Поверхности, которые этап называет: браузер, демо vs аккаунт, EN UI, мобильные шторки (наследуются от оболочки этапа 13). Телефон вне браузера, офлайн-очередь, светлая тема, реальная оплата — не названы.

## Вне этого этапа

- MCP, автоотклик, источники 4–6, бенчмарк, интеграционный прогон этапа 17.
- Трекер статуса отклика (Q15 → диплом).
- `GET /api/v1/vacancies/{id}`, `/similar`, `/skill-gap` — отдельные экраны карточки вне чата/избранного.
- Сохранение md/txt, **предложенного Hira в чате или вызове**, без отдельного UX подтверждения — в Wiki есть (§2.6), но orchestrator и generate сейчас не отдают «черновик файла»; этот этап не добавляет новый SSE-событие. Вопрос 5.
- Добавление в избранное **ассистентом по намерению модели** — в статье названо, пайплайна в `core-api` / `llm-service` нет. Вопрос 6.
- `profile_embedding`, персонализация retrieval, relaxationSteps в UI.
- `Wiki/` и процент в `progress-log.md` этим планом не менять. Процент этапа 14 остаётся 0, пока экранов нет.

## 2. Что уже есть

Переиспользовать как есть:

- Оболочка приложения: `AppShell`, sidebar, drawer, сессия refresh + `/me` (`apps/web/src/features/shell/app-shell.tsx`, `auth/session.ts`). Демо не шлёт Bearer; аккаунт — `coreFetch` с токеном (`common/api/core-api.ts:8-11`).
- Контракты профиля, памяти, документов, предложений — `packages/contracts` (`profile.dto.ts`, `memory-fact.dto.ts`, `document.dto.ts`, `memory-settings.dto.ts`). `CurrentUserDto` уже несёт `crossChatMemoryEnabled` и `searchQuota` (`current-user.dto.ts:10-17`).
- REST аккаунта в `core-api`:
  - Профиль и навыки — `profile.controller.ts:44-101` (`GET|PUT /profile`, `GET|POST|DELETE /profile/skills`, suggestions accept/dismiss).
  - Память и выключатель — `memory.controller.ts:47-96` (`GET|PATCH|DELETE /memory`, `DELETE /memory`, `PATCH /settings/memory`).
  - Библиотека — `document.controller.ts:78-135` (список, чтение с `extractedText`, multipart PDF, текстовое создание, patch, delete). PDF после upload вызывает `parse-resume` и `offerResume` (`document.controller.ts:137-149`).
- Карточка вакансии и объяснение в чате — `vacancy-card.tsx`, `match-explanation.tsx`; модель — `vacancy-card-model.ts`.
- Панель чата уже читает навыки и факты read-only (`context-panel.tsx:28-29`, `use-chat-screen.ts` — загрузка `GET /profile/skills` и `GET /memory` для аккаунта).
- Таблицы `collections`, `favorites`, FK и тест каскада — `schema-statements.ts`, `database.integration.test.ts:222-234`. Сущности TypeORM — `favorite.entity.ts`, `collection.entity.ts`.
- Подбор навыка по строке для резюме/предложений — `TypeOrmProfileStore.matchSkill` (`typeorm-profile.store.ts:150-171`, порог `TRIGRAM_MATCH_THRESHOLD`).
- Загрузка полей карточки для списков — SQL-паттерн в `vacancy-card.ts` / `load-vacancy.ts` (company, location, status, url).
- HTTP-тесты поверхностей аккаунта — `account-surfaces.http.test.ts` (память, библиотека, suggestions, settings).
- Стек форм этапа 13: React Hook Form + Yup, Lucide, Zustand (`apps/web/package.json`).

Не переиспользовать / не подходит:

- Подписи Profile / Library / Memory / Favorites без `Link` — заменить навигацией (`chat-sidebar.tsx:137-142`).
- Прямой `POST /profile/skills` только по известному `skillId` без поиска по каталогу — для ручного добавления нужен публичный поиск навыков (сейчас маршрута нет; `matchSkill` только внутри store).
- Импорт `apps/core-api` из `apps/web`. Общее — `@hira/contracts` и тонкие клиенты feature-*.
- EventSource, прокси файлов через Next Route Handler для больших PDF — браузер бьёт в `NEXT_PUBLIC_CORE_API_URL` с `FormData`, как для SSE.
- `favorite-status.enum` из черновика Wiki §packages — enum не нужен: статуса отклика нет (Q15).

Открытых PR нет (`gh pr list --state open` пуст).

## 3. Решение

Один клиент `apps/web` на уже существующем `core-api`, плюс **узкий REST-слой избранного и коллекций** и **один read-only маршрут поиска навыков** — без них экраны из журнала не закрываются, хотя журнал формулирует этап как frontend. Порядок SSE, память в ходе чата и parse-resume не меняются.

### Кто что видит

**Demo.** Чат и регистрация как сейчас. Переход на `/profile`, `/library`, `/memory`, `/favorites` — редирект на `/login` (или экран «Sign in required» с той же ссылкой), запросы к API не шлём: иначе `403`. `/billing` — **без входа**, статическая вёрстка (ADR-019).

**Аккаунт.** Sidebar ведёт на пять маршрутов. После login/refresh подгружаем pending suggestions и показываем modal/toast (Q22). Cross-chat toggle на `/memory` пишет `PATCH /settings/memory` и обновляет `/me`.

**Избранное из чата.** На `VacancyCard` — кнопка Save / Saved; `POST /api/v1/favorites` с `vacancyId`, `addedBy: USER`. Повтор — идемпотентность через UNIQUE `(user_id, vacancy_id)` → `200` с существующей строкой или `409` с телом — выбрать в §6 вопрос 2.

**Страница `/favorites`.** Список сохранённых: те же свёрнутые карточки, что в чате (без обязательного explain). Группировка по коллекции; фильтр по подстроке в `note`. Закрытая вакансия — та же плашка, что на карточке.

### Карта сценария и риски

| Сценарий | API / события | Риск | Закрытие |
| --- | --- | --- | --- |
| Upload PDF | `POST /documents` multipart | большой файл, parse fail | лимит `PDF_MAX_BYTES`, `parseStatus` FAILED, suggestions всё равно через GET |
| Accept skill suggestion | `POST .../accept` | пустой ESCO → skillId null | modal показывает `payload.surface`, accept disabled с пояснением |
| Forget all memory | `DELETE /memory` | mis-click | confirm dialog |
| Cross-chat off | `PATCH settings/memory` | факты «пропали» из чата | copy на экране: facts kept, not used (Wiki §4.2) |
| Favorite deleted vacancy | FK | список ломается | JOIN + soft show «vacancy removed» или CASCADE — вопрос 2 |
| Две вкладки | нет realtime | дубли toggle | optimistic UI + reload on focus |
| Demo hits account API | 403 | шум в консоли | guard на layout `(app)` для account-only routes |

Офлайн: очереди нет; ошибка `fetch` — toast/inline, черновики форм остаются в поле.

## 4. Архитектура

### Файлы

**Новые — `apps/web`:**

- `apps/web/src/app/(app)/profile/page.tsx`, `memory/page.tsx`, `library/page.tsx`, `favorites/page.tsx`, `billing/page.tsx`
- `apps/web/src/features/profile/` — `profile-form.tsx`, `profile-skills.tsx`, `skill-combobox.tsx`, `profile-api.ts`, `profile.schema.ts` (+ `*.test.ts` для schema и formatters)
- `apps/web/src/features/memory/` — `memory-view.tsx`, `memory-row.tsx`, `memory-api.ts`
- `apps/web/src/features/library/` — `library-view.tsx`, `document-editor.tsx`, `library-api.ts`
- `apps/web/src/features/favorites/` — `favorites-view.tsx`, `favorites-api.ts`
- `apps/web/src/features/suggestions/` — `suggestion-modal.tsx`, `suggestion-api.ts`, `format-suggestion.ts` (+ test)
- `apps/web/src/features/billing/` — `billing-plans.tsx`, `billing.constants.ts` (цены/labels mock)
- `apps/web/src/features/vacancy/favorite-toggle.tsx` (+ test идемпотентности UI-state)
- `apps/web/src/common/components/modal.tsx` (если suggestion modal не укладывается в drawer)
- `apps/web/src/features/account/require-account.tsx` — HOC/layout guard для account routes

**Меняются — `apps/web`:**

- `chat-sidebar.tsx` — `Link` на маршруты; опционально вторичная ссылка Billing
- `vacancy-card.tsx` — slot для `FavoriteToggle`
- `app-shell.tsx` или `(app)/layout.tsx` — poll/load suggestions после account bootstrap
- `message-input.tsx` / `chat.constants.ts` — баннер демо: ссылка на `/billing` (Wiki §5), не только `/register` — вопрос 4
- `chat-view.tsx` / `use-chat-screen.ts` — передать `vacancyId` в toggle, refresh favorites cache optional

**Новые — `apps/core-api` (избранное + навыки):**

- `apps/core-api/src/features/favorite/favorite.module.ts`, `favorite.controller.ts`, `favorite.service.ts`, `favorite.store.ts`, `typeorm-favorite.store.ts` (+ `favorite.http.test.ts`)
- `apps/core-api/src/features/favorite/collection.service.ts` или методы в том же сервисе
- `apps/core-api/src/features/skills/skill.controller.ts` — `GET skills?q=` (account optional: только authenticated — вопрос 3)
- Регистрация модулей в `app.module.ts`

**Новые — `packages/contracts`:**

- `favorite.dto.ts`, `collection.dto.ts`, `create-favorite-request.dto.ts`, `update-favorite-request.dto.ts`
- `skill-search-hit.dto.ts` — `{ skillId, canonicalName }`
- экспорт в `index.ts`

**Меняются — `apps/core-api`:**

- при необходимости общий SQL-срез «краткая вакансия» рядом с `vacancy-card.ts`, чтобы favorites и чат не разошлись

Функции короче 15–20 строк; mock-цены и лимиты заметок — константы feature-level.

### Типы (контракт)

```ts
interface FavoriteDto {
  id: string;
  vacancyId: string;
  collectionId: string | null;
  note: string | null;
  addedBy: AuthorKind;
  createdAt: string;
  vacancy: VacancyCardSummary; // title, companyName, locationLabel, status, url, pay fields — без MatchExplanation
}

interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

interface CreateFavoriteRequest {
  vacancyId: string;
  collectionId?: string | null;
  note?: string | null;
}

interface SkillSearchHitDto {
  skillId: number;
  canonicalName: string;
}
```

`VacancyCardSummary` — новый узкий тип в contracts или reuse полей из `VacancyDto` без explanation (рекомендация: отдельный тип, чтобы не тащить skills[] в список избранного).

### Источники правды

| Значение | Где живёт | Кто пишет |
| --- | --- | --- |
| Профиль | `user_profiles` | `PUT /profile` |
| Навыки профиля | `user_profile_skills` | POST/DELETE skills, accept suggestion |
| Предложения | `profile_suggestions` | extract-memory / parse-resume; UI — accept/dismiss |
| Факты памяти | `user_memories` | ход чата (async); UI — patch/delete |
| Cross-chat flag | `users.cross_chat_memory_enabled` | `PATCH /settings/memory`; читается `/me` |
| Документы | `user_documents` + disk `storage/{userId}/{documentId}` | POST/PATCH/DELETE documents |
| Избранное | `favorites` | POST favorites, DELETE; карточка в чате |
| Коллекции | `collections` | POST/PATCH/DELETE collections |
| Каталог навыков | `skills`, `skill_aliases` | ingestion ESCO; UI только читает search |
| Mock-тарифы | константы в `billing.constants.ts` | только frontend |
| Pending suggestions UI | Zustand или локальный state modal | клиент после GET |

### Контракт HTTP

**Уже есть** — §1.5 и §1.8 Wiki; клиенты feature-* оборачивают те же пути.

**Добавить:**

| Метод | Путь | Тело / ответ |
| --- | --- | --- |
| `GET` | `/api/v1/favorites` | query: `collectionId?`, `q?` (note search) → `FavoriteDto[]` |
| `POST` | `/api/v1/favorites` | `CreateFavoriteRequest` → `FavoriteDto` |
| `PATCH` | `/api/v1/favorites/{id}` | `{ collectionId?, note? }` |
| `DELETE` | `/api/v1/favorites/{id}` | 204 |
| `GET` | `/api/v1/collections` | `CollectionDto[]` |
| `POST` | `/api/v1/collections` | `{ name, description? }` |
| `PATCH` | `/api/v1/collections/{id}` | partial |
| `DELETE` | `/api/v1/collections/{id}` | 204; favorites `collection_id` → NULL (DB ON DELETE) |
| `GET` | `/api/v1/skills` | query `q` (min 2 chars) → `SkillSearchHitDto[]` |

Все маршруты избранного, коллекций и (если не demo) skills — `403` для demo, `404` для чужого id, как `account-surfaces`.

SSE и `/messages` **не меняются**.

### Миграции и выкладка

Новых таблиц нет. Порядок: `@hira/contracts` → `core-api` (favorites + skills GET) → `web`. Старый web без API favorites просто не показывает кнопку Save, если `GET` вернёт 404 на модуль — поэтому деплой core-api раньше web.

### Порядок работ (реализация)

1. Contracts + favorite store + HTTP tests в core-api.
2. `GET /skills` + тест trigram/empty ESCO.
3. Web: account guard + sidebar links.
4. Profile + skill combobox + suggestions modal.
5. Library list/upload/editor + shared suggestion modal после PDF.
6. Memory list + toggle + bulk forget.
7. Favorites page + toggle on card.
8. Billing static + баннер demo.

## 5. Матрица тестов

Сначала тест, потом код. Vitest `node`, `*.test.ts` рядом с логикой. Postgres/Redis/OpenRouter в unit-тесты не входят.

**core-api:**

- POST favorite twice same vacancy → одна строка (unique).
- POST favorite with чужой `collectionId` → 403/404.
- DELETE collection → favorite остаётся, `collectionId` null (как integration test).
- GET favorites `q` фильтрует note case-insensitive.
- GET skills `q` shorter than 2 → [] или 400 (зафиксировать в контроллере).
- Demo cookie на favorites → 403.

**web (чистые функции / reducers):**

- `format-suggestion` для SKILL vs SALARY vs EDUCATION → заголовок modal.
- `profile.schema` — enum seniority/work format из contracts.
- `favorite-toggle` state: idle → saving → saved / error.
- Guard: demo session → redirect path `/login` (pure function).

**Ручной smoke (runbook, не CI):**

- Upload PDF → suggestions → accept → skill on profile.
- Cross-chat off → chat still answers; memory list shows facts but toggle explains behavior.
- `/billing` monthly/yearly toggle меняет только UI.

## 6. Вопросы

1. **Автодополнение навыков.** Wiki требует graph autocomplete; публичного API нет, есть `matchSkill` SQL. **Рекомендую:** `GET /api/v1/skills?q=` (account), ответ top 20 по trigram + exact, reuse порог 0.8.
2. **Тело `FavoriteDto`.** Список без `/vacancies/{id}`. **Рекомендую:** join к `vacancies` + `locations` в store, вернуть `VacancyCardSummary`; при отсутствии строки — не показывать в списке или placeholder «Vacancy removed».
3. **Глубина коллекций.** Wiki: группировка и API CRUD. **Рекомендую:** MVP — default collection создаётся при первом favorite POST; UI группировка + простой select; полный CRUD коллекций в sidebar favorites page, без drag-and-drop.
4. **Баннер demo.** Этап 13 вёл на `/register`; Wiki §5 — `/billing`. **Рекомендую:** primary link `/billing`, secondary «Sign up» → `/register` на той же строке.
5. **Сохранение md/txt из чата.** Backend POST document есть, UX подтверждения из generate — нет. **Рекомендую:** не входить в этап 14; только ручное создание/редактирование на `/library`.
6. **Избранное от LLM.** **Рекомендую:** только пользовательская кнопка; `addedBy: ASSISTANT` зарезервировать в API, UI не выставляет до диплома/отдельной задачи.
7. **`preferredLocations` в профиле.** Int[] без GET `/locations`. **Рекомендую:** на этап 14 не показывать picker городов; поле скрыть или оставить read-only пустым, не блокируя остальную форму.
