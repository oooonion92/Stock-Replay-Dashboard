#!/usr/bin/env python3
"""Build a single-file dashboard preview for environments that open HTML alone.

The production Pages site intentionally keeps CSS and data in separate static
files. Some file viewers only open index.html and therefore render unstyled
text. This tool bundles the same assets into dashboard_preview.html without
altering the production entry point.
"""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dashboard_preview.html"


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def inline_script(text: str) -> str:
    return text.replace("</script", "<\\/script")


def main() -> None:
    html = read("index.html")
    styles = "\n".join(read(name) for name in ["styles.css", "overrides.css", "expert-groups.css"])
    app = read("app.js")
    app = app.replace('  const sheet=document.createElement("link");sheet.rel="stylesheet";sheet.href="overrides.css";document.head.appendChild(sheet);\n', "")
    app = app.replace('  const groupSheet=document.createElement("link");groupSheet.rel="stylesheet";groupSheet.href="expert-groups.css";document.head.appendChild(groupSheet);\n', "")
    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>{styles}</style>")
    html = html.replace('<script src="data.js"></script>', f"<script>{inline_script(read('data.js'))}</script>")
    html = html.replace('<script src="short-term-data.js"></script>', f"<script>{inline_script(read('short-term-data.js'))}</script>")
    html = html.replace('<script src="app.js"></script>', f"<script>{inline_script(app)}</script>")
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"built {OUTPUT}")


if __name__ == "__main__":
    main()
