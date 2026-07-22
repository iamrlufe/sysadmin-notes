"""Собирает список последних заметок для главной страницы (docs/index.md).

В выборку попадает каждая заметка из docs/notes/ (кроме index.md разделов).
Описание берётся из поля `summary` во front matter, а если его нет — из
первого абзаца заметки, так что заметка без front matter всё равно появится
на главной.

Порядок "последних" определяется (по убыванию приоритета):
1. полем `date` во front matter (надёжно при любом способе сборки);
2. датой первого git-коммита, добавившего файл (дата публикации, а не
   последующих правок — иначе исправление опечатки поднимало бы старую
   заметку в "последние");
3. mtime файла (например, при сборке вне репозитория или из shallow-клона
   даты git могут быть недоступны/одинаковы).

Та же дата подставляется в списки заметок на страницах разделов
(`docs/notes/*/index.md`) — атрибутом `data-date` у ссылки, который
рисует CSS в стиле вывода `ls -la` (см. `extra.css`).
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
SECTION_INDEX_RE = re.compile(r"^notes/([^/]+)/index\.md$")
NOTE_LINK_RE = re.compile(r"(\[[^\]]+\]\()([^)\s]+\.md)(\))")


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


def _git_first_commit_dates(repo_root: Path) -> dict[str, float]:
    """Дата первого коммита для каждого файла репозитория (создание, не правки).

    Один проход по всей истории вместо отдельного `git log` на каждую
    заметку — так и быстрее, и не зависит от переименований/`--follow`
    для каждого файла по отдельности.
    """
    try:
        result = subprocess.run(
            ["git", "log", "--reverse", "--name-status", "--format=\x01%ct"],
            capture_output=True,
            text=True,
            cwd=repo_root,
            timeout=20,
            check=True,
        )
    except (subprocess.SubprocessError, OSError):
        return {}

    dates: dict[str, float] = {}
    commit_ts: float | None = None
    for line in result.stdout.splitlines():
        if line.startswith("\x01"):
            commit_ts = float(line[1:])
            continue
        if not line or commit_ts is None:
            continue
        path = line.split("\t")[-1]
        dates.setdefault(path, commit_ts)
    return dates


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
    repo_root = Path(config["docs_dir"]).parent
    first_commit_dates = _git_first_commit_dates(repo_root)

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
        git_path = f"{Path(config['docs_dir']).name}/{file.src_uri}"
        mtime = (
            _frontmatter_date(data.get("date"))
            or first_commit_dates.get(git_path)
            or src_path.stat().st_mtime
        )

        notes.append(
            {
                "title": title,
                "summary": summary,
                "section_label": section_label,
                "url": file.url,
                "src_uri": file.src_uri,
                "mtime": mtime,
            }
        )

    notes.sort(key=lambda note: note["mtime"], reverse=True)
    config["rlufe_latest_notes"] = notes[:LATEST_COUNT]
    config["rlufe_note_dates"] = {note["src_uri"]: note["mtime"] for note in notes}

    return files


def _inject_section_note_dates(markdown: str, section: str, config) -> str:
    """Проставляет `{: data-date="..." }` каждой ссылке на заметку в списке раздела.

    Дата рисуется CSS-ом (`content: "-rw-r--r--  " attr(data-date)` в
    extra.css) — здесь только данные, разметку список заметок сохраняет
    свою обычную markdown-форму `- [Название](файл.md)`.
    """
    note_dates = config.get("rlufe_note_dates", {})

    def _add_date(match: re.Match) -> str:
        link_target = match.group(2)
        if link_target == "index.md" or link_target.startswith(("http:", "https:")):
            return match.group(0)
        note_src_uri = f"notes/{section}/{link_target}"
        mtime = note_dates.get(note_src_uri)
        if mtime is None:
            return match.group(0)
        date_str = datetime.date.fromtimestamp(mtime).isoformat()
        return f'{match.group(1)}{link_target}{match.group(3)}{{: data-date="{date_str}" }}'

    return NOTE_LINK_RE.sub(_add_date, markdown)


def on_page_markdown(markdown, page, config, files):
    section_match = SECTION_INDEX_RE.match(page.file.src_uri)
    if section_match:
        return _inject_section_note_dates(markdown, section_match.group(1), config)

    if page.file.src_uri != "index.md":
        return markdown

    latest_notes = config.get("rlufe_latest_notes", [])
    latest_url = html.escape(latest_notes[0]["url"], quote=True) if latest_notes else "#sections"
    markdown = markdown.replace("{{ LATEST_NOTE_URL }}", latest_url)

    latest_html = "\n\n".join(
        '<a href="{url}" markdown>\n'
        "<time>{date}</time>\n"
        "<span>{section_label}</span>\n"
        "<strong>{title}</strong>\n"
        "<em>{summary}</em>\n"
        "</a>".format(
            url=html.escape(note["url"], quote=True),
            date=datetime.date.fromtimestamp(note["mtime"]).isoformat(),
            section_label=html.escape(note["section_label"]),
            title=html.escape(note["title"]),
            summary=html.escape(note["summary"]),
        )
        for note in latest_notes
    )
    markdown = markdown.replace("{{ LATEST_NOTES }}", latest_html)

    return markdown
