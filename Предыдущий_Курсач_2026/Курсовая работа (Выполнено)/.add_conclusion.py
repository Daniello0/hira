"""Добавляет раздел ЗАКЛЮЧЕНИЕ в конец Курсовая_Вторая_Демо.docx.

Оформление согласовано с шаблоном (стили Заголовок, По умолчанию, Times New Roman)
и с Требования.md, plan_final.md: нумерованный список из десяти выводов, итоговый абзац.

Идемпотентен: повторный запуск удаляет ранее вставленный блок и строку оглавления.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn

DOC_PATH = Path(
    "/Users/daniel/Documents/Курсач_2026/Курсовая работа (В разработке)/Курсовая_Вторая_Демо.docx"
)

_CH4_PATH = Path(__file__).resolve().parent / ".add_chapter4.py"
_spec = importlib.util.spec_from_file_location("add_ch4", _CH4_PATH)
_add_ch4 = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_add_ch4)

_add_heading = _add_ch4._add_heading
_add_paragraph = _add_ch4._add_paragraph
_add_run = _add_ch4._add_run
_add_empty = _add_ch4._add_empty
_build_toc_paragraph = _add_ch4._build_toc_paragraph

CONCLUSION_TITLE = "ЗАКЛЮЧЕНИЕ"
TOC_ANCHOR = "5.6 Выводы по главе 5"
TOC_PAGE_CONCLUSION = "36"
TOC_PAGE_CH56 = "35"


def _set_toc_entry_page(para, page: str) -> None:
    """Выставляет номер страницы в строке оглавления (последний числовой run)."""
    digit_runs = [r for r in para.runs if r.text and r.text.isdigit()]
    if digit_runs:
        digit_runs[-1].text = page
        return
    # запасной вариант: один run в конце с табом и номером
    full = "".join(r.text for r in para.runs)
    if full.endswith("\t") or full.endswith("\t "):
        run = para.add_run()
        _add_ch4._set_run_font(run, "Times New Roman")
        run.text = page


def _sync_toc_pages_for_conclusion(doc) -> None:
    """После добавления «ЗАКЛЮЧЕНИЯ» выравнивает номера страниц в оглавлении главы 5."""
    for para in doc.paragraphs:
        if para.style.name not in ("TOC 1", "TOC 2"):
            continue
        text = "".join(r.text for r in para.runs)
        if text.startswith(TOC_ANCHOR):
            _set_toc_entry_page(para, TOC_PAGE_CH56)
        elif text.strip().startswith(CONCLUSION_TITLE):
            _set_toc_entry_page(para, TOC_PAGE_CONCLUSION)


def _add_page_break(doc) -> None:
    p = _add_paragraph(doc, "По умолчанию")
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def _add_numbered_item(doc, text: str) -> None:
    p = _add_paragraph(doc, "По умолчанию", alignment=WD_ALIGN_PARAGRAPH.JUSTIFY)
    _add_run(p, text)


def _strip_existing_conclusion(doc) -> None:
    body = doc.element.body
    children = list(body.iterchildren())
    start_index = None
    for idx, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text == CONCLUSION_TITLE:
            start_index = idx
            break
    if start_index is None:
        return
    for child in children[start_index:]:
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)


def _strip_existing_toc_conclusion(doc) -> None:
    body = doc.element.body
    to_remove = []
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text == CONCLUSION_TITLE or text.startswith(CONCLUSION_TITLE + "\t"):
            p_pr = child.find(qn("w:pPr"))
            if p_pr is None:
                continue
            p_style = p_pr.find(qn("w:pStyle"))
            if p_style is None:
                continue
            style_val = p_style.get(qn("w:val")) or ""
            if "TOC" in style_val:
                to_remove.append(child)
    for child in to_remove:
        body.remove(child)


def _insert_toc_conclusion(doc) -> None:
    """Вставляет запись оглавления после строки «5.6 Выводы по главе 5»."""
    body = doc.element.body
    anchor = None
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text.startswith(TOC_ANCHOR):
            p_pr = child.find(qn("w:pPr"))
            if p_pr is None:
                continue
            p_style = p_pr.find(qn("w:pStyle"))
            if p_style is None:
                continue
            style_val = p_style.get(qn("w:val")) or ""
            if "TOC" not in style_val:
                continue
            anchor = child
            break
    if anchor is None:
        return
    p = _build_toc_paragraph(doc, 1, CONCLUSION_TITLE, TOC_PAGE_CONCLUSION)
    el = p._element
    body.remove(el)
    anchor.addnext(el)


def _add_conclusion(doc) -> None:
    _add_page_break(doc)

    _add_heading(doc, CONCLUSION_TITLE)
    _add_empty(doc)
    _add_empty(doc)

    _add_numbered_item(
        doc,
        "1. Систематизированы теоретические основы построения чат-ботов и семантического "
        "поиска вакансий; обоснована применимость двунаправленного энкодера семейства "
        "Sentence-BERT и парадигмы дополнения генерации извлечением (retrieval-augmented "
        "generation) для задачи подбора вакансий на диалоговом интерфейсе (параграфы "
        "1.1–1.4).",
    )
    _add_numbered_item(
        doc,
        "2. Проанализированы специфика рынка труда Республики Беларусь для выпускников "
        "высших учебных заведений, существующие диалоговые системы и программные средства "
        "поиска вакансий; выявлены ограничения сочетания жёстких фильтров с лексическим "
        "поиском и сформулирована постановка задачи с функциональными и нефункциональными "
        "требованиями (параграфы 2.1–2.3).",
    )
    _add_numbered_item(
        doc,
        "3. Обоснован выбор программного стека: язык Python, серверная часть на FastAPI, "
        "клиент Streamlit, PostgreSQL с расширением pgvector, мультиязычная модель "
        "представления предложений MiniLM, облачный сервис большой языковой модели Groq "
        "(параграф 2.4).",
    )
    _add_numbered_item(
        doc,
        "4. Спроектирована трёхуровневая клиент-серверная архитектура с протоколом REST и "
        "реализована схема базы знаний с векторным полем размерности 384 и миграциями "
        "Alembic (параграфы 3.1–3.2).",
    )
    _add_numbered_item(
        doc,
        "5. Реализован серверный программный интерфейс на FastAPI с маршрутом "
        "GET /api/v1/search, проверкой входных данных средствами Pydantic, автоматически "
        "формируемой документацией OpenAPI и единым форматом сообщений об ошибках "
        "(параграф 3.3).",
    )
    _add_numbered_item(
        doc,
        "6. Реализована логика большой языковой модели: извлечение структурированных "
        "фильтров по запросу пользователя с использованием режима json_schema и строгой "
        "валидации на стороне сервера (параграф 3.4).",
    )
    _add_numbered_item(
        doc,
        "7. Реализованы адаптивная релаксация фильтров при недостаточном числе кандидатов "
        "с защитой приоритетных признаков и доменное ранжирование выдачи как упрощённая "
        "альтернатива дорогостоящему переранжированию cross-encoder (параграф 3.5).",
    )
    _add_numbered_item(
        doc,
        "8. Разработан веб-интерфейс на Streamlit с историей диалога и карточками вакансий; "
        "настроен контур сбора данных с портала rabota.by и взвешенное текстовое "
        "представление вакансий для векторизации (параграфы 3.6–3.7).",
    )
    _add_numbered_item(
        doc,
        "9. На наборе из шестнадцати эталонных бенчмарк-запросов зафиксированы значения "
        "метрики hit@1, равные четырнадцати из шестнадцати, и метрики hit@5, равные "
        "пятнадцати из шестнадцати; функциональное тестирование пользовательских сценариев "
        "и оценка времени отклика программного интерфейса подтвердили работоспособность "
        "комплекса в целом (параграфы 4.1–4.5).",
    )
    _add_numbered_item(
        doc,
        "10. Предложены направления дальнейшего развития: контейнеризация и регламент "
        "обновления данных, интеграция с мессенджерами, персонализация и генеративное "
        "резюмирование вакансий, а также исследовательские шаги по усилению слоя извлечения "
        "и переранжирования (глава 5).",
    )
    _add_empty(doc)
    _add_numbered_item(
        doc,
        "Таким образом, цель работы достигнута, все поставленные задачи выполнены: "
        "разработан работоспособный чат-бот для семантического поиска вакансий на рынке "
        "труда Республики Беларусь, реализующий клиент-серверную архитектуру и "
        "интеграцию с большой языковой моделью.",
    )


def main() -> None:
    doc = Document(DOC_PATH)
    _strip_existing_toc_conclusion(doc)
    _strip_existing_conclusion(doc)
    _insert_toc_conclusion(doc)
    _add_conclusion(doc)
    _sync_toc_pages_for_conclusion(doc)
    doc.save(DOC_PATH)
    print(f"OK: {CONCLUSION_TITLE} записано в {DOC_PATH}")


if __name__ == "__main__":
    main()
