# Graph Report - .  (2026-07-13)

## Corpus Check
- Corpus is ~4,433 words - fits in a single context window. You may not need a graph.

## Summary
- 36 nodes · 55 edges · 7 communities (6 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Хук главной страницы
- Заметки Linux
- Пайплайн публикации
- Структура сайта
- Windows DCOM и файлы
- Сети и VPN
- Инструкции Claude

## God Nodes (most connected - your core abstractions)
1. `MkDocs Material site configuration (RLUFE.KZ)` - 16 edges
2. `Homepage (terminal-styled knowledge base index)` - 8 edges
3. `on_files()` - 5 edges
4. `Linux Section Index` - 5 edges
5. `sysadmin-notes README` - 4 edges
6. `Asterisk queue agent diagnostics and management` - 4 edges
7. `DCOM setup for Microsoft Excel Application (1C)` - 4 edges
8. `_git_last_modified()` - 3 edges
9. `_first_paragraph()` - 3 edges
10. `Cloudflare Pages Deployment` - 3 edges

## Surprising Connections (you probably didn't know these)
- `sysadmin-notes README` --references--> `MkDocs Material site configuration (RLUFE.KZ)`  [EXTRACTED]
  README.md → mkdocs.yml
- `Note Authoring Workflow` --references--> `MkDocs Material site configuration (RLUFE.KZ)`  [EXTRACTED]
  README.md → mkdocs.yml
- `hooks/homepage_data.py MkDocs hook` --shares_data_with--> `Latest Notes Block ({{ LATEST_NOTES }} / {{ LATEST_NOTE_URL }} placeholders)`  [INFERRED]
  mkdocs.yml → docs/index.md
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Files and Utilities Section Index`  [EXTRACTED]
  mkdocs.yml → docs/notes/files/index.md
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Deferred one-time command execution in Linux with at`  [EXTRACTED]
  mkdocs.yml → docs/notes/linux/atUtility.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Latest Notes homepage pipeline (frontmatter -> hook -> homepage placeholders)** — docs_index_latest_notes_block, mkdocs_homepage_data_hook, readme_note_authoring_workflow, docs_notes_linux_atutility_at_deferred_execution, docs_notes_linux_example_note_deleted_open_files, docs_notes_network_dh_dh_group_mapping, docs_notes_windows_microsoftexcel_1c_dcom_excel_setup [INFERRED 0.85]
- **Notes aggregated by the Material tags plugin into the tags page** — docs_tags_tags_index, docs_notes_linux_atutility_at_deferred_execution, docs_notes_linux_example_note_deleted_open_files, docs_notes_network_dh_dh_group_mapping, docs_notes_windows_microsoftexcel_1c_dcom_excel_setup [INFERRED 0.95]
- **Site section index pages forming the knowledge base navigation** — docs_index_homepage, docs_notes_linux_index_linux_section, docs_notes_windows_index_windows_section, docs_notes_network_index_network_section, docs_notes_monitoring_index_monitoring_section, docs_notes_files_index_files_section, docs_tags_tags_index [EXTRACTED 1.00]

## Communities (7 total, 1 thin omitted)

### Community 0 - "Хук главной страницы"
Cohesion: 0.33
Nodes (7): _first_paragraph(), _frontmatter_date(), _git_last_modified(), on_files(), Собирает список последних заметок для главной страницы (docs/index.md).  В выбор, Первый обычный абзац заметки: без заголовков, кода и таблиц., Path

### Community 1 - "Заметки Linux"
Cohesion: 0.25
Nodes (8): Deferred one-time command execution in Linux with at, at / atd one-time job scheduler, Disk full but du finds no large files (deleted-but-open files), lsof +L1 diagnostics for deleted-but-open files, Linux Section Index, Asterisk queue agent diagnostics and management, SIP / PJSIP registration status check, state_interface hint for Asterisk agent state tracking

### Community 2 - "Пайплайн публикации"
Cohesion: 0.33
Nodes (7): Latest Notes Block ({{ LATEST_NOTES }} / {{ LATEST_NOTE_URL }} placeholders), hooks/homepage_data.py MkDocs hook, Strict build mode (strict: true), Cloudflare Pages Deployment, Note Authoring Workflow, sysadmin-notes README, Exactly pinned Python dependencies (pip freeze)

### Community 3 - "Структура сайта"
Cohesion: 0.70
Nodes (5): Homepage (terminal-styled knowledge base index), Monitoring Section Index (Zabbix, Prometheus, alerts), Windows and Software Section Index, Tags Index Page, MkDocs Material site configuration (RLUFE.KZ)

### Community 4 - "Windows DCOM и файлы"
Cohesion: 0.67
Nodes (3): Files and Utilities Section Index, DCOM setup for Microsoft Excel Application (1C), DCOM Launch/Activation and Access permissions for Excel automation

### Community 5 - "Сети и VPN"
Cohesion: 0.67
Nodes (3): Diffie-Hellman group mapping: MikroTik vs Juniper SSG, Diffie-Hellman group naming (Group N vs modpXXXX/ecpXXX), Network Section Index

## Knowledge Gaps
- **6 isolated node(s):** `CLAUDE.md graphify usage rules`, `at / atd one-time job scheduler`, `state_interface hint for Asterisk agent state tracking`, `SIP / PJSIP registration status check`, `Diffie-Hellman group naming (Group N vs modpXXXX/ecpXXX)` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MkDocs Material site configuration (RLUFE.KZ)` connect `Структура сайта` to `Заметки Linux`, `Пайплайн публикации`, `Windows DCOM и файлы`, `Сети и VPN`?**
  _High betweenness centrality (0.377) - this node is a cross-community bridge._
- **Why does `Asterisk queue agent diagnostics and management` connect `Заметки Linux` to `Структура сайта`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `sysadmin-notes README` connect `Пайплайн публикации` to `Структура сайта`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `CLAUDE.md graphify usage rules`, `at / atd one-time job scheduler`, `state_interface hint for Asterisk agent state tracking` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._