#!/usr/bin/env python3
"""
Генерация горизонтальной блок-схемы user_search() для проекта
ai-job-finder-python (для слайдов презентации).

Содержание схемы полностью соответствует вертикальному варианту
(user_search_flowchart_vertical.svg/png), но раскладка идёт слева направо:
основной поток вытянут в один ряд, обработка ошибок и ранние выходы
располагаются под основной линией, а цикл релаксации фильтров — над ней.

Требуется установленный Graphviz (команда `dot` в PATH).
Запуск:
  python3 render_user_search_flowchart_horizontal.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent
PROJECT_HINT = "ai-job-finder-python"


def build_dot_source() -> str:
    return rf"""
digraph user_search_horizontal_{PROJECT_HINT.replace("-", "_")} {{
    graph [
        rankdir=LR
        bgcolor="white"
        fontname="Arial"
        fontsize=12
        dpi=300
        splines=true
        overlap=false
        nodesep=0.35
        ranksep=0.55
        charset="utf-8"
    ]
    node [
        shape=box
        style="rounded,filled"
        fontname="Arial"
        fontsize=11
    ]
    edge [
        fontname="Arial"
        fontsize=10
        color="#37474f"
    ]

    // ===== Узлы основного потока =====
    start [shape=circle, label="", width=0.3, height=0.3,
           fillcolor="#263238", color="#263238"]

    n_input [label="Пользователь вводит\nтекстовый запрос",
             fillcolor="#e1f5fe", color="#01579b", penwidth=1.2]

    n_entry [label="user_search()\ntrim + проверка пустого запроса",
             fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    d_empty [shape=diamond, label="Запрос пустой?",
             fillcolor="#fff3e0", color="#e65100", penwidth=1.2]

    n_groq [label="Groq: извлечение фильтров\nget_vacancy_filters_from_text_async()\n(json_schema strict + allowed_values из БД)",
            fillcolor="#f3e5f5", color="#7b1fa2", penwidth=1.2]

    n_validate [label="Проверка ответа\n_validate_llm_payload()",
                fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    d_valid [shape=diamond, label="Ответ валиден?",
             fillcolor="#fff3e0", color="#e65100", penwidth=1.2]

    n_normalize [label="Нормализация role_keywords\nи weighted filters\n(_normalize_role_keywords,\n_normalize_weighted_filters)",
                 fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    n_counts [label="Подсчёт частот значений\nbuild_vacancy_filter_value_counts()",
              fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    n_relax [label="Релаксация фильтров\n_relax_filters()",
             fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    d_enough [shape=diamond, label="Кандидатов\nдостаточно?",
              fillcolor="#fff3e0", color="#e65100", penwidth=1.2]

    n_similarity [label="Векторный поиск\nsimilarity_search()\nPostgreSQL + pgvector",
                  fillcolor="#fff8e1", color="#f57f17", penwidth=1.2]

    n_boost [label="Domain boost\n_rank_with_domain_boost()\n(DOMAIN_BOOST_STEP)",
             fillcolor="#f3e5f5", color="#7b1fa2", penwidth=1.2]

    n_result [label="Итоговый UserSearchResult\n(filters + top-5 вакансий)",
              fillcolor="#e8f5e9", color="#2e7d32", penwidth=1.2]

    finish [shape=doublecircle, label="", width=0.32, height=0.32,
            fillcolor="#263238", color="#263238"]

    // ===== Узлы боковых веток =====
    n_empty_return [label="Вернуть пустой\nUserSearchResult",
                    fillcolor="#ffebee", color="#c62828", penwidth=1.2]

    n_error [label="RuntimeError:\nошибка валидации\nответа LLM",
             fillcolor="#ffebee", color="#c62828", penwidth=1.2]

    // Цикл релаксации
    n_drop_order [label="Порядок снятия по весу\nPROTECTED_RELAX_FILTER_KEYS\n(experience, employment)",
                  fillcolor="#fce4ec", color="#ad1457", penwidth=1.2]

    n_drop_one [label="Снять одно поле,\nобновить dropped_filters\nи relax_steps",
                fillcolor="#fce4ec", color="#ad1457", penwidth=1.2]

    n_recount [label="Повторно посчитать\ncandidate_count\n(_count_filtered_candidates)",
               fillcolor="#fce4ec", color="#ad1457", penwidth=1.2]

    // ===== Основной поток (слева направо) =====
    start        -> n_input
    n_input      -> n_entry
    n_entry      -> d_empty
    d_empty      -> n_groq        [label="нет"]
    n_groq       -> n_validate
    n_validate   -> d_valid
    d_valid      -> n_normalize   [label="да"]
    n_normalize  -> n_counts
    n_counts     -> n_relax
    n_relax      -> d_enough
    d_enough     -> n_similarity  [label="да"]
    n_similarity -> n_boost
    n_boost      -> n_result
    n_result     -> finish

    // ===== Боковые ветки =====
    // Пустой запрос — отводится в финиш
    d_empty        -> n_empty_return [label="да"]
    n_empty_return -> finish         [style=dashed, constraint=false]

    // Невалидный ответ LLM — отводится в финиш
    d_valid -> n_error  [label="нет"]
    n_error -> finish   [style=dashed, constraint=false]

    // ===== Цикл релаксации фильтров =====
    d_enough     -> n_drop_order  [label="нет"]
    n_drop_order -> n_drop_one
    n_drop_one   -> n_recount
    n_recount    -> d_enough      [label="повторить", style=dashed,
                                   color="#ad1457", fontcolor="#ad1457",
                                   constraint=false]
}}
""".strip()


def main() -> int:
    dot_src = build_dot_source()
    base = OUT_DIR / "user_search_flowchart_horizontal"

    for fmt, extra in (("png", ["-Gdpi=300"]), ("svg", [])):
        out_path = base.with_suffix(f".{fmt}")
        cmd = ["dot", f"-T{fmt}", *extra, "-o", str(out_path)]
        try:
            subprocess.run(
                cmd,
                input=dot_src.encode("utf-8"),
                check=True,
                capture_output=True,
            )
        except FileNotFoundError:
            print(
                "Не найден `dot`. Установите Graphviz: https://graphviz.org/download/",
                file=sys.stderr,
            )
            return 1
        except subprocess.CalledProcessError as e:
            print(e.stderr.decode("utf-8", errors="replace"), file=sys.stderr)
            return e.returncode
        print(f"OK: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
