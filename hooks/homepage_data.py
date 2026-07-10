"""Собирает данные для главной страницы (docs/index.md), чтобы счётчики
и список последних заметок не приходилось дублировать вручную.

Заметка попадает в выборку, если в её front matter указано поле `summary`.
Порядок "последних" определяется датой последнего git-коммита файла
(с откатом на mtime, если git недоступен — например, при сборке вне репозитория).
"""

import re
import subprocess
from pathlib import Path

from mkdocs.utils import meta

LATEST_COUNT = 2
TITLE_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def _last_modified(path: Path) -> float:
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
    return path.stat().st_mtime


def on_files(files, config):
    notes = []
    section_dirs = set()

    for file in files.documentation_pages():
        parts = Path(file.src_uri).parts
        if len(parts) < 2 or parts[0] != "notes":
            continue
        section_dirs.add(parts[1])

        if parts[-1] == "index.md":
            continue

        raw = Path(file.abs_src_path).read_text(encoding="utf-8")
        content, data = meta.get_data(raw)
        summary = data.get("summary")
        if not summary:
            continue

        title_match = TITLE_RE.search(content)
        notes.append(
            {
                "title": data.get("title") or (title_match.group(1) if title_match else file.src_uri),
                "summary": summary,
                "section_label": data.get("section_label", ""),
                "url": file.url,
                "mtime": _last_modified(Path(file.abs_src_path)),
            }
        )

    notes.sort(key=lambda note: note["mtime"], reverse=True)

    config["rlufe_sections_count"] = len(section_dirs)
    config["rlufe_notes_count"] = len(notes)
    config["rlufe_latest_notes"] = notes[:LATEST_COUNT]

    return files


def on_page_markdown(markdown, page, config, files):
    if page.file.src_uri != "index.md":
        return markdown

    markdown = markdown.replace("{{ SECTIONS_COUNT }}", str(config.get("rlufe_sections_count", 0)))
    markdown = markdown.replace("{{ NOTES_COUNT }}", str(config.get("rlufe_notes_count", 0)))

    latest_notes = config.get("rlufe_latest_notes", [])
    latest_url = latest_notes[0]["url"] if latest_notes else "#sections"
    markdown = markdown.replace("{{ LATEST_NOTE_URL }}", latest_url)
    latest_html = "\n\n".join(
        '<a href="{url}" markdown>\n'
        "<span>{section_label}</span>\n"
        "<strong>{title}</strong>\n"
        "<em>{summary}</em>\n"
        "</a>".format(**note)
        for note in latest_notes
    )
    markdown = markdown.replace("{{ LATEST_NOTES }}", latest_html)

    return markdown
