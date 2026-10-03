# Этап 3. База данных

Решение по лексической колонке, `industries` и dev-seed — ADR-030 и `Wiki/04-data-model.md`.

Схема живёт в `apps/core-api`: сущности TypeORM, миграция `InitialSchema`, контейнер `migrate` в Compose. `synchronize` выключен. Индексы HNSW, BM25 и trigram заданы в SQL миграции. Seed — справочник `locations` (области, Минск, областные центры).
