"""Собирает список последних заметок для главной страницы (docs/index.md).

В выборку попадает каждая заметка из docs/notes/ (кроме index.md разделов).
Описание берётся из поля `summary` во front matter, а если его нет — из
первого абзаца заметки, так что заметка без front matter всё равно появится
на главной.

Порядок "последних" определяется (по убыванию приоритета):
1. полем `date` во front matter (надёжно при любом способе сборки);
2. датой последнего git-коммита файла;
3. mtime файла (например, при сборке вне репозитория или из shallow-клона
   даты git могут быть недоступны/одинаковы).
"""

import datetime
import html
import re
import subprocess
from pathlib import Path

from mkdocs.utils import meta

LATEST_COUNT = 3
SUMMARY_MAX_LEN = 180

# Подписи разделов для заметок без section_label во front matter.
SECTION_LABELS = {
    "linux": "Linux",
    "windows": "Windows и ПО",
    "network": "Сети",
    "monitoring": "Мониторинг",
    "files": "Файлы и утилиты",
}

TITLE_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
FENCE_RE = re.compile(r"^(```|~~~)")
MD_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
MD_MARKUP_RE = re.compile(r"[*_`]+")


def _frontmatter_date(value) -> float | None:
    if isinstance(value, datetime.datetime):
        return value.timestamp()
    if isinstance(value, datetime.date):
        return datetime.datetime.combine(value, datetime.time()).timestamp()
    if isinstance(value, str):
        try:
            return datetime.datetime.fromisoformat(value).timestamp()
        except ValueError:
            return None
    return None


def _git_last_modified(path: Path) -> float | None:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", path.name],
            capture_output=True,
            text=True,
            cwd=path.parent,
            timeout=5,
            check=True,
        )
        timestamp = result.stdout.strip()
        if timestamp:
            return float(timestamp)
    except (subprocess.SubprocessError, OSError, ValueError):
        pass
    return None


def _first_paragraph(content: str) -> str:
    """Первый обычный абзац заметки: без заголовков, кода и таблиц."""
    lines = []
    in_fence = False
    for line in content.splitlines():
        if FENCE_RE.match(line.strip()):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        stripped = line.strip()
        if not stripped:
            if lines:
                break
            continue
        if stripped.startswith(("#", ">", "|", "---")):
            if lines:
                break
            continue
        lines.append(stripped)

    text = " ".join(lines)
    text = MD_LINK_RE.sub(r"\1", text)
    text = MD_MARKUP_RE.sub("", text)
    if len(text) > SUMMARY_MAX_LEN:
        text = text[: SUMMARY_MAX_LEN].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return text


def on_files(files, config):
    notes = []

    for file in files.documentation_pages():
        parts = Path(file.src_uri).parts
        if len(parts) < 3 or parts[0] != "notes" or parts[-1] == "index.md":
            continue

        raw = Path(file.abs_src_path).read_text(encoding="utf-8")
        content, data = meta.get_data(raw)

        title_match = TITLE_RE.search(content)
        title = data.get("title") or (title_match.group(1) if title_match else file.src_uri)
        summary = data.get("summary") or _first_paragraph(content)
        section_label = data.get("section_label") or SECTION_LABELS.get(parts[1], parts[1].title())

        src_path = Path(file.abs_src_path)
        mtime = (
            _frontmatter_date(data.get("date"))
            or _git_last_modified(src_path)
            or src_path.stat().st_mtime
        )

        notes.append(
            {
                "title": title,
                "summary": summary,
                "section_label": section_label,
                "url": file.url,
                "mtime": mtime,
            }
        )

    notes.sort(key=lambda note: note["mtime"], reverse=True)
    config["rlufe_latest_notes"] = notes[:LATEST_COUNT]

    return files


def on_page_markdown(markdown, page, config, files):
    if page.file.src_uri != "index.md":
        return markdown

    latest_notes = config.get("rlufe_latest_notes", [])
    latest_url = html.escape(latest_notes[0]["url"], quote=True) if latest_notes else "#sections"
    markdown = markdown.replace("{{ LATEST_NOTE_URL }}", latest_url)

    latest_html = "\n\n".join(
        '<a href="{url}" markdown>\n'
        "<span>{section_label}</span>\n"
        "<strong>{title}</strong>\n"
        "<em>{summary}</em>\n"
        "</a>".format(
            url=html.escape(note["url"], quote=True),
            section_label=html.escape(note["section_label"]),
            title=html.escape(note["title"]),
            summary=html.escape(note["summary"]),
        )
        for note in latest_notes
    )
    markdown = markdown.replace("{{ LATEST_NOTES }}", latest_html)

    return markdown
