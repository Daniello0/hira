#!/usr/bin/env python3
"""
Генерация блок-схемы LLM-интерпретатора для проекта ai-job-finder-python.

Акцент: один запрос к Groq; структура ответа задаётся через response_format
(json_schema) в теле API-запроса — в схеме не показываются ни retry, ни
отдельный этап «валидации после ответа».

Исходники логики: backend/src/features/llm/service.py,
backend/src/common/constants/llm.py.

Требуется установленный Graphviz (команда `dot` в PATH).
Запуск:
  python3 render_llm_interpreter_flowchart.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent
PROJECT_HINT = "ai-job-finder-python"


def build_dot_source() -> str:
    return rf"""
digraph llm_interpreter_{PROJECT_HINT.replace("-", "_")} {{
    graph [
        rankdir=TB
        bgcolor="white"
        fontname="Arial"
        fontsize=12
        dpi=300
        splines=true
        overlap=false
        nodesep=0.45
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

    n1 [label="Ввод (чат пользователя)\n«Ищу удалёнку на неполный день без опыта»",
        fillcolor="#e1f5fe", color="#01579b", penwidth=1.2]

    n2 [label="Задача LLM-интерпретатора:\nпреобразовать неструктурированный текст\nв формальные параметры для PostgreSQL / поиска",
        fillcolor="#e1f5fe", color="#01579b", penwidth=1.2]

    n3 [label="Groq API (OpenAI-совместимый)\nPOST …/openai/v1/chat/completions\nмодель: openai/gpt-oss-120b\n\nВ теле запроса: response_format\ntype = json_schema, strict = true\n→ ответ уже в форме JSON-объекта vacancy_filters",
        fillcolor="#f3e5f5", color="#7b1fa2", penwidth=1.2]

    n4 [label="Полученный JSON (message.content):\nполя payment_frequency, experience, employment,\nhiring_format, schedule, hours, work_format,\nrole_keywords",
        fillcolor="#fff9c4", color="#fbc02d", penwidth=1.2]

    n5 [label=<<TABLE BORDER="0" CELLBORDER="0" CELLPADDING="3"><TR><TD ALIGN="LEFT"><FONT FACE="Courier New" POINT-SIZE="10"><B>Output</B> (фрагмент)<BR ALIGN="LEFT"/>
{{
<BR ALIGN="LEFT"/>
&nbsp;&nbsp;"experience": [<BR ALIGN="LEFT"/>
&nbsp;&nbsp;&nbsp;&nbsp;{{"value": "Не требуется", "weight": 1.0}}<BR ALIGN="LEFT"/>
&nbsp;&nbsp;],<BR ALIGN="LEFT"/>
&nbsp;&nbsp;"work_format": [<BR ALIGN="LEFT"/>
&nbsp;&nbsp;&nbsp;&nbsp;{{"value": "Удалённо", "weight": 1.0}}<BR ALIGN="LEFT"/>
&nbsp;&nbsp;],<BR ALIGN="LEFT"/>
&nbsp;&nbsp;"schedule": [<BR ALIGN="LEFT"/>
&nbsp;&nbsp;&nbsp;&nbsp;{{"value": "Подработка", "weight": 0.9}}<BR ALIGN="LEFT"/>
&nbsp;&nbsp;],<BR ALIGN="LEFT"/>
&nbsp;&nbsp;"role_keywords": ["стажёр", "junior"]<BR ALIGN="LEFT"/>
&nbsp;&nbsp;… остальные поля …<BR ALIGN="LEFT"/>
}}<BR ALIGN="LEFT"/>
</FONT></TD></TR></TABLE>>,
        fillcolor="#e8f5e9", color="#2e7d32", penwidth=1.2]

    n1 -> n2
    n2 -> n3 [label="HTTP-запрос: messages (system + user)\n+ response_format: json_schema\n(system: шаблон + каталог value из БД)"]
    n3 -> n4 [label="Ответ API: message.content\n= готовый JSON под схему"]
    n4 -> n5 [label="Использование в поиске"]
}}
""".strip()


def main() -> int:
    dot_src = build_dot_source()
    base = OUT_DIR / "llm_interpreter_flowchart_ai_job_finder"

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
            print("Не найден `dot`. Установите Graphviz: https://graphviz.org/download/", file=sys.stderr)
            return 1
        except subprocess.CalledProcessError as e:
            print(e.stderr.decode("utf-8", errors="replace"), file=sys.stderr)
            return e.returncode
        print(f"OK: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
