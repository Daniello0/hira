"""Добавляет раздел СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ в конец Курсовая_Вторая_Демо.docx.

Оформление согласовано со скриптами глав (.add_chapter4.py): стили «Заголовок»,
«По умолчанию», шрифт Times New Roman. Текст списка — по plan_final.md и блоку Д
файла Требования.md; пункт с плейсхолдером заменён на учебное издание по FastAPI.

Типографика длинного тире (U+2013) — в духе методички «Порядок представления…».

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

REF_TITLE = "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ"
TOC_ANCHOR = "ЗАКЛЮЧЕНИЕ"
TOC_PAGE_REF = "38"

# Длинное тире как в методичке (не дефис минуса)
ND = "\u2013"


def _build_toc_paragraph_level1(doc, title: str, page: str):
    """TOC 1 — как для «ЗАКЛЮЧЕНИЕ»."""
    return _build_toc_paragraph(doc, 1, title, page)


def _set_toc_entry_page(para, page: str) -> None:
    digit_runs = [r for r in para.runs if r.text and r.text.isdigit()]
    if digit_runs:
        digit_runs[-1].text = page
        return
    full = "".join(r.text for r in para.runs)
    if full.endswith("\t") or full.endswith("\t "):
        run = para.add_run()
        _add_ch4._set_run_font(run, "Times New Roman")
        run.text = page


def _strip_existing_toc_reference(doc) -> None:
    body = doc.element.body
    to_remove = []
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text == REF_TITLE or text.startswith(REF_TITLE + "\t"):
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


def _strip_existing_references(doc) -> None:
    """Удаляет раздел со страницы «СПИСОК…»: стиль Заголовок (не строка оглавления TOC)."""
    start_el = None
    for para in doc.paragraphs:
        if para.style.name.startswith("TOC"):
            continue
        if para.style.name == "Заголовок" and para.text.strip() == REF_TITLE:
            start_el = para._element
            break
    if start_el is None:
        return
    body = start_el.getparent()
    children = list(body.iterchildren())
    try:
        idx = children.index(start_el)
    except ValueError:
        return
    for child in children[idx:]:
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)


def _insert_toc_after_conclusion(doc) -> None:
    """Вставляет строку оглавления после «ЗАКЛЮЧЕНИЕ»."""
    body = doc.element.body
    anchor = None
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = "".join(child.itertext()).strip()
        if text.startswith(TOC_ANCHOR) and "\t" in text:
            p_pr = child.find(qn("w:pPr"))
            if p_pr is None:
                continue
            p_style = p_pr.find(qn("w:pStyle"))
            if p_style is None:
                continue
            style_val = p_style.get(qn("w:val")) or ""
            if "TOC" not in style_val:
                continue
            # строка «ЗАКЛЮЧЕНИЕ\t37», не другие вхождения
            if text.split("\t", 1)[0].strip() == TOC_ANCHOR:
                anchor = child
                break
    if anchor is None:
        return
    p = _build_toc_paragraph_level1(doc, REF_TITLE, TOC_PAGE_REF)
    el = p._element
    body.remove(el)
    anchor.addnext(el)


def _sync_toc_conclusion_page(doc) -> None:
    """После добавления списка источников номер страницы заключения оставляем 37."""
    for para in doc.paragraphs:
        if para.style.name not in ("TOC 1", "TOC 2"):
            continue
        text = "".join(r.text for r in para.runs)
        if text.startswith(TOC_ANCHOR + "\t") and text.split("\t", 1)[0].strip() == TOC_ANCHOR:
            _set_toc_entry_page(para, "37")


def _add_page_break(doc) -> None:
    p = _add_paragraph(doc, "По умолчанию")
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def _add_ref_item(doc, text: str) -> None:
    p = _add_paragraph(doc, "По умолчанию", alignment=WD_ALIGN_PARAGRAPH.JUSTIFY)
    _add_run(p, text)


def _references_entries() -> list[str]:
    """21 позиция по plan_final; п. 5 — конкретное пособие вместо плейсхолдера."""
    return [
        (
            "1. Manning C. D., Raghavan P., Schütze H. Introduction to Information "
            f"Retrieval. {ND} Cambridge: Cambridge University Press, 2008."
        ),
        (
            f"2. Jurafsky D., Martin J. H. Speech and Language Processing "
            f"(3rd ed. draft) [Электронный ресурс]. {ND} Режим доступа: "
            f"https://web.stanford.edu/~jurafsky/slp3/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"3. Жерон О. Прикладное машинное обучение с помощью Scikit-Learn, "
            f"Keras и TensorFlow. {ND} СПб.: Питер, 2022."
        ),
        (
            f"4. Гудфеллоу Я., Бенджи И., Курвиль А. Глубокое обучение. {ND} М.: ДМК Пресс, 2018."
        ),
        (
            f"5. Рама Р., Николайдес Д. Разработка веб-API на Python с помощью FastAPI "
            f"/ пер. с англ. {ND} СПб.: Питер, 2024."
        ),
        (
            f"6. Vaswani A. et al. Attention Is All You Need // Advances in Neural Information "
            f"Processing Systems : proceedings. {ND} 2017. {ND} Vol. 30."
        ),
        (
            f"7. Devlin J. et al. BERT: Pre-training of Deep Bidirectional Transformers for "
            f"Language Understanding // Proceedings of the 2019 Conference of the North American "
            f"Chapter of the Association for Computational Linguistics. {ND} 2019. {ND} P. 4171{ND}4186."
        ),
        (
            f"8. Reimers N., Gurevych I. Sentence-BERT: Sentence Embeddings using Siamese "
            f"BERT-Networks // Proceedings of the 2019 Conference on Empirical Methods in "
            f"Natural Language Processing. {ND} 2019. {ND} P. 3980{ND}3990."
        ),
        (
            f"9. Lewis P. et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP "
            f"Tasks // Advances in Neural Information Processing Systems : proceedings. {ND} 2020. {ND} Vol. 33."
        ),
        (
            f"10. Wang W. et al. MiniLM: Deep Self-Attention Distillation for Task-Agnostic "
            f"Compression of Pre-Trained Transformers // Advances in Neural Information "
            f"Processing Systems : proceedings. {ND} 2020. {ND} Vol. 33."
        ),
        (
            f"11. PostgreSQL Documentation [Электронный ресурс] / PostgreSQL Global Development "
            f"Group. {ND} Режим доступа: https://www.postgresql.org/docs/current/. {ND} "
            f"Дата обращения: 09.05.2026."
        ),
        (
            f"12. pgvector: Open-source vector similarity search for Postgres [Электронный ресурс]. "
            f"{ND} Режим доступа: https://github.com/pgvector/pgvector. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"13. FastAPI Documentation [Электронный ресурс] / Sebastián Ramírez. {ND} Режим доступа: "
            f"https://fastapi.tiangolo.com/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"14. Streamlit Documentation [Электронный ресурс] / Snowflake Inc. {ND} Режим доступа: "
            f"https://docs.streamlit.io/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"15. SQLAlchemy 2.x Documentation (ORM, ядро async-драйверов; см. также asyncpg) "
            f"[Электронный ресурс]. {ND} Режим доступа: https://docs.sqlalchemy.org/en/20/; "
            f"https://magicstack.github.io/asyncpg/current/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"16. Pydantic Documentation [Электронный ресурс]. {ND} Режим доступа: "
            f"https://docs.pydantic.dev/latest/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"17. Sentence-Transformers Documentation [Электронный ресурс]. {ND} Режим доступа: "
            f"https://www.sbert.net/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"18. Groq — Chat Completions API Reference [Электронный ресурс] / Groq, Inc. {ND} "
            f"Режим доступа: https://console.groq.com/docs/api-reference#chat-create. {ND} "
            f"Дата обращения: 09.05.2026."
        ),
        (
            f"19. paraphrase-multilingual-MiniLM-L12-v2 [Электронный ресурс] / Hugging Face, Inc. "
            f"{ND} Режим доступа: "
            f"https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2. {ND} "
            f"Дата обращения: 09.05.2026."
        ),
        (
            f"20. rabota.by {ND} портал поиска вакансий в Республике Беларусь [Электронный ресурс]. "
            f"{ND} Режим доступа: https://rabota.by/. {ND} Дата обращения: 09.05.2026."
        ),
        (
            f"21. Telegram Bot API Documentation [Электронный ресурс] / Telegram Messenger LLP. {ND} "
            f"Режим доступа: https://core.telegram.org/bots/api. {ND} Дата обращения: 09.05.2026."
        ),
    ]


def _add_references(doc) -> None:
    _add_page_break(doc)

    _add_heading(doc, REF_TITLE)
    _add_empty(doc)
    _add_empty(doc)
    _add_empty(doc)

    for entry in _references_entries():
        _add_ref_item(doc, entry)
        _add_empty(doc)


def main() -> None:
    doc = Document(DOC_PATH)
    _strip_existing_toc_reference(doc)
    _strip_existing_references(doc)
    _insert_toc_after_conclusion(doc)
    _sync_toc_conclusion_page(doc)
    _add_references(doc)
    doc.save(DOC_PATH)
    print(f"OK: {REF_TITLE} записано в {DOC_PATH}")


if __name__ == "__main__":
    main()
