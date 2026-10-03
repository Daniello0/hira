"""Добавляет ПРИЛОЖЕНИЕ А в конец Курсовая_Вторая_Демо.docx (после списка источников).

Оформление: заголовок приложения — стиль «Заголовок»; подразделы модулей — «Подзаголовок»;
листинги — Courier New 12 pt, одинарный межстрочный интервал, без таблиц и рамок.

Текст листингов читается из каталога ai-job-finder-python/ согласно Требования.md (блок Е.2).

Идемпотентен: повторный запуск удаляет ранее вставленное приложение А и вставляет заново.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

DOC_PATH = Path(
    "/Users/daniel/Documents/Курсач_2026/Курсовая работа (В разработке)/Курсовая_Вторая_Демо.docx"
)
PROJECT_ROOT = Path("/Users/daniel/Documents/Курсач_2026/ai-job-finder-python")

_CH4_PATH = Path(__file__).resolve().parent / ".add_chapter4.py"
_spec = importlib.util.spec_from_file_location("add_ch4", _CH4_PATH)
_add_ch4 = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_add_ch4)

_add_heading = _add_ch4._add_heading
_add_subheading = _add_ch4._add_subheading
_add_paragraph = _add_ch4._add_paragraph
_set_run_font = _add_ch4._set_run_font

APPENDIX_TITLE = (
    "ПРИЛОЖЕНИЕ А. Листинги ключевых модулей программного комплекса"
)

LISTING_SECTIONS: list[tuple[str, Path]] = [
    ("1. Файл backend/src/features/database/models.py", Path("backend/src/features/database/models.py")),
    ("2. Файл backend/src/features/search/router.py", Path("backend/src/features/search/router.py")),
    ("3. Файл backend/src/features/search/schemas.py", Path("backend/src/features/search/schemas.py")),
    ("4. Файл backend/src/features/llm/service.py", Path("backend/src/features/llm/service.py")),
    ("5. Файл backend/src/features/search/service.py", Path("backend/src/features/search/service.py")),
    ("6. Файл backend/src/features/embedding/save_vectors_service.py", Path("backend/src/features/embedding/save_vectors_service.py")),
    ("7. Файл frontend/src/app.py", Path("frontend/src/app.py")),
    ("8. Файл frontend/src/services/chat_service.py", Path("frontend/src/services/chat_service.py")),
]


def _add_page_break(doc) -> None:
    p = _add_paragraph(doc, "По умолчанию")
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def _add_code_listing(doc, source: str) -> None:
    p = _add_paragraph(doc, "По умолчанию")
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    pf.space_before = Pt(0)
    pf.space_after = Pt(6)
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(0)
    run = p.add_run(source)
    _set_run_font(run, "Courier New")
    run.font.size = Pt(12)


def _strip_existing_appendix_a(doc) -> None:
    body = doc.element.body
    children = list(body.iterchildren())
    start_index = None
    for idx, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text.startswith("ПРИЛОЖЕНИЕ А"):
            start_index = idx
            break
    if start_index is None:
        return
    for child in children[start_index:]:
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)


def build_appendix_a() -> None:
    doc = Document(DOC_PATH)
    _strip_existing_appendix_a(doc)

    _add_page_break(doc)
    p_title = _add_heading(doc, APPENDIX_TITLE)
    p_title.paragraph_format.first_line_indent = Cm(0)

    for subtitle, rel_path in LISTING_SECTIONS:
        abs_path = PROJECT_ROOT / rel_path
        code = abs_path.read_text(encoding="utf-8")
        _add_subheading(doc, subtitle)
        sub_p = doc.paragraphs[-1]
        sub_p.paragraph_format.first_line_indent = Cm(0)
        _add_code_listing(doc, code.rstrip() + "\n")

    doc.save(DOC_PATH)


if __name__ == "__main__":
    build_appendix_a()
