# Этап 13. План до кода

Статус на момент плана: страницы чата, карточек и вызова ещё нет. `apps/web` — заглушка «Hira» и проверка живости. Поиск, SSE, чаты, квота и сессии вызова уже отвечает `core-api`.

Этап 13 в журнале: «Next.js, dark EN UI, SSE, vacancy cards, match explanation, экран Call, spinner «Searching…»». Источник фактов — `Wiki/06-frontend.md` §1–5, `Wiki/05-api-contracts.md` §1.1–1.2 и §1.6 и §1.8, `Wiki/11-hira.md` §4.1 и §4.4, `Wiki/07-auth-and-memory.md` §1–2, ADR-028. Где статья шире журнала, в код идёт рекомендация из §6, если обсуждение PR её не заменит.

План лежит в `docs/stage-13-plan.md`, как планы этапов 8–12. Каталога `specs/` в этом репозитории нет.

## 1. Задача

Цель: вошедший или демо-пользователь ведёт чат на английском тёмном экране, видит поток ответа и карточки с объяснением, а зарегистрированный пользователь открывает экран вызова и говорит с Hira без нового чата.

Чек-лист. Каждый пункт — цитата журнала или статьи, не догадка.

- Журнал: «Frontend: чат, стриминг, вызов» и «spinner «Searching…»» — `Wiki/progress-log.md`.
- Стек экрана. «Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS v4, Zustand, Lucide React, Yup для форм» — `Wiki/06-frontend.md` §1. Формы — «React Hook Form + Yup» — §4.
- Чат. «Трёхколоночная раскладка»: список чатов, лента, «Панель контекста» с намерением, фильтрами и фактами памяти — §2.1.
- Карточка. «заголовок, компания, зарплата, локация, формат, интегральный скор, 3–4 совпавших навыка бейджами» — §2.2.
- Объяснение. «горизонтальная столбчатая диаграмма по факторам»; три группы навыков, путь графа «Docker → Kubernetes»; «бейджи ветвей»; «при наведении на навык — цитата» `evidence_span` — §2.2.
- Вызов. «Маршрут `/call` и кнопка Call». «Это не чат»: нет ленты в sidebar и нет поля ввода как главного действия. «listening / speaking», «субтитры последних реплик», карточки «только если реплика запустила поиск». «Озвучка и распознавание — в браузере. Транскрипт на сервере есть, в списке чатов его нет» — §2.7 и `Wiki/11-hira.md` §4.4.
- Поток. `fetch` + `ReadableStream`, не `EventSource`. Порядок: `user-message`, затем `intent` и индикатор «ищу…», затем `results` сразу, затем `token` над карточками, затем `done` — §3. Журнал задаёт английскую подпись спиннера: «Searching…».
- Обрыв. «если ответ уже сохранён на сервере — подтягивается через `GET /messages`» — §3.
- Состояние. Серверные чаты и вакансии; клиент — «черновик сообщения, открытые карточки, состояние стрима, тема» в Zustand — §4.
- Оформление. «Язык UI: English only». «Тёмная по умолчанию», «`#0a0e17` → `#1e3a5f` → `#2563eb`». «Светлой темы нет». На мобильных sidebar и панель — «выдвижные шторки». «`aria-live` для стримящегося ответа», контраст не ниже AA — §5.
- Демо. «1 чат, 3 запроса». Баннер «Sign up for 20 queries/day». У аккаунта в sidebar «12/20 queries today» — §5. Лимиты — `Wiki/05-api-contracts.md` §1.6.
- Язык ответа Hira — язык реплики, не язык кнопок — ADR-028.
- Вызов только у аккаунта. «Demo остаётся текстовым чатом» — `Wiki/11-hira.md` §4.4. Демо на вызове получает `403` — §1.8.

Поверхности, которые этап называет: браузер, демо и аккаунт, английский интерфейс, тёмная тема, мобильные шторки, обрыв потока. Телефон вне браузера, второй пользователь в той же вкладке, офлайн-очередь и светлая тема не названы. Речь остаётся в браузере.

## Вне этого этапа

- Профиль, библиотека, избранное, память как экраны, mock `/billing` — этап 14. Журнал этапа 13 их не называет.
- Кнопка «в избранное» на карточке. Маршрута избранного в `apps/` нет: поиск по `*controller*.ts` на `favorites` пуст.
- `GET /api/v1/vacancies/{id}`, `/similar`, `/skill-gap`. Карточка раскрывается из уже пришедшего `VacancyResult`.
- Предложения профиля, правка файла из чата, выключатель межчатовой памяти. Это экраны этапа 14. Ход по-прежнему пишет факты сам; этот этап их не подтверждает.
- Релаксация фильтров. `relaxationSteps` в ответе есть, но поиск всегда кладёт пустой массив (`apps/retrieval-service/src/features/search/run-search.ts:194`). Этот этап массив не заполняет.
- `lastEventId`. `writeSse` пишет `event` и `data` и не пишет `id:` (`apps/core-api/src/features/chat/chat-http.ts:40-41`). Новых полей SSE нет.
- MCP, автоотклик, источники 4–6, бенчмарк.
- `Wiki/` этим планом не менять. Процент этапа остаётся 0, пока экранов нет.

## 2. Что уже есть

Переиспользовать как есть:

- Каркас `apps/web`: Next 15, React 19, Tailwind 4, `@hira/contracts` (`apps/web/package.json`). `html lang="en"` и тёмный фон (`apps/web/src/app/layout.tsx:9-14`). Главная — заглушка (`apps/web/src/app/page.tsx`). Живость `GET /health` и `GET /health/ready` остаётся.
- Браузер уже знает адрес API: `NEXT_PUBLIC_CORE_API_URL=http://localhost:4000` (`docker-compose.yml:205-209`). Сервер Next для живости ходит в `CORE_API_URL` (`apps/web/src/features/health/health.constants.ts:6-8`). Это разные переменные.
- CORS с cookie уже открыт на origin веба, по умолчанию `http://localhost:3000` (`apps/core-api/src/configure-http-app.ts:12`, `apps/core-api/src/features/auth/auth.config.ts:4`).
- Вход. `POST /api/v1/auth/register|login` отдаёт `accessToken` и `expiresIn`, refresh кладёт в httpOnly cookie (`apps/core-api/src/features/auth/auth.controller.ts:48-81`, `auth-http.ts:77-79`). `POST /auth/refresh` и `POST /auth/logout` крутят ту же cookie (`auth.controller.ts:85-122`). `GET /auth/me` требует Bearer (`auth.controller.ts:125-128`). Тело — `CurrentUserDto` (`packages/contracts/src/common/dto/auth/current-user.dto.ts:4-10`).
- Cookie: `httpOnly`, `Secure`, `SameSite=Strict` (`auth-http.ts:35-42`). На `http://localhost` браузер считает контекст безопасным, флаг `Secure` менять не нужно. Порт в cookie не входит: cookie, выставленная `:4000`, уходит и на `:3000`, и на `:4000`.
- Демо. Нет заголовка `Authorization` и нет refresh — middleware ставит `demoSessionId` (`demo-session.middleware.ts:11-17` и `21-24`). Bearer важнее cookie (`actor-hint.ts:6-12`).
- Чаты. Список, создание, карточка чата, правка, удаление, история — `chat.controller.ts`. `GET /chats` у демо создаёт единственный чат (`chat.controller.ts:35-36`). Второй `POST /chats` — `429`.
- Поток сообщения. `POST /api/v1/chats/:chatId/messages` (`search.controller.ts:44-64`). Порядок записи: `user-message`, `intent`, `results` или `error`, `token`, `assistant-message`, `done` (`orchestrate-search.ts:110-121` и `151-171`). Имена событий — `SSE_EVENT` (`chat.constants.ts:24-32`).
- Поиск только у `SEARCH`, `REFINE`, `COMPARE` (`orchestrate-search.ts:30` и `158`). `SMALL_TALK` и `CAREER_ADVICE` тоже шлют `results`, но список пустой (`emptyRetrieval`, около строки 331). Квота списывается только когда поиск разрешён (`allowSearch`, `175-179`). Отказ — `event: error`, код `RATE_LIMIT_EXCEEDED`, без `done`. Сбой retrieval — `SEARCH_UPSTREAM_UNAVAILABLE`. Сбой generate карточки не стирает.
- История. `ChatMessageView`: у ассистента есть `results`, у пользователя полей намерения в JSON нет (`chat.dto.ts:18-24`, `chat.presenter.ts:23-34`). В строке `messages` намерение и диагностика уже лежат и читаются (`typeorm-chat.sql.ts:22-23`). Презентер их выбрасывает.
- Карточка вакансии. `VacancyDto` (`vacancy.dto.ts:13-39`) и `MatchExplanation` (`match-explanation.dto.ts:19-34`). Скор результата равен `explanation.totalScore`, шкала факторов 0..100 (`run-search.ts:146`, `score-factors.ts:16`, проверка в `search.router.test.ts:109`). Ветви — enum `RetrievalBranch`.
- Компания и город в базе есть: `vacancies.company_name` (`vacancy.entity.ts:110-111`), `locations.city` и `locations.region` (`schema-statements.ts:180-184`). В оба SELECT карточки эти колонки не входят (`load-vacancy.ts:129-137`, `vacancy-card.ts:68-75`).
- Навык профиля наружу — `skillId` без имени (`profile.dto.ts:27-33`, SQL `typeorm-profile.store.ts:67-69`). Имя лежит в `skills.canonical_name` (`schema-statements.ts:309-311`).
- Память читается `GET /api/v1/memory` (`memory.controller.ts:50-51`). Демо — `403` `ACCOUNT_REQUIRED` (`memory.constants.ts:36-37`, `require-user-id.ts:5-7`).
- Квота считается в Redis, наружу остаток не отдаётся. `CounterStore` умеет `increment` и не умеет читать значение (`counter.store.ts:4-10`). Лимиты 3 и 20 — `auth.constants.ts:22-23`.
- Вызов. `POST /api/v1/calls`, `POST /calls/:id/turns` тем же SSE, `POST /calls/:id/end` (`call.controller.ts:39-83`). Повторный `end` не сдвигает время. Реплика в завершённый вызов — `400`. Списка реплик и `GET` сессии нет (`call.store.ts:23-29`).
- Разбор SSE на сервере уже есть и остаётся там: `createSseParser` (`sse-parser.ts:6-16`). Веб его не импортирует.
- Тесты веб — `*.test.ts` в среде `node`. `vitest.config.ts` не включает `tsx` и не поднимает jsdom.

Не переиспользовать:

- `EventSource`. Статья прямо исключает его: нужен POST и заголовок.
- Прокси потока через маршрут Next. Буфер маршрута разрежет SSE. Браузер бьёт в `NEXT_PUBLIC_CORE_API_URL`.
- `localStorage` для access-токена. Refresh уже в httpOnly cookie.
- Axios, библиотеку графиков, отдельную speech-модель. Столбцы — ширина блока в процентах. Речь — `SpeechRecognition` и `speechSynthesis` браузера.
- Экран избранного, библиотеки, профиля, памяти, billing.
- Импорт `apps/core-api` из `apps/web`. Общее — только `@hira/contracts`.

Библиотеки, которых в `package.json` ещё нет. Лицензии сняты `npm view` 2026-10-18: `zustand` MIT, `lucide-react` ISC, `yup` MIT, `react-hook-form` MIT, `@hookform/resolvers` MIT. Все бесплатны для этой работы.

Открытых PR нет (`gh pr list --state open` пуст).

## 3. Решение

Один браузерный клиент на уже существующем `core-api`. Порядок событий и дирижёр хода не меняются. Четыре узких дополнения контракта нужны, чтобы названные экраны не были пустыми: компания и город на карточке, имя навыка профиля, остаток квоты у аккаунта, намерение в истории. Это §6. Пока обсуждение PR их не заменит, реализация идёт по ним.

Вход и регистрация входят в этап. Журнал их не называет, но вызов без аккаунта не открыть, а экрана входа нет ни в этапе 13, ни в этапе 14. Вопрос 1.

### Кто что видит

Демо. Первый заход на чат без Bearer. `GET /api/v1/chats` с `credentials: 'include'` получает cookie и один чат. Три поисковых хода. Четвёртый показывает баннер и ведёт на `/register` (вопрос 7). Память и навыки не запрашиваются: ответ был бы `403`. Кнопка Call ведёт на `/login`, запрос `POST /calls` не отправляется.

Аккаунт. При загрузке вкладка один раз вызывает `POST /auth/refresh` с cookie. Успех сохраняет access-токен в памяти и читает `/me`. Ошибка — это демо, не экран ошибки. Дальше каждый запрос к API несёт `Authorization: Bearer` и `credentials: 'include'`. Bearer на сервере побеждает демо-cookie. Выход вызывает `POST /auth/logout` и стирает токен из памяти.

Чат. Слева список, центр — лента и поле, справа — намерение текущего хода. На узком экране левая и правая колонки — шторки. Новый чат — `POST /chats`, затем переход на `/chat/{id}`. Пустой чат показывает поле по центру.

Вызов. Отдельный маршрут `/call`. В списке чатов сессии нет. Главное действие — слушать и говорить. Карточки появляются под субтитрами только если в `results` есть элементы.

Другая вкладка тот же чат сама не обновляет. Общего канала кроме SSE текущего хода нет. Обновила страницу — видит то, что уже записано.

### Ход чата

1. Черновик остаётся в поле, пока POST не открыл поток. Пустую строку не слать. Длиннее 4000 символов не слать.
2. `user-message` — реплика в ленте, поле пустое, спиннер «Searching…».
3. `intent` — правая панель. Если тип не `SEARCH`, `REFINE` и не `COMPARE`, спиннер снимается: поиск не пойдёт.
4. `results` — карточки сразу, спиннер снимается. Текст ответа ещё пустой и стоит над карточками.
5. `token` — дописывает этот текст. Область с `aria-live="polite"`.
6. `assistant-message` — заменяет собранный текст сохранённым и прикрепляет тот же список карточек.
7. `done` — индикаторы сняты. Аккаунт после этого ещё раз читает `/me`, чтобы обновить «12/20».
8. `error` — спиннер снят. `RATE_LIMIT_EXCEEDED` показывает баннер. `SEARCH_UPSTREAM_UNAVAILABLE` показывает `message`. Карточек нет. `done` после такого `error` сервер не шлёт.

Поле заблокировано, пока поток открыт. Повторный POST той же реплики создал бы второе сообщение: ключа идемпотентности нет.

Обрыв после открытия потока: POST не повторять. `GET /api/v1/chats/{id}` подтягивает ленту. Если ассистент уже сохранён, показать его и снять спиннер. Если сохранена только реплика пользователя, оставить её и текст ошибки «Answer was interrupted».

Обрыв до заголовков: черновик остаётся в поле. Перед повтором прочитать чат. Если последняя реплика пользователя совпала с черновиком, POST не повторять.

Access-токен живёт 15 минут (`ACCESS_TOKEN_TTL_SECONDS`). Перед POST, если до `exp` меньше 60 секунд, сначала `refresh`. 401 на запросе без тела: один `refresh` и повтор только если чтение чата не показало уже записанную реплику.

### Карточка и объяснение

Свёрнуто: заголовок, `companyName`, подпись места, зарплата или ставка, формат, целый скор, до 4 бейджей из `matchedSkills`. Раскрытие — локальное, id карточки в Zustand. Внутри шесть полос на 0..100 в порядке `MatchFactor`, три списка навыков, бейджи `retrievedBy`. Путь графа показывается у навыка, где `path` не пуст. Наведение показывает `evidenceSpan`.

Статус не `ACTIVE` — плашка «vacancy no longer active» и ссылка `url`. Страница избранного при этом не строится.

Пустые `relaxationSteps` блок «смягчено» не рисуют. Жёсткие фильтры из `intent.hardConstraints` рисуются, когда поля заданы.

### Вызов

`POST /calls` после входа. Фазы: listening, thinking, speaking. Распознавание — браузерный `SpeechRecognition` (в Chromium — `webkitSpeechRecognition`), язык — `navigator.language`, не принудительный английский: ответ Hira идёт на языке реплики. Конечная фраза уходит в `POST /calls/:id/turns` тем же разбором SSE, что чат. «Searching…» — на thinking, пока тип намерения поисковый и `results` ещё нет. По `done` браузер произносит текст ассистента через `speechSynthesis` и возвращается к listening. End отменяет распознавание и озвучку и вызывает `POST /calls/:id/end`. Уход со страницы шлёт `end` через `fetch` с `keepalive`.

Субтитры — последние 6 реплик этой вкладки, не лента мессенджера. Серверного `GET` реплик нет, после обновления страницы сессия завершается уходом, новая начинается с Start. Вопрос 8 — запасной ввод, если распознавания в браузере нет.

### Панель

Для аккаунта при открытии чата: `GET /profile/skills` и `GET /memory`. Имена навыков — `canonicalName`. Память — число и короткие формулировки, без закрепить / забыть / править. Демо эти запросы не делает.

Намерение и диагностика берутся из последнего пользовательского сообщения, у которого они есть, и подменяются живым `intent` текущего потока. После перезагрузки их отдаёт тот же `GET` чата, если вопрос 5 принят.

Пункты Profile, Library, Memory, Favorites в боковой колонке видны и не ведут на маршруты. Вопрос 6.

### Что не так с данными карточки

`VacancyDto` не содержит имени компании и города, хотя колонки есть. Без вопроса 2 карточка покажет заголовок, деньги и формат, а компания и город останутся пустыми. Оба SELECT, поток и история, должны получить одни и те же поля, иначе живой ход и открытый позже чат разойдутся.

## 4. Архитектура

### Файлы

Новые, рядом с тестом, где есть логика:

- `apps/web/src/features/auth/auth.schema.ts` — Yup, лимиты пароля 10 и 128.
- `apps/web/src/features/auth/auth.schema.test.ts`
- `apps/web/src/features/auth/session.store.ts` — токен и пользователь в памяти вкладки.
- `apps/web/src/features/auth/session.ts` — refresh, `/me`, один повтор на 401. Чистые решения покрывает `session.test.ts`.
- `apps/web/src/features/auth/login-form.tsx`, `register-form.tsx`
- `apps/web/src/features/chat/sse-parser.ts` и `sse-parser.test.ts` — свой разбор кадров, та же идея, что `createSseParser`, без импорта core-api.
- `apps/web/src/features/chat/reduce-chat-event.ts` и тест — лента, спиннер, карточки, баннер.
- `apps/web/src/features/chat/chat.service.ts` — `fetch` потока.
- `apps/web/src/features/chat/chat.store.ts`
- `apps/web/src/features/chat/chat-sidebar.tsx`, `chat-view.tsx`, `message-list.tsx`, `message-input.tsx`, `context-panel.tsx`
- `apps/web/src/features/vacancy/vacancy-card-model.ts` и тест — подписи, 4 бейджа, плашка, полосы.
- `apps/web/src/features/vacancy/vacancy-card.tsx`, `match-explanation.tsx`
- `apps/web/src/features/call/call-phase.ts` и тест — listening / thinking / speaking.
- `apps/web/src/features/call/call-view.tsx`, `call.store.ts`
- `apps/web/src/app/(auth)/login/page.tsx`, `register/page.tsx`
- `apps/web/src/app/(app)/layout.tsx` — оболочка, кнопка Call, шторки.
- `apps/web/src/app/(app)/chat/page.tsx`, `chat/[chatId]/page.tsx`, `call/page.tsx`
- `apps/web/src/common/components/` — button, input, skeleton, drawer. Отдельного modal нет: удаление чата подтверждается второй кнопкой в строке.

Меняются:

- `apps/web/package.json` — пять зависимостей из §2.
- `apps/web/src/app/globals.css` — токены `#0a0e17`, `#1e3a5f`, `#2563eb`.
- `apps/web/src/app/layout.tsx` — фон токена, `lang="en"` остаётся.
- `apps/web/src/app/page.tsx` — переход на `/chat`.
- `packages/contracts/src/common/dto/vacancy/vacancy.dto.ts` — `companyName`, `locationLabel`.
- `packages/contracts/src/common/dto/profile/profile.dto.ts` — `canonicalName`.
- `packages/contracts/src/common/dto/auth/current-user.dto.ts` — `searchQuota`.
- `packages/contracts/src/common/dto/chat/chat.dto.ts` — необязательные `intent` и `diagnostics` у сообщения.
- `apps/retrieval-service/src/features/search/load-vacancy.ts` — те же поля в SELECT и в `readVacancy`.
- `apps/core-api/src/features/chat/vacancy-card.ts` — тот же SELECT, чтобы история совпала с потоком.
- `apps/core-api/src/features/chat/chat.presenter.ts` — отдаёт уже прочитанные `intent` и `diagnostics` у роли `USER`.
- `apps/core-api/src/features/profile/typeorm-profile.store.ts` — join `skills.canonical_name` в `listSkills`. `skillOf` и `manualSkill` (`profile.store.ts:66`) получают имя.
- `apps/core-api/src/features/auth/user.store.ts` — `toCurrentUser` дополняет квоту. Swagger-класс `CurrentUserResponseDto` тоже.
- `apps/core-api/src/features/redis/counter.store.ts` и обе реализации — `read(key): Promise<number | null>`.
- `apps/core-api/src/features/rate-limit/search-quota.service.ts` — чтение без `increment`.
- Фабрики `VacancyDto`: `search-fixture.ts` `vacancy` и `search.router.test.ts` `vacancyDto`. Остальные литералы поймает `tsc`.

Не меняются: `orchestrate-search.ts` (порядок событий), cookie-флаги, `docker-compose.yml`, миграции. Колонки компании и города уже есть.

Функции короче 15–20 строк. Подписи UI, лимит бейджей 4, окно субтитров 6, порог обновления токена 60 секунд — именованные константы.

### Типы

В `packages/contracts`, поля добавлены к уже существующим интерфейсам:

```ts
interface VacancyDto {
  companyName: string;
  locationLabel: string | null;
}

interface ProfileSkillDto {
  canonicalName: string;
}

interface CurrentUserDto {
  searchQuota: { used: number; limit: number };
}

interface ChatMessageView {
  intent?: SearchIntent;
  diagnostics?: RetrievalDiagnostics;
}
```

`companyName` пустая строка, если в колонке пусто. `locationLabel` — город и регион через запятую, либо один из них, либо `null`. Клиент отсутствующее `companyName` читает как `''`: старый ответ без поля не ломает ленту.

Внутри веба:

```ts
type SessionStatus = 'unknown' | 'anonymous' | 'account';

type StreamPhase = 'idle' | 'searching' | 'writing';

type CallPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VacancyCardModel {
  title: string;
  company: string;
  location: string;
  pay: string;
  format: string | null;
  score: number;
  badges: string[];
  closed: boolean;
  originalUrl: string;
}
```

`StreamPhase` и модель карточки считают чистые функции. Компонент их рисует.

### Источники правды

| Значение | Где живёт | Кто пишет |
| --- | --- | --- |
| Access-токен | память вкладки | login и refresh. На диск не кладётся |
| Refresh | httpOnly cookie | `auth.controller` |
| Демо-сессия | cookie `demoSessionId` | `DemoSessionMiddleware`. Клиент её не стирает |
| Чаты и реплики | `chats`, `messages` | ход и CRUD чата |
| Объяснение показанной вакансии | `message_vacancies` | ход, как сейчас |
| Поля карточки при открытии истории | живой `SELECT` из `vacancies` | `vacancy-card.ts`. Снимок объяснения не пересчитывается |
| Намерение панели | `messages.intent` у реплики пользователя | ход. Экран читает SSE и затем GET |
| Квота | Redis | `SearchQuotaService`. Экран читает `/me` и сам счётчик не увеличивает |
| Имена навыков профиля | `skills.canonical_name` | загрузка ESCO. Экран читает `GET /profile/skills` |
| Факты на панели | `user_memories` | хвост хода. Этот экран не вызывает PATCH и DELETE |
| Сессия вызова | `call_sessions`, `call_turns` | `POST /calls`, реплика, `end` |
| Субтитры и фаза звонка | Zustand | вкладка. После ухода страница завершает сессию |
| Черновик, раскрытые карточки, фаза потока | Zustand | вкладка |
| Тема | CSS-токены | переключателя нет |

### Контракт HTTP

Новых маршрутов нет. События чата и вызова те же: `user-message`, `intent`, `results`, `token`, `assistant-message`, `done`, `error`.

`GET /api/v1/auth/me` добавляет `searchQuota`. Нет ключа в Redis — `used: 0`, `limit: 20`. Чтение не списывает квоту. Демо `/me` не вызывает.

`GET` чата и `GET` истории кладут `intent` и `diagnostics` на сообщение пользователя, когда они есть. У ассистента по-прежнему `results`.

`VacancyDto` в потоке, в истории и в `call_turns.results` получает `companyName` и `locationLabel`.

`GET /profile/skills` добавляет `canonicalName`. Демо по-прежнему `403`.

Тело `POST .../messages` не меняется. Клиент не шлёт `useMemory`: сервер трактует отсутствие как чтение памяти.

### Миграции и выкладка

Миграции нет. Меняются SELECT и JSON.

Порядок: сначала `@hira/contracts`, затем `core-api` и `retrieval-service`, затем `web`. Старый веб новые поля игнорирует. Новый веб на старом API показывает пустую компанию и не рисует счётчик, пока `/me` не отдаст `searchQuota`.

### Порядок и гонки

`done` по-прежнему уходит до хвоста памяти. Панель фактов, прочитанная сразу после `done`, может ещё не видеть факт этого хода. Повторное чтение при следующем открытии чата его покажет. Отдельного события «факт записан» нет, и этот этап его не добавляет.

Два сообщения подряд невозможны, пока поток открыт: поле заблокировано. Две вкладки одного аккаунта друг о друге не знают. Оба поиска списывают одну квоту.

Повтор POST после обрыва создаёт вторую реплику. Поэтому повтор запрещён, как только сервер мог успеть записать сообщение.

Вызов и чат делят дневной счётчик. Разговор вызова его не двигает. Поисковая реплика вызова двигает, и следующий `/me` это показывает.

Офлайн ход не ставится в очередь. Нет сети до заголовков — черновик остаётся, пользователь видит ошибку.

## 5. Матрица тестов

Сначала тест, потом реализация. Живые браузер, микрофон, OpenRouter, Redis и Postgres в эти тесты не входят. Среда vitest остаётся `node`, файлы — `*.test.ts`. Компоненты покрываются чистыми функциями, которые они вызывают.

Основные сценарии:

- Разбор SSE: кадр, разрезанный между чанками, собирается; два кадра в одном чанке дают два события; битый JSON не роняет читатель.
- Редьюсер хода: после `user-message` фаза `searching`; `intent` с `SMALL_TALK` снимает её до токенов; `SEARCH` держит «Searching…» до `results`; `results` кладёт карточки и снимает спиннер до первого `token`; токены дописываются в текст над карточками; `done` оставляет карточки; `error` `RATE_LIMIT_EXCEEDED` ставит баннер и не ждёт `done`; `SEARCH_UPSTREAM_UNAVAILABLE` не рисует карточки.
- Обрыв: решение «перечитать чат, не слать POST» принимается, если поток открылся; до заголовков черновик сохраняется и POST можно повторить только когда в чате этой реплики ещё нет.
- Карточка: не больше 4 бейджей; статус не `ACTIVE` даёт плашку и `url`; пустое имя компании не подменяется заголовком; полоса фактора шириной в его скор при шкале 0..100; путь графа виден у `relatedSkills`.
- Схема входа: пароль короче 10 символов не уходит на сервер.
- Сессия: неуспешный refresh — аноним; успешный сохраняет токен; 401 с уже записанной репликой не повторяет POST.
- Вызов: демо не вызывает `POST /calls`; конечная фраза переводит в thinking; пустой `results` не рисует карточки; `done` переводит в speaking; end возвращает idle.
- Презентер: у пользователя в JSON есть `intent`, у ассистента — `results`.
- Оба SQL карточки содержат `company_name` и соединение с `locations`. Маппер из строки с городом и регионом собирает `locationLabel`.
- `listSkills` отдаёт `canonicalName`. `read` отсутствующего ключа квоты даёт `used: 0` и не вызывает `increment`.

Конкурентность на клиенте: второй submit не уходит, пока фаза не `idle`. Две вкладки этот набор не гоняет.

## 6. Вопросы

1. Журнал не называет экраны входа, а `POST /calls` требует аккаунт. Этап 14 вход тоже не называет. **Рекомендую:** `/login` и `/register` в этом этапе. Пароль 10..128, как `auth.constants.ts`.
2. Карточка в статье показывает компанию и локацию. `VacancyDto` отдаёт `companyId` и `locationId`. Имя и город уже лежат в `vacancies.company_name` и `locations`. **Рекомендую:** `companyName: string` и `locationLabel: string | null` в обоих SELECT, без миграции.
3. Панель чата показывает навыки профиля словами. `GET /profile/skills` отдаёт `skillId`. **Рекомендую:** `canonicalName` через join `skills`. Редактор профиля не делать. Пустой справочник ESCO оставляет блок пустым.
4. Счётчик «12/20 queries today» посчитать нечем: остаток есть только внутри `decideQuota`, а `CounterStore` не читает ключ. **Рекомендую:** `searchQuota` на `GET /auth/me`, новый `read` без списания, нет ключа — `used: 0`. Демо счётчик в sidebar не показывает. Баннер появляется на `RATE_LIMIT_EXCEEDED`.
5. Правая панель после обновления страницы пуста: `intent` в строке есть, в `ChatMessageView` его нет. **Рекомендую:** необязательные `intent` и `diagnostics` у сообщения пользователя. События SSE не менять.
6. Боковая колонка в макете ведёт на избранное, профиль, память и библиотеку. Этих экранов в этапе нет, API избранного нет. **Рекомендую:** подписи без перехода. Кнопку «в избранное» на карточке не ставить.
7. Баннер демо в статье ведёт на `/billing`. Страница тарифов — этап 14. **Рекомендую:** ссылка на `/register` и текст «Sign up for 20 queries/day». `/billing` не создавать.
8. Вызов в браузере без `SpeechRecognition` не может произнести реплику, а поле ввода не должно быть главным действием. **Рекомендую:** вторичная кнопка «Type instead», видна когда API речи нет. При живом микрофоне её нет.
9. Статья про обрыв упоминает `lastEventId`. Поток `id:` не пишет. **Рекомендую:** не добавлять идентификаторы событий. Обрыв закрывается чтением `GET` чата, POST не повторяется.

## 7. Effort

Уровни — для реализации после согласия с планом. `ultracode` не нужен: один клиент и один уже существующий поток. Рой разнесёт стор и разбор SSE по разным чатам и стоит отдельного большого расхода. Это не уровень effort, а многоагентный режим.

| Этап | Уровень | Почему |
| --- | --- | --- |
| Реализация | high | Широкий экран, но порядок SSE и вызов на сервере уже есть. Четыре поля контракта узкие, поэтому не xhigh и не max. |
| Доработка по замечаниям | medium | Скорее всего сдвинутся подпись спиннера, число бейджей и запасной ввод на звонке. |
| Ревью | high | Легко проксировать SSE через Next, повторить POST после обрыва и задвоить реплику, или послать Bearer на демо и потерять cookie. |
| Рефакторинг и баги | high | Типичный дефект — спиннер после `error`, карточка без компании при живом потоке и с компанией в истории, вызов демо без перехода на вход. |

## Отклонения от плана

- `SessionStatus`, `StreamPhase` и `CallPhase` — enum, не союз строк: так требует конвенция доменных значений.
- Подпись места собирает `formatLocationLabel` в `packages/contracts`, оба SELECT его вызывают. Иначе поток и история разошлись бы в запятой.
- Переименование чата — `window.prompt`, не отдельное поле. Удаление по-прежнему второй кнопкой в строке.
- Список чатов перечитывается и после `error`, не только после `done`: заголовок пишется до потока, а отказ поиска `done` не шлёт.
- Если в ответе `/me` нет `searchQuota`, счётчик не рисуется. Так старый процесс не роняет оболочку.
- Короткий пароль остаётся в браузере и показывает текст схемы Yup.
