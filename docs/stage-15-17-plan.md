# Этапы 15–17: доделка логики, архитектуры и интерфейса

Статус: план · 2026-10-24 · ветка `plan/finish-logic`

## 1. Задача

Слово автора (2026-10-24): «доделать полностью всю логику в проекте, всю архитектуру, все фичи, но без сбора данных/тестирования работы». И: «постарайся не тратить лимиты Grok (API), там бесплатная версия, ограничена».

Отсюда границы:

- **Входит.** Всё, что Wiki относит к курсовой ([00 §4](../Wiki/00-vision-and-scope.md), [11-hira.md](../Wiki/11-hira.md)) и чего ещё нет в коде: код коннекторов 4–6, фильтр зарубежной удалёнки, черновик файла от Hira, карточка вакансии со skill-gap и похожими, отзывы, админ-список прогонов, исправления найденных багов, экономия вызовов LLM, runbook.
- **Не входит.** Прогоны сбора вакансий, разметка и прогоны оценки (этап 16), Vitest-покрытие ≥70 % (этап 17), новые тесты. Sparse BGE-M3 и MiniLM-база (абляции 1b/1c, 0, 2 из [08](../Wiki/08-evaluation.md)) — это инфраструктура оценки, их не делаем. MCP и автоотклик — диплом.

Чек-лист требований (источник — Wiki):

| # | Требование | Источник |
|---|---|---|
| R1 | Источники praca.by, LinkedIn, Indeed, троттлинг, выключатель конфигом | 03 §1.3, 1.6–1.8 |
| R2 | `is_foreign_remote`, бейдж «Remote · International», фильтр в UI | Q30, 03 §4 |
| R3 | Hira предлагает md/txt, пользователь подтверждает | 11 §4.3, ADR-024 |
| R4 | `GET /vacancies/{id}`, `/similar`, `/skill-gap` (US-6) | 05 §1.3 |
| R5 | `POST /feedback` | 05 §1.7 |
| R6 | `GET /admin/ingestion/runs` (роль ADMIN) | 05 §1.7 |
| R7 | Мягкая релаксация и персонализация в retrieval | 02 S3–S5 |
| R8 | Ответ на языке реплики, советы по карьере без вакансий | ADR-028 |
| R9 | Профиль: города (`preferredLocations`) | 07 |
| R10 | Swagger для всех внешних маршрутов | 00 §4 |

## 2. Что переиспользуем

- Поток чата и его события — `apps/core-api/src/features/search-orchestrator/orchestrate-search.ts`, `apps/web/src/features/chat/reduce-chat-event.ts`. Новое событие `document-draft` встаёт рядом с `results`.
- Библиотека: `POST /documents` (`library.service.ts`) — черновик сохраняется тем же маршрутом с `fromAssistant: true`.
- Коннекторы: `apps/ingestion-service/src/features/connectors/collect-source.ts` и парсеры `connectors/habr/parse-habr.ts` — образец для трёх новых.
- Объяснение матча: `retrieval-service/src/features/explain/*` — skill-gap переиспользует обход графа.
- Модалка предложений профиля (`apps/web/src/features/suggestions`) — образец подтверждения черновика.

## 3. Решение

Один общий контракт (`packages/contracts`) правится первым; дальше четыре независимых потока по папкам, без пересечения файлов:

1. **web** — `apps/web`.
2. **core-api + llm-service**.
3. **retrieval-service**.
4. **ingestion-service + docker-compose**.

## 4. Архитектура

### 4.1 Контракт (уже в этой ветке)

| Тип | Изменение |
|---|---|
| `IntentType.DraftDocument = 'DRAFT_DOCUMENT'` | Новый акт: «напиши письмо», «допиши предпочтения». Квоту поиска не тратит, поиска нет |
| `HardConstraints.includeForeignRemote?: boolean` | `false` — retrieval отбрасывает `is_foreign_remote = true` |
| `CreateMessageRequest.includeForeignRemote?` | Переключатель в чате; core-api кладёт его в `hardConstraints` |
| `RetrievalRequest.limit?` | Необязательный |
| `VacancyCardSummary.isForeignRemote` | Бейдж в избранном |
| `DocumentSummaryDto.createdBy`, `updatedAt`; `CreateTextDocumentRequest.fromAssistant?` | Черновик Hira, сохранённый пользователем |
| `DocumentDraftDto` | Данные события `document-draft` |
| `VacancyDetailDto`, `VacancySkillDto`, `SkillGapDto`, `SkillGapItem`, `SimilarVacanciesDto` | Карточка вакансии |
| `CreateFeedbackRequest`, `FeedbackDto` | Отзыв по вакансии в сообщении |
| `LocationDto` | Выбор городов в профиле |
| `IngestionRunDto` | Админ-список прогонов |

### 4.2 Источники правды

| Значение | Где | Кто пишет |
|---|---|---|
| `is_foreign_remote` | `vacancies` | ingestion (normalize) |
| Показ зарубежной удалёнки | клиент, `localStorage` | переключатель в чате |
| Черновик файла | только событие потока | никто; файл пишет `POST /documents` после подтверждения |
| Отзыв | `feedback` (уникально `user_id, message_id, vacancy_id`) | `POST /feedback` |
| Бюджет LLM ingestion | Redis-счётчик на сутки | extract-skills job |

### 4.3 Новые маршруты

| Сервис | Метод и путь |
|---|---|
| core-api | `GET /api/v1/vacancies/{id}`, `GET /api/v1/vacancies/{id}/similar`, `GET /api/v1/vacancies/{id}/skill-gap` |
| core-api | `POST /api/v1/feedback` |
| core-api | `GET /api/v1/locations?q=` |
| core-api | `GET /api/v1/admin/ingestion/runs` |
| retrieval | `POST /internal/v1/similar` `{ vacancyId, limit? }` → `{ items: VacancyDto[] }` |
| retrieval | `POST /internal/v1/skill-gap` `{ vacancyId, userId }` → `SkillGapDto` |

### 4.4 Поток черновика файла

1. `understand` возвращает `DRAFT_DOCUMENT`.
2. core-api не зовёт retrieval и не тратит квоту. Ищет в библиотеке файл, который назван в реплике (подстрока названия) — `targetDocumentId`.
3. `generate` получает `intentType = DRAFT_DOCUMENT` и промпт «напиши текст файла целиком, без предисловий»; при целевом файле — его текст в контексте.
4. После генерации core-api шлёт `event: document-draft` (`DocumentDraftDto`), затем `assistant-message` и `done`. Название — эвристика из реплики, без лишнего вызова LLM.
5. Web показывает под ответом карточку «Save to library»: название, формат, «Save as new» / «Replace <file>». Сохранение — `POST /documents` или `PATCH /documents/{id}`.

### 4.5 Экономия вызовов LLM (бесплатный ключ)

- 429 не повторяется; `Retry-After` пробрасывается.
- Квота проверяется до `understand`; без остатка — понимание не зовётся.
- Демо: small talk тоже считается в лимит 3 запросов (иначе бесконечные вызовы).
- Извлечение памяти — только после поиска с непустым ответом, не после small talk и не после сбоя.
- `max_tokens` у каждого вызова; таймаут генерации — по простою потока, а не 12 с на весь ответ.
- Ingestion: извлечение навыков пачкой по 5 вакансий в одном вызове, суточный бюджет `LLM_DAILY_BUDGET` (по умолчанию 200), счётчик неудач на вакансию (после 3 — пропуск), `FOR UPDATE SKIP LOCKED`, эмбеддинг не ждёт навыков. Выключатель `SKILL_EXTRACTION_ENABLED`.

### 4.6 Миграции

Одна новая миграция core-api: `feedback` — уникальный индекс `(user_id, message_id, vacancy_id)`; `vacancies.skill_extract_failures int default 0`. Порядок выкладки: contracts → migrate → retrieval → core-api → web.

## 5. Тесты

По слову автора новые тесты не пишутся. Существующие тесты, которые ломает изменение контракта, правятся так, чтобы `npm run lint` и `tsc` оставались зелёными.

## 6. Вопросы (решены рекомендацией — времени на согласование нет)

1. Зарубежная удалёнка по умолчанию показывается (Q30 «включаем»), переключатель её скрывает.
2. Черновик файла — отдельный акт `DRAFT_DOCUMENT`, а не разбор свободного текста ответа.
3. Название черновика — эвристика из реплики; второй вызов LLM ради названия не делаем.
4. LinkedIn — публичный guest-API страниц вакансий; Indeed — HTML, по умолчанию выключен (антибот). praca.by — HTML. Все три выключаются переменными окружения.
5. Sparse BGE-M3 и MiniLM-база не делаются — это инфраструктура оценки (этап 16).

## 7. Effort

| Этап | Уровень | Почему |
|---|---|---|
| Реализация | high | Четыре сервиса, общий контракт |
| Доработка по замечаниям | medium | Точечные правки |
| Ревью | high | Много файлов, контрактные стыки |
