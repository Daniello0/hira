#!/usr/bin/env python3
"""Append tables, figure captions, and code listings to the coursework DOCX."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt


ROOT = Path(__file__).resolve().parent
DOC_PATH = ROOT / "Курсовая_Вторая_Демо.docx"

PROJECT = Path(__file__).resolve().parents[1] / "ai-job-finder-python"


def _set_run_font(run, font_name: str, size_pt: float = 10.0) -> None:
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    r = run._element
    rpr = r.get_or_add_rPr()
    rfonts = OxmlElement("w:rFonts")
    rfonts.set(qn("w:ascii"), font_name)
    rfonts.set(qn("w:hAnsi"), font_name)
    rfonts.set(qn("w:cs"), font_name)
    rpr.append(rfonts)


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    """Темы без стиля Heading (в DOCX может не быть Heading 1)."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    size = 16 - min(level, 3)
    run.font.size = Pt(float(size))


def add_note(doc: Document) -> None:
    doc.add_paragraph("Примечание – Источник: собственная разработка")


def add_table_caption(doc: Document, label: str, title: str) -> None:
    p = doc.add_paragraph()
    r = p.add_run(f"{label} – {title}")
    r.bold = True
    add_note(doc)


def add_figure_caption(doc: Document, label: str, title: str) -> None:
    p = doc.add_paragraph()
    r = p.add_run(f"{label} – {title}")
    r.bold = True
    add_note(doc)
    doc.add_paragraph(
        "(Иллюстрацию к данному рисунку вставить самостоятельно по файлам из папки «Рисунки» "
        "или скриншотам интерфейса и Swagger UI.)"
    )


def add_listing_caption(doc: Document, num: str, title: str) -> None:
    p = doc.add_paragraph()
    r = p.add_run(f"Листинг {num} – {title}")
    r.bold = True


def add_code_block(doc: Document, code: str, font_size: float = 9.0) -> None:
    for line in code.strip("\n").split("\n"):
        p = doc.add_paragraph()
        run = p.add_run(line)
        _set_run_font(run, "Courier New", font_size)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.line_spacing = 1.0


def read_project(rel: str) -> str:
    return (PROJECT / rel).read_text(encoding="utf-8")


def build_document() -> None:
    doc = Document(str(DOC_PATH))

    doc.add_page_break()
    add_heading(doc, "Дополнительные материалы", level=1)
    doc.add_paragraph(
        "Ниже приведены таблицы, подписи к рисункам (без самих иллюстраций) и листинги "
        "фрагментов программного кода по проекту ai-job-finder-python. Подписи к рисункам "
        "можно перенести под соответствующие иллюстрации в основном тексте работы."
    )

    # --- Таблицы ---
    add_heading(doc, "Таблицы", level=2)

    add_table_caption(
        doc,
        "Таблица 2.1",
        "Сравнительный анализ универсальных диалоговых систем, HR-платформ "
        "и разрабатываемого чат-бота",
    )

    headers = (
        "Критерий",
        "Универсальные диалоговые системы (ChatGPT, Claude, Gemini)",
        "Специализированные HR-платформы (rabota.by, HeadHunter, LinkedIn)",
        "Разрабатываемый чат-бот",
    )
    rows_data = [
        (
            "Семантический поиск по текстам вакансий",
            "нет (нет прямого доступа к выбранному корпусу вакансий)",
            "частично (ограниченный; преобладает лексический поиск)",
            "да (Sentence-BERT и pgvector)",
        ),
        (
            "Диалоговый ввод запроса на естественном языке",
            "да",
            "нет (преимущественно формы фильтров)",
            "да (Streamlit-чат)",
        ),
        (
            "Мягкая релаксация фильтров при недостаточной выдаче",
            "не применимо",
            "частично или отсутствует",
            "да (алгоритм _relax_filters)",
        ),
        (
            "Локализованный корпус вакансий Республики Беларусь (rabota.by)",
            "нет",
            "да",
            "да (собирается парсером)",
        ),
        (
            "Открытый REST API для интеграций",
            "не предоставляется пользователю как локальный сервис",
            "частично (API у платформ закрытое или иное)",
            "да (FastAPI GET /api/v1/search)",
        ),
    ]

    t = doc.add_table(rows=1 + len(rows_data), cols=4)
    for j, h in enumerate(headers):
        t.rows[0].cells[j].text = h
    for i, row in enumerate(rows_data, start=1):
        for j, cell in enumerate(row):
            t.rows[i].cells[j].text = cell

    add_note(doc)

    add_table_caption(
        doc,
        "Таблица 3.1",
        "Условный пример влияния доменного ранжирования на порядок выдачи "
        "(иллюстрация на одной паре запрос–вакансия)",
    )
    t2 = doc.add_table(rows=3, cols=3)
    t2.rows[0].cells[0].text = "Показатель"
    t2.rows[0].cells[1].text = "До применения доменного ранжирования"
    t2.rows[0].cells[2].text = "После применения доменного ранжирования"
    t2.rows[1].cells[0].text = "Позиция целевой вакансии среди кандидатов после векторного поиска"
    t2.rows[1].cells[1].text = "вторая"
    t2.rows[1].cells[2].text = "первая"
    t2.rows[2].cells[0].text = (
        "Условное косинусное расстояние для той же вакансии после коррекции ранга"
    )
    t2.rows[2].cells[1].text = "0,38"
    t2.rows[2].cells[2].text = "0,35"
    add_note(doc)

    # --- Подписи к рисункам ---
    add_heading(doc, "Подписи к рисункам", level=2)
    figures = [
        (
            "2.1",
            "Обобщённая архитектура программного комплекса и границы компонентов",
        ),
        ("3.1", "Диаграмма компонентов программного комплекса и потоков данных"),
        ("3.2", "Схема таблицы vacancies в базе данных PostgreSQL"),
        (
            "3.3",
            "Автоматически генерируемая документация OpenAPI (Swagger UI) для REST API",
        ),
        (
            "3.4",
            "Схема извлечения структурированных фильтров с помощью Groq Chat Completions "
            "и последующей валидации ответа",
        ),
        ("3.5", "Блок-схема адаптивной релаксации LLM-фильтров"),
        ("3.6", "Схема векторного поиска и доменного ранжирования результатов"),
        (
            "3.7",
            "Схема взаимодействия клиента Streamlit с Backend API при формировании ответа чата",
        ),
        ("3.8", "Пользовательский интерфейс чат-бота: начальное состояние диалога"),
        (
            "3.9",
            "Пользовательский интерфейс чат-бота: результаты поиска и карточки вакансий",
        ),
        (
            "3.10",
            "Пользовательский интерфейс чат-бота: раскрытая карточка вакансии",
        ),
        (
            "3.11",
            "Схема конвейера парсинга вакансий и загрузки данных в PostgreSQL",
        ),
        (
            "3.12",
            "Схема формирования эмбеддинга вакансии и сохранения вектора в базе данных",
        ),
    ]
    for num, title in figures:
        add_figure_caption(doc, f"Рисунок {num}", title)
        doc.add_paragraph()

    # --- Листинги ---
    add_heading(doc, "Листинги программных модулей", level=2)
    doc.add_paragraph(
        "Фрагменты приведены по состоянию репозитория ai-job-finder-python. "
        "Полные тексты модулей дополнительно могут быть включены в приложение А."
    )

    # Listing 3.1
    add_listing_caption(doc, "3.1", "Файл backend/src/features/database/models.py")
    add_code_block(doc, read_project("backend/src/features/database/models.py"))
    add_note(doc)

    # Listing 3.2
    add_listing_caption(
        doc,
        "3.2",
        "Файл backend/migrations/versions/0001_create_vacancies.py",
    )
    add_code_block(doc, read_project("backend/migrations/versions/0001_create_vacancies.py"))
    add_note(doc)

    # Listing 3.3
    add_listing_caption(
        doc,
        "3.3",
        "Файл backend/src/features/search/router.py (маршрут поиска и обработка ошибок)",
    )
    add_code_block(doc, read_project("backend/src/features/search/router.py"))
    add_note(doc)

    # Listing 3.4 - schemas dataclasses + VacancySearchResponse already in router - use schemas
    add_listing_caption(
        doc,
        "3.4",
        "Файл backend/src/features/search/schemas.py (структуры результатов поиска и шага релаксации)",
    )
    add_code_block(doc, read_project("backend/src/features/search/schemas.py"))
    add_note(doc)

    # Listing 3.5 - llm constants excerpt
    add_listing_caption(
        doc,
        "3.5",
        "Файл backend/src/common/constants/llm.py (фрагмент: ключевые константы и шаблон системного промпта)",
    )
    llm_full = read_project("backend/src/common/constants/llm.py")
    add_code_block(doc, llm_full)
    add_note(doc)

    # Listing 3.6 - search constants + relax
    add_listing_caption(
        doc,
        "3.6",
        "Файл backend/src/common/constants/search.py и фрагмент backend/src/features/search/service.py "
        "(релаксация фильтров)",
    )
    add_code_block(
        doc,
        read_project("backend/src/common/constants/search.py")
        + "\n\n# --- features/search/service.py: фрагмент ---\n\n"
        + "\n".join(
            read_project("backend/src/features/search/service.py").splitlines()[217:268]
        ),
    )
    add_note(doc)

    # Listing 3.7
    add_listing_caption(
        doc,
        "3.7",
        "Файл frontend/src/services/chat_service.py",
    )
    add_code_block(doc, read_project("frontend/src/services/chat_service.py"))
    add_note(doc)

    # Listing 3.8
    add_listing_caption(
        doc,
        "3.8",
        "Файлы backend/src/common/constants/embedding.py и фрагмент "
        "backend/src/features/embedding/save_vectors_service.py (взвешенный текст для эмбеддинга)",
    )
    emb_snippet = "\n".join(
        read_project("backend/src/features/embedding/save_vectors_service.py").splitlines()[66:99]
    )
    add_code_block(
        doc,
        read_project("backend/src/common/constants/embedding.py")
        + "\n\n# --- save_vectors_service.py: _vacancy_embed_text ---\n\n"
        + emb_snippet,
    )
    add_note(doc)

    doc.save(str(DOC_PATH))
    print(f"Updated: {DOC_PATH}")


if __name__ == "__main__":
    build_document()
