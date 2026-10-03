"""Добавляет ПРИЛОЖЕНИЕ Б в конец Курсовая_Вторая_Демо.docx.

Содержит набор бенчмарк-запросов и фактические результаты их прогона
(по материалам evaluation-test-2.txt). Оформление согласовано со скриптами
.add_chapter4.py / .add_appendix_a.py / .add_references.py: стили «Рубрика»
для заголовка приложения, «По умолчанию» для текста и подписи под таблицей,
шрифт Times New Roman 14 пт. Колонки таблицы выровнены по требованиям блока
Е.3 файла Требования.md.

Идемпотентен: повторный запуск удаляет ранее вставленный блок приложения Б
и одноимённую строку оглавления, после чего вставляет их заново.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.shared import Cm

DOC_PATH = Path(
    "/Users/daniel/Documents/Курсач_2026/Курсовая работа (В разработке)/Курсовая_Вторая_Демо.docx"
)

_CH4_PATH = Path(__file__).resolve().parent / ".add_chapter4.py"
_spec = importlib.util.spec_from_file_location("add_ch4", _CH4_PATH)
_add_ch4 = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_add_ch4)

_add_paragraph = _add_ch4._add_paragraph
_add_run = _add_ch4._add_run
_add_text_paragraph = _add_ch4._add_text_paragraph
_add_empty = _add_ch4._add_empty
_add_subheading = _add_ch4._add_subheading
_add_table = _add_ch4._add_table
_add_table_caption = _add_ch4._add_table_caption
_add_table_note = _add_ch4._add_table_note
_set_run_font = _add_ch4._set_run_font

APPENDIX_TITLE = "ПРИЛОЖЕНИЕ Б"
APPENDIX_SUBTITLE = "Набор бенчмарк-запросов и результаты прогона"
TOC_PAGE = "67"

# Длинное тире как в методичке (не дефис-минус)
ND = "\u2013"


# ---------------------------------------------------------------------------
# Идемпотентность: удаляем ранее вставленные элементы приложения Б
# ---------------------------------------------------------------------------


_W_T = qn("w:t")
_W_TAB = qn("w:tab")
_W_BR = qn("w:br")


def _para_run_text(para_el) -> str:
    """Текст абзаца из w:t/w:tab-элементов (без артефактов lxml.itertext)."""
    parts = []
    for elem in para_el.iter():
        if elem.tag == _W_T and elem.text:
            parts.append(elem.text)
        elif elem.tag == _W_TAB:
            parts.append("\t")
        elif elem.tag == _W_BR:
            parts.append("\n")
    return "".join(parts).strip()


def _strip_existing_appendix_b(doc) -> None:
    """Удаляет основной блок приложения Б (стиль «Рубрика»)."""
    body = doc.element.body
    children = list(body.iterchildren())
    start_index = None
    for idx, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        text = _para_run_text(child)
        if text != APPENDIX_TITLE:
            continue
        p_pr = child.find(qn("w:pPr"))
        if p_pr is None:
            continue
        p_style = p_pr.find(qn("w:pStyle"))
        if p_style is None:
            continue
        style_val = p_style.get(qn("w:val")) or ""
        if "TOC" in style_val:
            continue
        start_index = idx
        break
    if start_index is None:
        return
    for child in children[start_index:]:
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)


def _strip_existing_toc_appendix_b(doc) -> None:
    """Удаляет строку оглавления уровня TOC 3 «ПРИЛОЖЕНИЕ Б …»."""
    body = doc.element.body
    to_remove = []
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = _para_run_text(child)
        if not text.startswith(APPENDIX_TITLE):
            continue
        p_pr = child.find(qn("w:pPr"))
        if p_pr is None:
            continue
        p_style = p_pr.find(qn("w:pStyle"))
        if p_style is None:
            continue
        style_val = p_style.get(qn("w:val")) or ""
        if "TOC" not in style_val:
            continue
        head = text.split("\t", 1)[0].strip()
        # числовая часть после таба может содержать только цифры (номер страницы)
        if head == APPENDIX_TITLE:
            to_remove.append(child)
    for child in to_remove:
        body.remove(child)


# ---------------------------------------------------------------------------
# Вставка строки в оглавление
# ---------------------------------------------------------------------------


def _build_toc3_paragraph(doc, text: str, page: str):
    """TOC-абзац уровня 3 (как у строки «ПРИЛОЖЕНИЕ А»)."""
    p = doc.add_paragraph(style=doc.styles["TOC 3"])
    run_text = _add_run(p, text)
    tab_run = p.add_run("\t")
    _set_run_font(tab_run, "Times New Roman")
    _add_run(p, page)
    return p


def _insert_toc_appendix_b(doc) -> None:
    """Добавляет строку «ПРИЛОЖЕНИЕ Б\tNN» сразу после строки приложения А."""
    body = doc.element.body
    anchor = None
    for child in body.iterchildren():
        if child.tag != qn("w:p"):
            continue
        text = _para_run_text(child)
        if not text.startswith("ПРИЛОЖЕНИЕ А"):
            continue
        p_pr = child.find(qn("w:pPr"))
        if p_pr is None:
            continue
        p_style = p_pr.find(qn("w:pStyle"))
        if p_style is None:
            continue
        style_val = p_style.get(qn("w:val")) or ""
        if "TOC" not in style_val:
            continue
        if text.split("\t", 1)[0].strip() == "ПРИЛОЖЕНИЕ А":
            anchor = child
            break
    if anchor is None:
        return
    p = _build_toc3_paragraph(doc, APPENDIX_TITLE, TOC_PAGE)
    el = p._element
    body.remove(el)
    anchor.addnext(el)


# ---------------------------------------------------------------------------
# Содержимое приложения Б
# ---------------------------------------------------------------------------


def _add_page_break(doc) -> None:
    p = _add_paragraph(doc, "По умолчанию")
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def _add_appendix_title(doc) -> None:
    """Заголовок приложения стилем «Рубрика» (центр, полужирный 14 пт)."""
    p = doc.add_paragraph(style=doc.styles["Рубрика"])
    p.paragraph_format.first_line_indent = Cm(0)
    run = p.add_run(APPENDIX_TITLE)
    _add_ch4._set_run_font(run, "Times New Roman")


def _add_appendix_subtitle(doc) -> None:
    """Подзаголовок приложения: центр, полужирный, как в приложении А."""
    p = _add_paragraph(doc, "По умолчанию", alignment=WD_ALIGN_PARAGRAPH.CENTER)
    p.paragraph_format.first_line_indent = Cm(0)
    _add_run(p, APPENDIX_SUBTITLE, bold=True)


def _benchmark_rows() -> list[list[str]]:
    """Шестнадцать строк по материалам evaluation-test-2.txt."""
    return [
        [
            "1",
            "Студент без опыта, ПВЗ Wildberries или Ozon, на месте работодателя",
            "пвз, пункт выдачи, wildberries, ozon",
            "да",
            "да",
            "Продавец-кассир в пункт выдачи заказов, город Гродно",
        ],
        [
            "2",
            "Стажировка или junior в интернет-маркетинге, digital",
            "маркетолог, интернет-маркетолога, digital",
            "да",
            "да",
            "Ассистент интернет-маркетолога",
        ],
        [
            "3",
            "Бариста или работа в кофейне, без опыта",
            "бариста, кофе, кофейн",
            "да",
            "да",
            "Бариста (ИП Христиченко Татьяна Петровна)",
        ],
        [
            "4",
            "Кладовщик 2 на 2, вечерние или ночные смены, на месте работодателя",
            "кладовщик, склад",
            "да",
            "да",
            "Кладовщик (ООО ЛогиЛидер)",
        ],
        [
            "5",
            "Комплектовщик или сортировщик на складе, ночные смены",
            "комплектовщик, сортировщик, склад",
            "да",
            "да",
            "Комплектовщик / Грузчик / Разнорабочий",
        ],
        [
            "6",
            "Логист, экспедитор или менеджер по логистике, график 5 на 2",
            "логист, экспедитор",
            "да",
            "да",
            "Менеджер по логистике (ООО К 2 Технологии)",
        ],
        [
            "7",
            "Подработка продавцом в магазине, частичная занятость",
            "продавец",
            "да",
            "да",
            "Продавец в магазин «Гренка»",
        ],
        [
            "8",
            "Удалённая работа support или help desk specialist",
            "support, help desk, специалист",
            "да",
            "да",
            "Support Specialist (Help Desk Analyst), GP Solutions",
        ],
        [
            "9",
            "Программист 1C, удалённо, полная занятость",
            "программист 1c, 1c",
            "да",
            "да",
            "Программист 1C (ОДО ЮКОЛА-ИНФО-Брест)",
        ],
        [
            "10",
            "Официант или повар без опыта, сменный график",
            "официант, повар",
            "да",
            "да",
            "Официант в ресторан «МАРМО»",
        ],
        [
            "11",
            "Водитель категории В, разъездной формат и доставка",
            "водитель",
            "да",
            "да",
            "Водитель категории В (Автолайтэкспресс)",
        ],
        [
            "12",
            "Стартовая роль в подборе персонала, IT-сфера, стажировка или junior",
            "подбор, hr, рекрутер, персонал",
            "нет",
            "да",
            "Junior Sales Manager (ООО Сенлайн)",
        ],
        [
            "13",
            "Удалённый ассистент интернет-маркетолога, контент и аналитика",
            "ассистент интернет-маркетолога, маркетолог",
            "да",
            "да",
            "Ассистент интернет-маркетолога (Зизор)",
        ],
        [
            "14",
            "Мерчендайзер или торговый представитель, разъездной характер",
            "мерчендайзер, торгов",
            "да",
            "да",
            "Торговый представитель отдела продаж",
        ],
        [
            "15",
            "Кондитер или помощник кондитера, сменный график, десерты",
            "кондитер, десерт",
            "да",
            "да",
            "Кондитер / помощник кондитера (СвитБэйкер, ЧП)",
        ],
        [
            "16",
            "ПВЗ Ozon или Wildberries, выдача посылок, приём заказов",
            "пвз, ozon, wildberries, пункт выдачи",
            "нет",
            "нет",
            "Подходящих вакансий не найдено",
        ],
    ]


def _add_appendix_b(doc) -> None:
    _add_page_break(doc)

    _add_appendix_title(doc)
    _add_appendix_subtitle(doc)
    _add_empty(doc)
    _add_empty(doc)

    _add_text_paragraph(
        doc,
        "В приложении приведён полный перечень эталонных запросов, использованных "
        "для количественной оценки качества пользовательского поиска вакансий, и "
        "результаты их прогона на разработанном чат-боте. Набор сформирован по "
        "материалам модуля backend/src/features/search/evaluation.py "
        f"(функция run_search_evaluation) и включает {ND} в соответствии с "
        "методикой, описанной в параграфе 4.1 основного текста, {ND} шестнадцать "
        "естественно-языковых запросов, охватывающих типовые сценарии поиска "
        "первой работы для выпускников высших учебных заведений Республики "
        "Беларусь.",
    )
    _add_text_paragraph(
        doc,
        "Контрольный прогон выполнен в локальной среде проекта на актуальной базе "
        "вакансий портала rabota.by. Между обращениями к языковой модели Groq "
        "выдерживалась задержка в шестьдесят секунд для соблюдения ограничения "
        "частоты обращений к Chat Completions API. Для каждого запроса в таблице "
        "Б.1 указан сокращённый текст обращения, кортеж ожидаемых ключевых слов, "
        "значения метрик hit@1 и hit@5, а также заголовок вакансии, занявшей "
        "первую позицию выдачи. Полный машинный протокол прогона с косинусными "
        "расстояниями и идентификаторами вакансий хранится в файле "
        "evaluation-test-2.txt репозитория проекта.",
    )
    _add_empty(doc)

    _add_table_caption(doc, "Таблица Б.1 – Результаты прогона эталонных запросов")
    _add_table(
        doc,
        header=[
            "№",
            "Запрос (сокращённо)",
            "Ожидаемые ключевые слова",
            "hit@1",
            "hit@5",
            "Заголовок вакансии в позиции top-1",
        ],
        rows=_benchmark_rows(),
        col_widths_cm=[0.9, 4.4, 3.6, 1.2, 1.2, 5.4],
    )
    _add_empty(doc, style="По умолчанию")
    _add_table_note(doc)
    _add_empty(doc)
    _add_empty(doc)

    _add_text_paragraph(
        doc,
        "Итоговые значения метрик по всему набору бенчмарков составили: hit@1 "
        "равен четырнадцати из шестнадцати, hit@5 равен пятнадцати из "
        "шестнадцати. Доля корректных попаданий целевой профессиональной роли в "
        "первую позицию выдачи составила приблизительно ноль целых восемьдесят "
        "восемь сотых, доля корректных попаданий в топ-5 {} приблизительно ноль "
        "целых девяносто четыре сотых. Полученные значения превышают целевое "
        "нефункциональное требование hit@5 не ниже ноль целых семьдесят пять "
        "сотых, зафиксированное в параграфе 2.3 основного текста, что "
        "подтверждает работоспособность чат-бота на эталонных пользовательских "
        "сценариях.".format(ND),
    )
    _add_text_paragraph(
        doc,
        "Из шестнадцати запросов лишь два не дали идеального попадания. В "
        "сценарии под номером двенадцать (стартовая роль в подборе персонала, "
        "IT-сфера, формат стажировки или junior) релевантная вакансия "
        "присутствовала в топ-5, однако первой позицией выдачи оказалась "
        "семантически близкая, но нерелевантная вакансия Junior Sales Manager. "
        "В сценарии под номером шестнадцать (работа в пункте выдачи заказов "
        "Ozon или Wildberries с упором на выдачу посылок) после применения "
        "LLM-фильтров и нескольких этапов релаксации в локальной базе не "
        "осталось ни одного кандидата, удовлетворяющего ограничениям; в этом "
        "случае серверная часть корректно вернула пустой список вакансий, что "
        "соответствует предусмотренной модели мягкой деградации, описанной в "
        "параграфе 4.4.",
    )
    _add_text_paragraph(
        doc,
        "Сравнение полученных значений с показателями ранее выполненной версии "
        "прототипа (десять из шестнадцати по hit@1 и тринадцать из шестнадцати "
        "по hit@5) показывает заметное улучшение по обеим метрикам. Прирост "
        "достигнут за счёт реализации алгоритма доменного ранжирования и "
        "адаптивной релаксации LLM-фильтров с защитой приоритетных ключей "
        "(параграф 3.5), а также взвешенного текстового представления вакансии "
        "при векторизации (параграф 3.7). Таким образом, представленный в "
        "приложении Б протокол подтверждает эффективность принятых "
        "архитектурных и алгоритмических решений.",
    )


# ---------------------------------------------------------------------------
# Точка входа
# ---------------------------------------------------------------------------


def main() -> None:
    if not DOC_PATH.exists():
        raise SystemExit(f"Не найден файл: {DOC_PATH}")

    doc = Document(str(DOC_PATH))

    _strip_existing_toc_appendix_b(doc)
    _strip_existing_appendix_b(doc)

    _insert_toc_appendix_b(doc)
    _add_appendix_b(doc)

    doc.save(str(DOC_PATH))
    print(f"OK: {APPENDIX_TITLE} записано в {DOC_PATH}")


if __name__ == "__main__":
    main()
