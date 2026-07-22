# -*- coding: utf-8 -*-
"""Сборка GitHub Pages из templates/ + static/."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def build_docs() -> None:
    template = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    docs_html = (
        template.replace("{{ url_for('static', filename='css/app.css') }}", "static/css/app.css")
        .replace("{{ url_for('static', filename='js/app.js') }}", "static/js/app.js")
    )
    DOCS.mkdir(exist_ok=True)
    (DOCS / "index.html").write_text(docs_html, encoding="utf-8")

    docs_static = DOCS / "static"
    if docs_static.exists():
        shutil.rmtree(docs_static)
    shutil.copytree(ROOT / "static", docs_static)


if __name__ == "__main__":
    build_docs()
    print("Built docs/ from templates/ + static/")
