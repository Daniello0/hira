# UX-аудит Hira: фичи, сквозные сценарии, подозрительные места

Статус: план прогона в браузере, ничего не исправлено · 2026-11-04 · ветка `fix/ux-audit-stt`

Источник: код `apps/web/src/**` (маршруты `app/**`, все `features/**`, `common/components/**`), Wiki 05, 06, 07, 11, `specs/002-hira-improvements/plan.md`. Ссылки `файл:строка` даны от `apps/web/src/`, если не сказано иное. Пути API — с префиксом `/api/v1`.

## 0. Как прогонять

**Стенд.** Веб `http://localhost:3000`, core-api `http://localhost:4000`. Окно от 1280 px; телефон — 390×844 (S16).

**Аккаунты.**
- **G** — гость: окно инкогнито или чистые cookies.
- **A1** — создаётся в S02 из гостя, план Free. В S12 переводится в Pro; S13–S15 идут на Pro. Почта вида `ux-a1-<дата>@hira.test`, пароль сгенерировать на прогон (12+ символов).
- Вторая вкладка того же браузера нужна в S12 и S17.

**Файлы.** `resume.pdf` — текстовый PDF до 10 МБ с навыками (Python, SQL, Docker, FastAPI). `no-skills.pdf` — текстовый PDF без навыков (рецепт, стих) для P02. Скрытые поля выбора файла: в поле ввода чата `input[aria-label="Upload resume"]`, в библиотеке `input[aria-label="Resume PDF"]`.

**Голос (S15).** Живой микрофон или Chromium с флагами `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<фраза.wav>` (так проверяли в specs/002 §5). Без микрофона проверяется только «Type instead».

**Метки.**
- **[LLM]** — шаг тратит кредиты OpenRouter. Сообщение чата = understand + generate (на Pro/Max после поиска ещё извлечение памяти, раз в 8 сообщений — сводка). Реплика звонка = understand + generate + облачная озвучка MAI-Voice по предложениям. Загрузка резюме = parse-resume (тот же текст кэшируется 24 ч). Диктовка, «Read aloud», панель вакансии, похожие, поиск чатов — без LLM.
- **[T]** — замерить время. **[R]** — должно обновиться без перезагрузки. **[K]** — проверка клавиатуры. **[P##]** — по коду ожидается расхождение, см. раздел 3.

**Бюджет.** Обязательных шагов [LLM] около 17: S01 — 4, S02 — 1, S04 — 2, S08 — 1, S10 — 1, S11 — 1, S13 — 1, S14 — 3, S15 — 3 реплики с озвучкой (+1). Необязательных ещё около 4. Реплики писать короткие.

**Замер стрима в чате.** Выполнить в консоли страницы прямо перед Enter:

```js
(() => { const t0 = performance.now(), r = {}; const mark = (k) => { if (!(k in r)) r[k] = Math.round(performance.now() - t0); };
  const o = new MutationObserver(() => {
    const live = document.querySelector('[aria-live="polite"]');
    if (live?.querySelector('h3 button')) mark('cards');
    if (live?.querySelector('.text-message')) mark('firstToken');
    const box = document.getElementById('message');
    if (('cards' in r || 'firstToken' in r) && box && !box.disabled) { mark('done'); o.disconnect(); console.log('HIRA_TIMING', JSON.stringify(r)); }
  });
  o.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); })();
```

`cards` — появились карточки, `firstToken` — первый текст ответа, `done` — поле снова доступно. Загрузку резюме мерить по длительности `POST /api/v1/documents` во вкладке Network.

## 1. Фичи

План: **Г** — гость (demo), **F** — Free, **P** — Pro, **M** — Max. Лимиты из `PLAN_LIMITS` (`packages/contracts/src/common/dto/billing/plan-limits.ts`): поисков в день F 20 / P 100 / M 500 (гость — 3 отвеченных хода всего); избранное F до 20, P/M без лимита; коллекции P/M; файлов F 3 / P 50 / M без лимита; память между чатами и звонок P/M; чатов в контексте F 0 / P 10 / M 50.

| Экран / маршрут | Что делает пользователь | Подписи в UI (точно из кода) | Клавиши | План | API |
|---|---|---|---|---|---|
| `/login` | Вход | h1 и кнопка «Sign in», поля «Email», «Password», ссылка «Create an account»; ошибки «Email or password is incorrect», «Too many login attempts», «Sign-in failed», «Could not reach Hira», «Could not start the session», «Could not load the account» | Enter в поле = отправка | Г | `POST /auth/login`, `GET /auth/me`, `POST /chats/claim-guest` |
| `/register` | Регистрация | h1 «Create an account», «Email», «Display name», «Password», кнопка «Create account», ссылка «Sign in»; «Email is already registered», «Password appears in a list of compromised passwords», «Registration failed» | Enter | Г | `POST /auth/register`, `GET /auth/me`, `POST /chats/claim-guest` |
| любая страница приложения | Сессия переживает перезагрузку | скелетоны «Loading» на время проверки | — | F P M | `POST /auth/refresh`, `GET /auth/me` |
| Сайдбар | Навигация | лого «Hira» (→ `/chat`), «New chat», «Library», «Favorites», «Call», раздел «Recents» (сворачивается) | Tab, Enter | все (Library, Favorites, Call уводят гостя на `/login`) | `GET /chats?cursor=` |
| Сайдбар | Свернуть, шторка на телефоне | «Hide sidebar» / «Show sidebar»; телефон: «Show sidebar» и «New chat» в шапке, «Close sidebar» в шторке | Esc закрывает шторку | все | — |
| Поиск чатов | Найти чат по названию | кнопка и диалог «Search chats», поле «Search chats…»; «Searching…», «No chats found», «No chats yet», «Could not search chats», «Loading…», «Could not load more chats», «Try again» | Cmd/Ctrl+K открыть, Esc закрыть | все | `GET /chats?q=&cursor=` |
| Меню профиля «Open profile menu» | Аккаунт, план, выход | под аватаром имя и «Demo»/«Free»/«Pro»/«Max», кнопка «Upgrade» (не Max); гость: «Sign in», «Sign up», «Upgrade plan», «Settings»; аккаунт: «N/M queries today», «Upgrade plan», «Memory», «Profile», «Settings», «Log out» | стрелки, Enter, Esc | все | `POST /auth/logout` |
| Шапка страниц | Путь к тарифам | «Upgrade» (не у Max; в настройках нет) | — | Г F P | — |
| `/chat` | Новый чат первым сообщением | «What are we looking for today?», поле «Ask Hira» (label «Message»); гостя сразу уводит в его единственный чат | Enter | все | `POST /chats`, затем `POST /chats/{id}/messages` |
| `/chat/{id}` | Сообщение и потоковый ответ | «Send», «Searching…», «Hira can make mistakes. Check important info.»; уведомления «A message can be at most 4000 characters», «Message was not sent», «Answer was interrupted», «Could not reload the chat», «Sign in again to continue», «Could not load older messages»; гость сверх лимита: «Sign up for 20 queries/day · Sign up»; аккаунт: «Search quota exceeded» | Enter — отправить, Shift+Enter — перенос | все | `POST /chats/{id}/messages` (SSE), `GET /chats/{id}` |
| Поле ввода | Звонок с пустым полем | круглая «Start a call» (→ `/call`) | — | все | — |
| Поле ввода | Диктовка (браузер) | «Dictate» / «Stop dictation»; «Allow the microphone in your browser to dictate» | — | все, где есть SpeechRecognition | — |
| Меню «+» («Add files and more») | Файл и переключатели | «Upload resume» (PDF, offers skills for your profile), «Open library» (Your resumes, letters, and notes), «Use memory» (Let Hira read your saved facts), «Show foreign remote» (Remote jobs from employers abroad) | стрелки, Enter, Esc | Upload и Open library — F P M; Use memory — P M; Show foreign remote — все | `POST /documents` (multipart), `GET /profile/suggestions` |
| Под сообщениями | Копия, озвучка, история | «Copy»/«Copied», «Read aloud»/«Stop reading», «Older messages», «Scroll to bottom» | — | все | `GET /chats/{id}/messages?cursor=` |
| Шапка чата | Панель контекста | «Show context»/«Hide context»; «Context»: «Intent» («Waiting for a message»), «Filters» («None yet», «Role:», «Seniority:», «Format:», «Employment:», «Location:», «Salary from:», «Foreign remote: hidden», «Softened: …»), «Profile» («No skills on your profile yet»), «Memory» («Cross-chat memory is off», «No facts yet», «N facts») | Esc закрывает шторку на телефоне | все (Profile и Memory — F P M) | `GET /profile/skills`, `GET /memory`, `GET /profile` |
| Меню чата «Chat actions» (строка Recents, шапка, Archived chats) | Переименовать, архив, удалить | «Rename», «Archive»/«Restore», «Delete» → «Delete chat?», «This will delete “…”.», «Cancel», «Delete»; в строке поле «Chat name»; в шапке диалог «Rename chat», поле «Name», «Cancel», «Save»; «Could not rename the chat», «Could not archive the chat», «Could not restore the chat», «Could not delete the chat» | строка: Enter — сохранить, Esc — отмена; диалог: Enter = Save | все | `PATCH /chats/{id}`, `DELETE /chats/{id}` |
| Архивный чат | Только чтение | «This chat is archived. Restore it from the menu to keep writing.», плейсхолдер «Archived chat» | — | все | — |
| Ошибка открытия чата | — | «Chat not found» / «Could not load the chat», «It may have been deleted, or it belongs to another account.», «Check your connection and try again.», «Try again», «New chat» | — | все | `GET /chats/{id}` |
| Карточка вакансии | Смотреть, объяснение | заголовок-кнопка (открывает панель), балл с подсказкой «Match score», «Explain match»/«Hide explanation», «Open posting» / «vacancy no longer active», «Remote · International», «Salary not listed»; объяснение: «Skill fit», «Semantic», «Lexical», «Experience», «Format», «Salary», «Matched», «Related through the graph», «Missing», «Keyword match», «Meaning match», «Skill graph» | — | все | данные из SSE `results` |
| Карточка / панель вакансии | Избранное | «Save», «Saving…», «Saved», «Removing…», «Could not save», «Could not remove», «Limit reached. See Billing», «Try again» | — | F P M (F до 20) | `POST /favorites`, `DELETE /favorites/{id}` |
| Карточка в ответе | Оценка выдачи | «Relevant», «Not relevant», «Could not send feedback» | — | F P M | `POST /feedback` (чтения назад нет) |
| Панель вакансии (шторка «Vacancy») | Детали, разрыв навыков, похожие | «Close», «Your fit», «Profile covers N% of required and preferred skills», «You have», «Missing», «Related skills you have: …», «Nothing is missing.», «Could not compare with your profile.», «Skills for this vacancy are not extracted yet…», «Skills» (Required/Preferred/Mentioned), «Description», «Similar vacancies», «Similar vacancies are unavailable.», «Could not load this vacancy.» | Esc, клик по фону | все («Your fit» — F P M) | `GET /vacancies/{id}`, `/similar`, `/skill-gap` |
| `/favorites` | Список, поиск по заметкам | «Favorites», «Search notes», «Search», «No saved vacancies yet.», «No favorites match this note search.», «Could not load favorites.», «No saved vacancies.» | Enter в «Search notes» | F P M | `GET /favorites?q=`, `GET /collections` |
| `/favorites` | Коллекции | «New collection», «Create», группы «Saved», «Uncategorized»; «Collection actions» → «Rename», «Delete collection» → «Delete collection?»; поле «Collection name» | переименование: Enter / Esc | P M (F получает 403 «Collections are part of the Pro plan.») | `POST/PATCH/DELETE /collections` |
| Карточка избранного | Заметка, перенос, удаление | «Remove» (без подтверждения), «Note» (сохраняется при потере фокуса), «Collection» («Uncategorized» + коллекции) | Tab сохраняет заметку | F P M | `PATCH/DELETE /favorites/{id}` |
| `/library` | Список файлов | «Library», «Resume», «Preferences», «Letters», «Scripts», «Notes», «None yet.», бейджи «Pinned», «Parsed»/«Parse failed»/«Parsing», «by Hira»; «Could not load your files.», «Try again» | — | F P M | `GET /documents` |
| `/library` | Загрузка резюме PDF | «Upload resume» / «Uploading…»; «An uploaded file must be a resume PDF», «The PDF did not contain text», «The PDF is too large» (10 МБ), «You have reached the limit of library files on your plan.» | — | F P M | `POST /documents` multipart [LLM parse-resume] |
| `/library` | Новый md/txt | «New file» → «New file»: «Title», «Kind» (Preferences/Letter/Script/Note), «Format» («Markdown»/«Text»), «Text», «Cancel», «Create file» | Enter в Title отправляет, Esc закрывает | F P M | `POST /documents` |
| `/library` | Чтение и правка файла | диалог с названием файла: «Title», «Text», «PDF text is read-only. The file stays in the library.», «Delete» → «Delete file?», «Pin»/«Unpin», «Save»; «Could not open the file», «Could not delete the file» | Esc закрывает без сохранения | F P M | `GET/PATCH/DELETE /documents/{id}` |
| Модалка после резюме | Принять навыки пачкой | «Found in your resume», «Choose what to add to your profile. Unchecked items are dismissed.», «Not in the skill catalog yet», «Later», «Add selected (N)»/«Saving…», «Some items could not be updated. They stay in the list.» | Esc = Later | F P M | `GET /profile/suggestions`, `POST /profile/suggestions/{id}/accept\|dismiss` |
| Модалка из диалога | Принять одно предложение | «Add <навык> to your profile?» (и «Add a salary preference…», «Add education…», «Add a work format…», «Add an employment preference…», «Add a location preference…»), «This skill is not in the catalog yet.», «Dismiss», «Add», «Could not update the suggestion» | Esc = скрыть в этой вкладке | P M (на Free из чата не приходят, specs/002) | те же |
| Черновик от Hira (чат и звонок) | Сохранить файл, предложенный Hira | «Draft from Hira», «Title», «Format», «Kind», «Preview (N characters)», «Save as new»/«Saving…», «Replace <файл>», «Dismiss», «Saved to your library.», «File updated.», «Open library», «Give the file a title»; гость: «Sign in to save drafts to your library.» | — | видят все, сохраняют F P M | `POST /documents` (`fromAssistant`), `PATCH /documents/{id}` |
| Сайдбар настроек | Разделы | «Back to app», «Search settings» (плейсхолдер «Search»), «Personal», «Appearance», «Profile», «Memory», «Archived chats», «Billing», «Account», «Nothing found» | — | все | — |
| `/settings/appearance` | Тема | «Appearance», «Visual style», «Mode»: «System», «Light», «Dark» | Tab, Enter | все | — (localStorage) |
| `/settings/profile` | Анкета | «Profile», «Headline», «About», «Seniority» («Not set», «No experience», «Junior», «Middle», «Senior», «Lead»), «Desired roles» («QA, Python»), «Work format» («On-site», «Remote», «Hybrid»), «Employment» («Full-time», «Part-time», «Project», «Freelance»), «Minimum salary», «Currency», «Education», «Save profile»; «Profile saved», «Choose a seniority from the list», «Enter a number», «Could not load the profile.» | Enter в поле отправляет | F P M | `GET/PUT /profile` |
| `/settings/profile` | Города | «Preferred cities», «Add a city», «No matches», «No cities yet.», «Remove <город>», «Could not update cities: …» | — | F P M | `GET /locations?q=`, `PUT /profile` |
| `/settings/profile` | Навыки | «Skills», «Find a skill», «Searching…», «No matches», «Could not search skills», «Level» («Basic», «Confident», «Expert»), «Selected: …», «Add skill», «Remove <навык>», строки «<имя> · <уровень> · Manual/Resume/Dialog»; «That skill is already on the profile» | — | F P M | `GET /skills?q=`, `GET/POST/DELETE /profile/skills` |
| `/settings/memory` | Факты и выключатель | «Memory», «Cross-chat memory»; факт «<Kind> · N% · <дата>», «Wording», «Open source chat» / «Call · <дата>» / «Chat message (chat deleted)» / «No source recorded», «Save», «Pin»/«Unpin», «Forget», «Nothing is stored yet.», «Forget all» → «Forget everything?»; ошибки «Could not load memory», «Write the fact before saving», «Could not save the fact», «Could not update the pin», «Could not forget the fact», «Could not update cross-chat memory», «Could not forget the facts» | — | F P M (выключатель — P M) | `GET /memory`, `PATCH/DELETE /memory/{id}`, `DELETE /memory`, `PATCH /settings/memory` |
| `/settings/archived` | Архив | «Archived chats», «No archived chats.», строки с тем же меню | — | все | `GET /chats`, `PATCH/DELETE /chats/{id}` |
| `/settings/billing` | Тарифы (демо) | «Billing», «A demo of plans. A change applies at once and no payment is taken.», «Monthly»/«Yearly», «Free»/«Pro»/«Max», «$0», «$19/month», «$39/month», «$15/month, billed yearly», «$31/month, billed yearly», «Save 21%», «Current plan»/«Upgrade»/«Downgrade», «Could not change the plan» | — | все (гостя «Upgrade» ведёт на `/register`) | `PUT /billing/plan` |
| `/settings/account` | Данные и выход | «Account», «Email», «Name» («Not set»), «Search queries today», «Log out of this browser», «Log out» | — | F P M | `POST /auth/logout` |
| `/call` | Голосовой звонок | «Voice language» («Auto», «Russian», «English», «Spanish», «German», «French»), «Ready», «Listening», «Speaking», «Searching…», «Hira is answering», «Start talking to interrupt», «Start», «End», подписи «You:» / «Hira:»; «Could not start the call. Try again.», «Hira did not answer. Try again.», «Microphone access is blocked. Allow it in the browser, or type instead.», «The browser allows the microphone only over https or on this computer…», «The voice service is unavailable. You can read the answers and type instead.» | — | P M; F: «Calls», «Voice calls are part of the Pro plan. Upgrade to talk with Hira in five languages.», «See plans»; Г → `/login` | `POST /calls`, `POST /speech/transcribe`, `POST /calls/{id}/turns` (SSE), `POST /speech/synthesize`, `POST /calls/{id}/end` |
| `/call` | Печать вместо голоса | «Type instead», «Send» (только при заблокированном микрофоне или упавшем голосе, в фазе Listening) | Enter = перенос строки | P M | `POST /calls/{id}/turns` |
| `/offline` | Нет сети (prod, service worker) | «You are offline», «Hira needs a connection to search and answer…», «Try again» | — | все | — |
| Редиректы | — | `/` → `/chat`; `/settings` → `/settings/appearance`; `/profile`, `/memory`, `/billing` → `/settings/*` | — | все | — |

**Подтверждения и клавиши.** Подтверждение есть у «Delete chat?», «Delete collection?», «Delete file?», «Forget everything?». Без подтверждения: «Remove» в избранном, «Forget» факта, «Downgrade», «Log out». Требование: Enter подтверждает, Esc отменяет. По коду Esc работает везде (Radix), а Enter нажимает крестик «Close» (P01).

**Чего в приложении нет совсем** (ни UI, ни API): смена пароля, удаление аккаунта, сброс пароля, подтверждение почты; отдельная функция перевода (перевод — обычная просьба в чате, ответ приходит черновиком файла); кнопка остановки ответа («Stop») — `postStream` в чате идёт без `signal` (`features/chat/use-chat-screen.ts:92`).

## 2. Сценарии

### S01. Гость: демо-чат, лимит 3 запросов, закрытые разделы
**Цель:** гость пишет в чат, у него ровно один чат, после 3 ответов — баннер регистрации; разделы аккаунта уводят на вход. **Предусловия:** G. LLM: 4.
1. Открыть `http://localhost:3000/` [T]. → `/chat`, затем сразу `/chat/<id>` (демо-чат создаёт `GET /chats`): пустая лента, поле «Ask Hira», круглая «Start a call». Внизу сайдбара «Guest» / «Demo» и «Upgrade»; в «Recents» одна строка «New chat».
2. «Add files and more» (+). → только «Show foreign remote» с галочкой; нет «Upload resume», «Open library», «Use memory». Esc закрывает [K].
3. «Open profile menu». → «Sign in», «Sign up», «Upgrade plan», «Settings»; ↑↓ и Enter работают, Esc закрывает [K].
4. `Hi! What can you do?` → Enter [LLM][T]. → своё сообщение сразу; поле неактивно до конца ответа; ответ текстом без карточек; строка в «Recents» получает название = текст сообщения [R].
5. `Python developer jobs in Minsk` → Enter [LLM][T: cards / firstToken / done]. → «Searching…», карточки раньше текста; на карточках нет закладки и «Relevant»/«Not relevant».
6. `Only junior ones` → Enter [LLM]. → третий ответ.
7. `Any in Grodno?` → Enter [LLM: только understand]. → сообщение в ленте без ответа, над полем «Sign up for 20 queries/day · Sign up», поле снова доступно.
8. Кликнуть «Sign up for 20 queries/day». → `/settings/billing` полной перезагрузкой страницы [P32]: «Billing», у всех трёх планов «Upgrade»; клик → `/register`. Назад в чат.
9. F5. → тот же чат со всеми сообщениями и карточками.
10. «New chat» в сайдбаре. → снова этот же чат (второго гостю не положено).
11. По очереди «Library», «Favorites», «Call» и круглая «Start a call». → каждый раз `/login` (может мелькнуть «Sign in required. Sign in»); объяснения, почему нужен вход, нет — зафиксировать.
12. `/settings/appearance` открывается; `/settings/profile` → `/login`; `/settings/archived` → «No archived chats.».
13. Cmd/Ctrl+K. → «Search chats…» в фокусе, в списке гостевой чат; 3 буквы названия → найден; Esc закрывает [K].

### S02. Регистрация с переносом гостевого чата
**Цель:** гость регистрируется и оказывается в своём чате уже как аккаунт. **Предусловия:** конец S01. LLM: 1.
1. «Open profile menu» → «Sign up». → `/register`, «Create an account».
2. «Create account» с пустыми полями. → видна только ошибка пароля; про пустой «Email» ничего [P10].
3. «Email» = почта A1, «Display name» = `UX A1`, «Password» = `short1` → «Create account». → «password must be at least 10 characters» (до сервера не дошло).
4. «Password» = `qwertyuiop` → «Create account». → «Password appears in a list of compromised passwords».
5. Пароль A1 → Enter в поле [K][T: до открытия чата]. → кнопка неактивна во время запроса; открыт `/chat/<id>` гостевого чата со всеми сообщениями и карточками; он в «Recents»; внизу сайдбара «UX A1» / «Free» [R].
6. «Open profile menu». → «N/20 queries today», «Upgrade plan», «Memory», «Profile», «Settings», «Log out».
7. В этом чате `Show QA jobs` → Enter [LLM]. → на новых карточках закладка «Save» и «Relevant»/«Not relevant»; в меню аватара счётчик +1 [R].
8. F5 [T: до появления имени]. → остаёмся в аккаунте, тот же чат. На миг внизу «Guest» / «Demo» и «Upgrade» [P17].
9. «Log out» в меню аватара. → `/login`. Открыть `/chat`. → гостю выдан новый пустой демо-чат; перенесённого чата в «Recents» нет.

### S03. Вход, ошибки формы, перезагрузка
**Цель:** вход надёжен, ошибки понятны. **Предусловия:** A1 существует, вы гость. LLM: 0.
1. `/login` → «Sign in» с пустыми полями. → видна только ошибка пароля; пустой «Email» молча не пускает [P10].
2. «Email» = `abc` → «Sign in». → браузерная подсказка формата почты.
3. Почта A1 + неверный пароль из 10+ символов → Enter [K]. → «Email or password is incorrect»; кнопка неактивна во время запроса.
4. Ещё 5 неверных попыток за минуту. → «Too many login attempts». Подождать 60 с.
5. Верный пароль → Enter [T]. → `/chat` (пустой гостевой чат не переносится); в «Recents» чаты A1.
6. Открыть чат, F5 три раза подряд. → каждый раз остаёмся в аккаунте.
7. Открыть `/login` в этой вкладке. → форма входа показывается вошедшему, редиректа нет [P29].
8. «Settings» → «Account». → «Email», «Name» = `UX A1`, «Search queries today» N/20, «Log out of this browser» + «Log out». Смены пароля и удаления аккаунта нет [P38].
9. (Необязательно, 16 мин) Оставить вкладку на 16 минут, затем открыть «Favorites». → данные грузятся, выхода нет (токен обновился).

### S04. Чат: поиск вакансий, объяснение, панель контекста
**Цель:** главный путь поиска быстрый и прозрачный. **Предусловия:** A1 Free. LLM: 2 (+1).
1. «New chat». → `/chat`, «What are we looking for today?»; при пустом поле «Start a call», при вводе — «Send».
2. Запустить скрипт замера; `Junior Python developer in Minsk, salary from 1500 USD` → Enter [LLM][T]. → адрес `/chat/<id>`, своё сообщение, «Searching…», карточки, затем текст; чат наверху «Recents» [R]. Записать cards, firstToken, done.
3. Карточка: заголовок, балл («Match score»), «компания · город», «зарплата · формат», бейджи навыков, «Open posting» (новая вкладка), «Save», «Relevant»/«Not relevant», «Explain match».
4. «Explain match». → полосы «Skill fit», «Semantic», «Lexical», «Experience», «Format», «Salary»; группы «Matched» / «Related through the graph» / «Missing»; бейджи веток; подпись «Hide explanation». Навести на навык → цитата из описания (если есть).
5. «Show context». → «Context»: «Intent», «Filters» («Seniority: Junior», «Location: …», «Salary from: 1500», возможно «Softened: …»), «Profile» («No skills on your profile yet»), «Memory». Кнопка стала «Hide context».
6. `Only remote` → Enter [LLM]. → новые карточки; в «Filters» «Format: Remote» [R]; меню аватара: счётчик +1 [R].
7. (Необязательно) `Thanks!` → Enter [LLM]. → ответ без карточек, счётчик не растёт [R].
8. Прокрутить ленту вверх. → «Scroll to bottom»; клик — плавно вниз.
9. F5. → история и карточки те же; «Explain match» свёрнуто; панель контекста открыта (запоминается), «Intent»/«Filters» по последнему запросу. Пока чат грузится, лента пустая и без скелетона, «Chat actions» появляется позже [P34].

### S05. Панель вакансии, похожие, сохранение, оценки
**Цель:** детали вакансии и закладка синхронны везде. **Предусловия:** A1 Free, чат из S04. LLM: 0.
1. Клик по заголовку карточки [T: скелетон → данные]. → шторка справа: «Close», заголовок, «компания · город», «зарплата · формат · занятость · уровень · график», «Open posting», закладка, «Your fit», «Skills», «Description», «Similar vacancies».
2. Клик по похожей вакансии. → в шторке она (скелетон → данные).
3. Esc → закрыта [K]; открыть снова, клик по затемнению → закрыта.
4. «Save» на карточке в ленте. → «Saving…» (неактивна) → «Saved» [R]; в шторке этой вакансии закладка тоже отмечена [R].
5. Снять закладку в шторке. → «Removing…» → «Save», карточка в ленте тоже снята [R]. Затем сохранить две разные вакансии (для S06).
6. «Relevant». → подсветка сразу; «Not relevant» → подсветка переходит. F5 → подсветки нет, хотя голос сохранён [P08].
7. Двойной быстрый клик по «Save» третьей карточки. → одно сохранение.

### S06. Избранное
**Цель:** работа со списком без перезагрузок. **Предусловия:** A1 Free, 2 сохранённые вакансии. LLM: 0.
1. «Favorites». → «Favorites», «Search notes» + «Search», «New collection» + «Create», группа «Saved» с вакансиями из S05 [R].
2. «Note»: `call HR on Monday`, затем Tab. → сохранено молча; Enter в поле ничего не делает [P22]. F5 → заметка на месте.
3. «Search notes» = `hr` → Enter [K]. → одна карточка. `zzz` → «No favorites match this note search.». Очистить → Search → все.
4. Ввести в «Search notes» `zzz`, Search не нажимать, изменить заметку другой карточки и Tab. → список вдруг фильтруется по неотправленному тексту [P05].
5. «New collection» = `Shortlist` → «Create». → на Free ошибка «Collections are part of the Pro plan.» только после отправки [P06].
6. «Collection» у карточки → «Uncategorized». → карточка в группе «Uncategorized» [R].
7. «Remove» у карточки. → без подтверждения, строка уезжает после ответа сервера [R]; в чате у этой вакансии снова «Save» [R]. Двойной клик по «Remove» у другой → «Could not remove the favorite», хотя удалено [P21].
8. Клик по заголовку карточки. → та же шторка вакансии.

### S07. Управление чатами и Cmd/Ctrl+K
**Цель:** переименование, архив, удаление и поиск без перезагрузок. **Предусловия:** A1, 2+ чата. LLM: 0.
1. Навести на строку «Recents» → «Chat actions». → «Rename», «Archive», «Delete»; ↑↓, Enter, Esc [K].
2. «Rename» → поле «Chat name» в фокусе; `Minsk Python` → Enter [K]. → имя в «Recents» и в шапке [R]. Снова «Rename», мусор, Esc → имя прежнее [K].
3. Шапка открытого чата → «Chat actions» → «Rename». → «Rename chat», поле «Name» в фокусе, Enter = «Save» [K]; повторно Esc = отмена.
4. Шапка → «Chat actions» → «Archive». → строка уходит из «Recents» [R]; «This chat is archived. Restore it from the menu to keep writing.», плейсхолдер «Archived chat», поле и «Dictate» неактивны (круглая «Start a call» остаётся); в меню шапки «Restore».
5. «Settings» → «Archived chats». → чат в списке; его меню → «Restore» → строка уходит [R]; «Back to app» → чат в «Recents» [R].
6. Архивировать другой чат из меню строки. → строка уезжает [R]; он есть в «Archived chats».
7. Меню строки → «Delete». → «Delete chat?», «This will delete “<название>”.», «Cancel» / «Delete». Сразу Enter. → нужно удаление; по коду фокус на «Close» и Enter закроет без удаления [P01][K]. Снова «Delete» → Esc → чат цел [K]. Снова → кнопка «Delete» → строка уезжает; если чат был открыт — `/chat` [R].
8. Cmd/Ctrl+K. → поле в фокусе; без запроса — последние чаты, включая архивные [P16]. 3 буквы названия → через ~250 мс «Searching…», затем результаты; на каждое изменение список мигает [P16]. Enter → ничего [P16]. Tab до результата + Enter → чат открыт, диалог закрыт. `qqqq` → «No chats found». Esc закрывает, при новом открытии поле пустое [K].
9. В чате A набрать `draft text` без отправки, перейти в чат B и обратно. → текст на месте.

### S08. Поле ввода и действия под ответом
**Цель:** клавиатура, лимиты, переключатели, браузерные голос и копирование. **Предусловия:** A1 Free. LLM: 1.
1. Текст, Shift+Enter, текст. → две строки, поле растёт [K]. Стереть.
2. Вставить 4001 символ → Enter. → «A message can be at most 4000 characters», ничего не ушло, текст в поле.
3. «+» → снять «Show foreign remote» (меню не закрывается). `Remote Java jobs` → Enter [LLM]. → «Context» → «Filters»: «Foreign remote: hidden»; ни одной карточки с «Remote · International». После ответа фокуса в поле нет, нужен клик [P09]. F5 → галочка всё ещё снята; вернуть.
4. «Dictate». → запрос микрофона; фраза дописывается в поле, «Stop dictation» пульсирует. При запрете — «Allow the microphone in your browser to dictate».
5. Под ответом «Copy» → галочка «Copied» на 2 с; вставить в поле — текст ответа. «Read aloud» → голос браузера; «Stop reading» останавливает.
6. Пустое поле → «Start a call». → на Free: «Calls», «Voice calls are part of the Pro plan. Upgrade to talk with Hira in five languages.», «See plans» → `/settings/billing`.
7. «+» → «Open library» → `/library`.

### S09. Библиотека: текстовые файлы и лимит Free
**Цель:** создать, править, закрепить, удалить; понятный отказ по лимиту. **Предусловия:** A1 Free, библиотека пуста. LLM: 0.
1. «Library». → «Upload resume», «New file»; разделы «Resume», «Preferences», «Letters», «Scripts», «Notes» со счётчиком 0 и «None yet.».
2. «New file». → «New file»: «Title», «Kind» (Note), «Format» (Markdown), «Text», «Cancel», «Create file». Фокус на крестике «Close», не на «Title». Esc закрывает [K].
3. «New file»: «Title» `Cover letter Acme`, «Kind» Letter, «Text» `Dear Acme team, I am a junior Python developer.` → Enter в «Title» [K]. → диалог закрыт, файл в «Letters 1» [R].
4. Создать `Notes on Minsk` (Note, «Text») и `Temp` (Note). → три файла.
5. Создать `Temp 2`. → нужна ошибка в диалоге; по коду диалог просто остаётся открытым, а «You have reached the limit of library files on your plan.» пишется на странице под затемнением [P04]. Закрыть.
6. Клик по `Cover letter Acme` (индикатора загрузки нет [P23]). → диалог «Cover letter Acme»: «Title», «Text», «Delete», «Pin», «Save».
7. Поменять текст → «Save». → подтверждения «сохранено» нет [P23]; закрыть и открыть → текст новый.
8. «Pin». → «Unpin»; после закрытия у строки «Pinned» [R].
9. Поменять текст → Esc. → диалог закрыт, правка потеряна без вопроса [P23].
10. Открыть `Temp` → «Delete». → «Delete file?», «This will delete “Temp”.». Enter → по коду отмена [P01]. Кнопка «Delete» → оба диалога закрыты, строки нет [R].

### S10. Резюме PDF и модалка навыков
**Цель:** загрузка, разбор, принятие навыков, повтор. **Предусловия:** A1 Free, в библиотеке 2 файла. LLM: 1.
1. «Library» → «Upload resume» → `resume.pdf` [LLM][T: `POST /documents`]. → «Uploading…», кнопка неактивна весь разбор.
2. → «Found in your resume»: «Choose what to add to your profile. Unchecked items are dismissed.», список с галочками (вне каталога — неактивны, «Not in the skill catalog yet»), «Later», «Add selected (N)». Снять одну галочку (запомнить навык X) → N меньше.
3. Мышью «Add selected (N)». → «Saving…» → модалка закрыта, одиночных модалок нет.
4. «Library» → файл в «Resume 1» с «Pinned» и «Parsed» [R].
5. «Profile» → «Skills»: принятые навыки с источником «Resume», навыка X нет [R].
6. Чат из S04, «Show context» → «Profile» показывает навыки (страница чата читает профиль при открытии).
7. Удалить `Notes on Minsk`. В этом чате «+» → «Upload resume» → тот же `resume.pdf` (разбор из кэша, LLM не тратится). → в поле никакого индикатора, пока идёт загрузка [P20]; модалка снова предлагает уже добавленные навыки [P35].
8. В модалке нажать Enter. → нужно «Add selected»; по коду она закроется как «Later» [P01] и сразу всплывёт «Add <навык> to your profile?» по одному [P03]. Уже добавленные — «Dismiss»; на навыке X — «Add». → в «Context» → «Profile» X не появится до следующего ответа [P14]. F5 → появился.
9. Ещё раз «Upload resume» (на Free уже 3 файла). → над полем «You have reached the limit of library files on your plan.»; ошибка висит и после следующих действий в чате [P20].

### S11. Черновик от Hira: перевод файла
**Цель:** Hira правит файл библиотеки только после подтверждения. **Предусловия:** A1 Free, есть `Cover letter Acme`, на Free 3 файла. LLM: 1 (+1).
1. Новый чат: `Translate my Cover letter Acme into English and make it formal` → Enter [LLM][T]. → ответ и «Draft from Hira»: «Title», «Format», «Kind» (Note), «Preview (N characters)», «Save as new», «Replace Cover letter Acme», «Dismiss». Если черновика нет — зафиксировать, что запрос не понят как DRAFT_DOCUMENT.
2. Развернуть «Preview». → Markdown; «Format» → «Text» → простой текст.
3. «Save as new». → в карточке «You have reached the limit of library files on your plan.», кнопки снова активны.
4. Очистить «Title» → «Save as new». → «Give the file a title».
5. «Replace Cover letter Acme». → «Saving…» → «File updated. Open library»; «Open library» → в файле новый текст [R].
6. (Необязательно) `Write a 3-line note called Interview checklist` [LLM] → новый черновик; F5 до сохранения → черновик пропал насовсем [P18].

### S12. Тарифы: Upgrade, Downgrade и что они открывают
**Цель:** смена плана сразу и везде. **Предусловия:** A1 Free; вторая вкладка на `/chat`. LLM: 0.
1. «Upgrade» в шапке. → `/settings/billing`: «Monthly»/«Yearly»; «Free» «$0», «Pro» «$19/month», «Max» «$39/month»; списки «20/100/500 searches a day», «Up to 20 saved vacancies» / «Unlimited saved vacancies», «Collections for saved vacancies», «3 library files» / «50 library files» / «Unlimited library files», «Memory across chats», «Voice calls in five languages», «Hira knows the current chat» / «Hira knows your last 10 chats and calls» / «…50…». Free «Current plan» (неактивна), Pro и Max «Upgrade».
2. «Yearly». → «$15/month, billed yearly», «$31/month, billed yearly», «Save 21%» у Pro и Max.
3. Pro «Upgrade» [T]. → все кнопки неактивны на время запроса; Pro «Current plan», Free «Downgrade», Max «Upgrade»; внизу сайдбара «Pro»; счётчик «/100» [R]; во второй вкладке «Pro» без перезагрузки [R].
4. Без перезагрузки: в чате «+» → появился «Use memory» [R]; `/settings/memory` — выключатель активен; `/call` — «Start»; «Favorites» → «New collection» `Shortlist` → «Create» → группа «Shortlist», «No saved vacancies.» [R]; «Collection actions» → «Rename» (Enter / Esc [K]), «Delete collection» → «Delete collection?» (Enter — [P01], Esc — отмена).
5. F5 на Billing. → Pro сохранился; на миг у всех планов «Upgrade» [P17].
6. Max «Upgrade». → «Max»; пропали «Upgrade» в шапке и в сайдбаре [R]; «/500».
7. Pro «Downgrade». → сразу, без подтверждения [P26]. Оставить Pro.

### S13. Память (Pro)
**Цель:** факты появляются сами, управляются и выключаются. **Предусловия:** A1 Pro. LLM: 1 (+1).
1. «Memory» в меню аватара. → «Cross-chat memory» включён, «Hira can use these facts in new chats.», «Nothing is stored yet.» или факты.
2. Новый чат: `I want only remote work and never relocation. Find Python jobs.` → Enter [LLM]. Не перезагружая, «Show context» → «Memory» через 3–10 с: «N facts» и формулировки [R][T: секунд до появления].
3. «Memory». → «Constraint · N% · <дата>», «Wording», «Open source chat», «Save», «Pin», «Forget» [R]. «Open source chat» → этот чат.
4. Поменять «Wording» → «Save» → F5 → новая формулировка. Стереть всё → «Save» → «Write the fact before saving».
5. «Pin» → «Unpin».
6. «Forget» у факта. → без подтверждения уезжает [R]. Двойной клик по «Forget» у другого → «Could not forget the fact» на уходящей строке [P13].
7. Выключить «Cross-chat memory». → переключатель сдвинется только после ответа сервера [P12]; текст «Saved facts stay in this list. Hira will not read or write them…»; в чате «Memory»: «Cross-chat memory is off» [R]. Включить.
8. В чате «+» → снять «Use memory». → (необязательно) `What do you know about me?` [LLM]: панель всё равно перечисляет факты [P33]; в новом чате галочка снова стоит.
9. «Billing» → «Downgrade» до Free. → `/settings/memory`: выключатель неактивен, «Cross-chat memory is part of the Pro plan…»; в чате «Context» → «Memory» всё ещё «N facts», будто используются [P15]. Вернуть Pro.
10. «Forget all». → «Forget everything?», «Hira will lose every saved fact. This cannot be undone.», «Cancel» / «Forget all». Enter → по коду отмена [P01]; Esc → отмена [K]; кнопка «Forget all» → «Nothing is stored yet.» [R].

### S14. Профиль и предложения из диалога (Pro)
**Цель:** анкета, города, навыки; предложения не теряют ввод. **Предусловия:** A1 Pro. LLM: 3.
1. «Profile». → «Profile», ссылка «library», поля анкеты, «Save profile», ниже «Preferred cities», «Skills».
2. «Headline» `Junior Python developer`; «Seniority» с клавиатуры: Enter, стрелками «Junior», Enter [K]; «Desired roles» `Python developer, QA`; «Remote», «Hybrid», «Full-time»; «Minimum salary» `abc` → «Save profile». → «Enter a number».
3. `1500`, «Currency» `USD` → «Save profile» [T]. → «Profile saved»; F5 → всё на месте. Изменить «Headline» → «Profile saved» висит дальше [P27].
4. «Add a city» = `Minsk` (поиск латиницей находит кириллицу) → «Минск» → чип [R]; «Remove Минск» → чип уезжает, «No cities yet.»; добавить снова; F5 → на месте.
5. «Find a skill» = `Doc` → «Searching…» → «Docker» → «Selected: Docker»; «Level» «Expert»; «Add skill» → «Docker · Expert · Manual» [R]. Снова Docker → «That skill is already on the profile». «Remove Docker» → уезжает.
6. Чат: `I have 2 years with FastAPI and 3 years with PostgreSQL. Find backend jobs.` → Enter [LLM]. В первые 1–2 с после конца ответа перейти в «Profile» и печатать в «About» `unsaved text`. → через 3–10 с поверх страницы «Add FastAPI to your profile?» со значением «FastAPI · … · 2 years», «Dismiss» / «Add» [R][T]. Если за 10 с не появилась — F5 (тогда P07 этим шагом не проверить).
7. Посмотреть «About» сразу после появления модалки и после «Add». → по коду несохранённый текст стёрт уже при появлении модалки или после «Add» [P07]; FastAPI в «Skills» с источником «Dialog» [R].
8. Следующее «Add PostgreSQL to your profile?» → Esc [K]. → скрыто; F5 → снова; «Dismiss» → больше не появляется.
9. «Library» → «Upload resume» → `no-skills.pdf` [LLM]. → ни модалки, ни сообщения; у файла «Parsed» или «Parse failed» [P02].
10. Чат: `I also know Kubernetes` → Enter [LLM]. → «Add Kubernetes…» не появляется до F5 [P02].

### S15. Звонок (Pro)
**Цель:** голос, перебивание, язык, печать вместо голоса. **Предусловия:** A1 Pro, микрофон или флаги из раздела 0. LLM: 3–4 реплики с озвучкой; без микрофона идут только шаги 1, 7–9 (1 реплика).
1. «Call». → в шапке «Voice language»; круг «Ready», «Start»; в «Recents» звонков нет.
2. «Start» [T: клик → «Listening»]. → запрос микрофона (кнопка всё это время без признака ожидания [P25]); «Listening», круг пульсирует, «End».
3. Сказать `Find remote Python jobs` [LLM+TTS][T: конец фразы → «Searching…» / «Hira is answering» → «Speaking»]. → «You: …», «Hira: …» по мере ответа, карточки; во время речи «Start talking to interrupt».
4. Заговорить, пока Hira говорит [LLM+TTS]. → звук обрывается, подпись Hira обрезана до услышанного, «Listening», новая фраза обработана.
5. «Voice language» → «Russian»; сказать `Что у меня в избранном?` [LLM+TTS]. → ответ по-русски женским голосом, названы вакансии из «Favorites».
6. «End». → «Ready», подписи и карточки очищены; в меню аватара счётчик учёл только поисковые реплики [R].
7. Заблокировать микрофон для localhost в настройках сайта → «Start». → «Listening» и «Microphone access is blocked. Allow it in the browser, or type instead.», поле «Type instead», «Send».
8. В «Type instead» набрать `Find QA jobs in Minsk` → Enter. → перенос строки, не отправка [P24]. «Send» [LLM+TTS] → ответ; пока Hira отвечает, поле пропадает и возвращается без фокуса [P24].
9. Во время звонка клик «Library». → звонок завершён, значок микрофона в браузере погас.

### S16. Оформление и раскладка
**Цель:** тема и раскладка запоминаются, телефон удобен. **Предусловия:** любой аккаунт. LLM: 0.
1. «Settings» → «Appearance». → «Visual style», «Mode»: «System», «Light», «Dark»; по умолчанию «Dark» с галочкой.
2. «Light». → всё светлое сразу; F5 → без вспышки тёмной темы (скриншот сразу после загрузки).
3. «System» → следует ОС; сменить тему ОС → приложение следует без перезагрузки [R].
4. Вторая вкладка не меняет тему до F5 [P28].
5. Tab до вариантов, стрелки ←/→ → по коду не переключают (кнопки с role="radio"), Space/Enter — да [K][P39]. То же у «Monthly»/«Yearly».
6. «Hide sidebar». → узкая колонка: «Show sidebar», «New chat», «Search chats», «Library», «Favorites», «Call», аватар; F5 → остаётся узкой.
7. «Search settings»: `bil` → только «Billing»; `zzz` → «Nothing found».
8. Ширина 390 px: в шапке «New chat» и «Show sidebar»; шторка с «Close sidebar», Esc закрывает, переход по ссылке закрывает; «Show context» — шторка справа; шторка вакансии на всю ширину; горизонтальной прокрутки нет.

### S17. Две вкладки: реактивность и сессия
**Цель:** изменения видны в соседней вкладке без перезагрузки. **Предусловия:** A1 во вкладках T1 и T2. LLM: 0.
1. T2 на `/favorites`; в T1 «Save» на карточке. → в T2 вакансия появилась [R]. «Remove» в T2 → в T1 закладка снята [R].
2. T2 на `/library`; T1 создаёт файл. → в T2 появился [R].
3. T2 в чате; T1 переименовывает, архивирует, удаляет чат. → «Recents» в T2 обновляется [R].
4. T2 на `/settings/memory`; T1 правит «Wording». → в T2 обновится только при возврате на вкладку (по фокусу, не чаще раза в 5 с) [P14].
5. T2 в чате с открытым «Context»; T1 добавляет навык в «Profile». → «Profile» в панели T2 не меняется до следующего ответа [P14].
6. T1 «Log out». → T2 без перезагрузки гость («Guest» / «Demo»); T2 на `/settings/profile` → `/login`; T2 в чате аккаунта → по коду «Chat not found» вместо предложения войти [P30].
7. T2 на `/login`; T1 входит. → T2 ничего не замечает и остаётся на форме [P29].
8. F5 в T1 и T2 одновременно, дважды. → обе остаются в аккаунте (окно 30 с и Web Locks).

### S18. Сбои сети и адреса
**Цель:** понятные ошибки без потери ввода. **Предусловия:** A1. LLM: 0.
1. DevTools → Network → Offline. В чате `test offline` → Enter. → «Message was not sent», текст остался в поле. Online и не отправлять повторно.
2. Offline: Cmd/Ctrl+K и запрос. → «Could not search chats».
3. Offline: клик по заголовку карточки. → «Could not load this vacancy.», кнопки повтора нет.
4. Offline + F5 (только prod-сборка с service worker). → «You are offline», «Try again» → после Online открывает `/chat`.
5. `/chat/00000000-0000-0000-0000-000000000000` → «Chat not found», «New chat»; `/chat/abc` → «Could not load the chat», «Try again».
6. `/profile`, `/memory`, `/billing`, `/settings` → `/settings/profile`, `/settings/memory`, `/settings/billing`, `/settings/appearance`.

## 3. Подозрительные места

По важности. Пути от `apps/web/src/`.

- **P01** `common/components/dialog.tsx:32`, `common/components/confirm-dialog.tsx:18-30` — первый фокусируемый элемент диалога — крестик «Close», а у подтверждения нет autoFocus, поэтому Enter сразу после открытия закрывает «Delete chat?», «Delete collection?», «Delete file?», «Forget everything?» без действия; то же в `suggestions/suggestion-modal.tsx:24` (Enter = отложить) и `suggestions/resume-suggestions-modal.tsx:25` (Enter = Later).
- **P02** `library/upload-resume.ts:8-9`, `suggestions/resume-suggestions-modal.tsx:21`, `suggestions/suggestion-modal.tsx:22` — `resumeBatch` ставится в `true` даже без предложений из резюме: модалка не открывается, сообщения нет, а одиночные предложения из диалога заблокированы до перезагрузки; сбой разбора отвечает 201 (`apps/core-api/src/features/library/document.controller.ts:182-185`), виден только бейдж «Parse failed».
- **P03** `suggestions/resume-suggestions-modal.tsx:23,45` + `suggestions/suggestion-modal.tsx:18-22` — «Later» и Esc только сбрасывают `resumeBatch`, предложения не откладываются, и сразу всплывает одиночная модалка по каждому.
- **P04** `library/library-view.tsx:53,174-175,152` — ошибка «New file» пишется в строку страницы под затемнением, диалог молча остаётся открытым; у «Create file» нет состояния ожидания, двойной клик создаёт два файла.
- **P05** `favorites/favorites-view.tsx:46,65` — `onDone` перечитывает список с текстом из «Search notes», даже если Search не нажимали, и пустое состояние тоже следует неотправленному тексту.
- **P06** `favorites/favorites-view.tsx:55,76-81` — форма «New collection» показана на Free, где коллекций нет (`PLAN_LIMITS.collections = false`); отказ только после отправки, кнопка «Create» без ожидания.
- **P07** `profile/profile-view.tsx:38-42` + `profile/profile-form.tsx:26-28` — профиль перечитывается и форма сбрасывается при смене числа предложений, версии `profile` или токена, стирая несохранённый ввод.
- **P08** `vacancy/feedback.store.ts:21-26` — оценки «Relevant»/«Not relevant» живут только в памяти вкладки и не читаются с сервера (есть только `POST /feedback`), после F5 подсветка пропадает.
- **P09** `chat/message-input.tsx:46-57,50` — поле ввода выключается на время ответа и теряет фокус, вернуть его некому; autoFocus при открытии чата тоже нет.
- **P10** `auth/login-form.tsx:48`, `auth/register-form.tsx:50`, `profile/profile-form.tsx:43-44` — показываются только ошибки пароля (и в профиле — уровня и зарплаты); пустой «Email» без атрибута `required` или «Headline» длиннее 256 молча не пускают форму.
- **P11** `memory/memory-view.tsx:30-34` — успешная перезагрузка не очищает старое «Could not load memory».
- **P12** `memory/memory-view.tsx:46` — переключатель «Cross-chat memory» без оптимистичного сдвига и без ожидания: стоит на месте до ответа сервера, двойной клик шлёт два PATCH.
- **P13** `memory/memory-row.tsx:26-28,50-54` — «Save», «Pin», «Forget» не блокируются; двойной «Forget» показывает ошибку второго DELETE на уходящей строке.
- **P14** `memory/memory-api.ts:11-25`, `profile/profile-api.ts:30-40`, `suggestions/suggestion.store.ts:36-37` — правка фактов, навыков и принятие предложений не зовут `invalidate`/`notifyOtherTabs`, поэтому «Context» → «Profile» в открытом чате и соседние вкладки устаревают до следующего ответа или фокуса.
- **P15** `chat/chat-view.tsx:36` — панель контекста берёт `crossChatMemoryEnabled` без проверки плана, а `memory/memory-view.tsx:39-40` и сервер (`apps/core-api/src/features/memory/turn-context.service.ts:55`) проверяют: на Free панель пишет «N facts», которые не используются.
- **P16** `shell/search-chats-dialog.tsx:32-39,104,48,53` — в поиске чатов Enter и стрелки ничего не делают, каждый запрос заменяет список на «Searching…» (мигание), а список без запроса включает архивные чаты, которых нет в сайдбаре.
- **P17** `shell/profile-menu.tsx:16-17,50`, `shell/app-header.tsx:28-29`, `billing/billing-plans.tsx:21,59` — пока сессия проверяется (`SessionStatus.Unknown`), интерфейс рисуется как у гостя: «Guest» / «Demo», «Upgrade» у Max, «Upgrade» на всех тарифах.
- **P18** `chat/reduce-chat-event.ts:27-28,109` — черновик «Draft from Hira» хранится только во вкладке, F5 или уход из чата до сохранения теряют его.
- **P19** `chat/use-chat-screen.ts:199-200` — неуспешный ответ на «Older messages» молча игнорируется, ошибка видна только при обрыве сети.
- **P20** `chat/composer-menu.tsx:62-67`, `chat/message-input.tsx:36,41` — загрузка резюме из «+» идёт без индикатора, а её ошибка висит над полем до следующей загрузки.
- **P21** `favorites/favorite-card-view.tsx:38,78-84` — «Remove» без подтверждения и без блокировки: второй клик получает 404 и показывает «Could not remove the favorite».
- **P22** `favorites/favorite-card-view.tsx:57,65-70` — «Note» сохраняется только при потере фокуса, Enter не сохраняет, подтверждения нет.
- **P23** `library/document-editor.tsx:38-39,46-50`, `library/library-view.tsx:58,108,181-185` — «Save» и «Pin» без ожидания и без сообщения об успехе; Esc закрывает правку без предупреждения; открытие файла без индикатора загрузки.
- **P24** `call/call-parts.tsx:53`, `call/call-view.tsx:105-108,248` — в «Type instead» Enter переносит строку (в чате отправляет); текст очищается, даже если фраза не ушла; поле пропадает, пока Hira отвечает.
- **P25** `call/call-view.tsx:242` — «Start» не показывает ожидания на время обновления токена, `POST /calls` и запроса микрофона.
- **P26** `billing/billing-plans.tsx:53-57` — «Downgrade» применяется сразу, без подтверждения.
- **P27** `profile/profile-view.tsx:59-62`, `profile/profile-form.tsx:46`, `profile/profile-skills.tsx:35` — «Profile saved» висит после новых правок; «Save profile» и «Add skill» не блокируются на время запроса.
- **P28** `theme/theme-controller.tsx:9-20` — нет слушателя `storage`, тема в соседних вкладках меняется только после F5.
- **P29** `app/(auth)/login/page.tsx:4-6` + `shell/app-shell.tsx:58-61` — страницы входа вне AppShell: вкладка на `/login` не слышит вход в другой вкладке, вошедшему форма показывается без редиректа.
- **P30** `chat/use-chat-screen.ts:66-74`, `chat/chat-api.ts:31`, `chat/chat-view.tsx:58-73` — после выхода в другой вкладке открытый чат аккаунта перечитывается гостем и, вероятно, показывает «Chat not found» вместо предложения войти (проверить).
- **P31** `vacancy/favorite-toggle.tsx:38,55` — «Limit reached. See Billing» — простой текст, не ссылка.
- **P32** `chat/sign-up-links.tsx:9-11` — ссылки баннера — `<a>`, переход перезагружает всё приложение.
- **P33** `chat/use-chat-screen.ts:48`, `chat/context-panel.tsx:61-65` — «Use memory» сбрасывается в каждом чате и после F5, а панель «Memory» этот выключатель не учитывает.
- **P34** `chat/chat-view.tsx:42-46,117` — пока история грузится, лента пустая без скелетона, «Chat actions» в шапке появляется позже (сдвиг).
- **P35** `apps/core-api/src/features/database/migrations/1764000000000-stage-12-memory.ts:36-37` — уникальность предложений только среди PENDING, поэтому повторная загрузка того же резюме снова предлагает уже добавленные навыки.
- **P36** `auth/login-form.tsx:74-79`, `auth/register-form.tsx:69-76` — `pending` снимается сразу после `router.push`, кнопка снова активна, пока страница ещё не сменилась.
- **P37** `chat/message-actions.tsx:18-23` — без `navigator.clipboard` (http по адресу LAN) «Copy» молча ничего не делает.
- **P38** `apps/core-api/src/features/auth/auth.controller.ts:49-126`, `settings/account-section.tsx:18-27` — смены пароля и удаления аккаунта нет ни в API, ни в UI.
- **P39** `settings/appearance-section.tsx:26-27,36-38`, `billing/billing-plans.tsx:35-40` — группы с role="radiogroup" из кнопок без обработки стрелок.
