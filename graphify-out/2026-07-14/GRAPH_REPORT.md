# Graph Report - sysadmin-notes  (2026-07-14)

## Corpus Check
- 17 files · ~7,544 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 177 edges · 26 communities (13 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e28895bb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Хук главной страницы
- Заметки Linux
- Пайплайн публикации
- Структура сайта
- Windows DCOM и файлы
- Сети и VPN
- Инструкции Claude
- debugIpsec.md
- 29. Команды-шпаргалка
- Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG
- Windows Server 2016 определяет доменную сеть как Public
- Диагностика и управление агентами очереди Asterisk
- Настройка DCOM для Microsoft Excel Application (1С)
- Диск переполнен, а du не находит крупные файлы
- Отложенный запуск команды в Linux с помощью `at`
- Разбор параметров
- sysadmin-notes
- База знаний системного администратора
- CLAUDE.md
- index.md
- index.md
- tags.md
- lsof +L1 diagnostics for deleted-but-open files
- SIP / PJSIP registration status check
- state_interface hint for Asterisk agent state tracking
- Note Authoring Workflow

## God Nodes (most connected - your core abstractions)
1. `29. Команды-шпаргалка` - 16 edges
2. `MkDocs Material site configuration (RLUFE.KZ)` - 14 edges
3. `Windows Server 2016 определяет доменную сеть как Public` - 11 edges
4. `Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG` - 10 edges
5. `Настройка DCOM для Microsoft Excel Application (1С)` - 10 edges
6. `Диагностика и управление агентами очереди Asterisk` - 9 edges
7. `Отложенный запуск команды в Linux с помощью `at`` - 8 edges
8. `Разбор параметров` - 6 edges
9. `on_files()` - 5 edges
10. `sysadmin-notes` - 5 edges

## Surprising Connections (you probably didn't know these)
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Homepage (terminal-styled knowledge base index)`  [EXTRACTED]
  mkdocs.yml → docs/index.md
- `hooks/homepage_data.py MkDocs hook` --shares_data_with--> `Latest Notes Block ({{ LATEST_NOTES }} / {{ LATEST_NOTE_URL }} placeholders)`  [INFERRED]
  mkdocs.yml → docs/index.md
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Files and Utilities Section Index`  [EXTRACTED]
  mkdocs.yml → docs/notes/files/index.md
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Deferred one-time command execution in Linux with at`  [EXTRACTED]
  mkdocs.yml → docs/notes/linux/atUtility.md
- `MkDocs Material site configuration (RLUFE.KZ)` --references--> `Disk full but du finds no large files (deleted-but-open files)`  [EXTRACTED]
  mkdocs.yml → docs/notes/linux/example-note.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Latest Notes homepage pipeline (frontmatter -> hook -> homepage placeholders)** — docs_index_latest_notes_block, mkdocs_homepage_data_hook, readme_note_authoring_workflow, docs_notes_linux_atutility_at_deferred_execution, docs_notes_linux_example_note_deleted_open_files, docs_notes_network_dh_dh_group_mapping, docs_notes_windows_microsoftexcel_1c_dcom_excel_setup [INFERRED 0.85]
- **Notes aggregated by the Material tags plugin into the tags page** — docs_tags_tags_index, docs_notes_linux_atutility_at_deferred_execution, docs_notes_linux_example_note_deleted_open_files, docs_notes_network_dh_dh_group_mapping, docs_notes_windows_microsoftexcel_1c_dcom_excel_setup [INFERRED 0.95]
- **Site section index pages forming the knowledge base navigation** — docs_index_homepage, docs_notes_linux_index_linux_section, docs_notes_windows_index_windows_section, docs_notes_network_index_network_section, docs_notes_monitoring_index_monitoring_section, docs_notes_files_index_files_section, docs_tags_tags_index [EXTRACTED 1.00]

## Communities (26 total, 13 thin omitted)

### Community 0 - "Хук главной страницы"
Cohesion: 0.33
Nodes (7): _first_paragraph(), _frontmatter_date(), _git_last_modified(), on_files(), Собирает список последних заметок для главной страницы (docs/index.md).  В выбор, Первый обычный абзац заметки: без заголовков, кода и таблиц., Path

### Community 3 - "Структура сайта"
Cohesion: 0.12
Nodes (16): Homepage (terminal-styled knowledge base index), Latest Notes Block ({{ LATEST_NOTES }} / {{ LATEST_NOTE_URL }} placeholders), Files and Utilities Section Index, Deferred one-time command execution in Linux with at, Disk full but du finds no large files (deleted-but-open files), Linux Section Index, Asterisk queue agent diagnostics and management, Monitoring Section Index (Zabbix, Prometheus, alerts) (+8 more)

### Community 7 - "debugIpsec.md"
Cohesion: 0.06
Nodes (32): 10. Проверка IPsec Identity, 11. Проверка IPsec Profile, 12. Проверка IPsec Proposal, 13. Проверка IPsec Policy, 14. Проверка Active Peers, 15. Проверка Installed SA, 16. Принудительный запуск IPsec-туннеля, 17. Перезапуск IPsec SA (+24 more)

### Community 8 - "29. Команды-шпаргалка"
Cohesion: 0.12
Nodes (16): 29. Команды-шпаргалка, Включить IPsec Debug, Отключить IPsec Debug, Проверить Active Peers, Проверить Firewall, Проверить Identity, Проверить Installed SA, Проверить Logging (+8 more)

### Community 9 - "Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG"
Cohesion: 0.12
Nodes (14): PFS и Phase 2 в MikroTik, Phase 1 — IKE, Phase 2 — IPsec / PFS, Быстрая шпаргалка, Важное различие: Phase 1 и Phase 2, Где настраивается DH Group в Juniper SSG, Где настраивается DH Group в MikroTik, Итог (+6 more)

### Community 10 - "Windows Server 2016 определяет доменную сеть как Public"
Cohesion: 0.12
Nodes (13): Windows и ПО, заметки, Windows Server 2016 определяет доменную сеть как Public, Быстрое решение, Если проблема возникает после каждой перезагрузки, Итог, Краткое решение, Описание проблемы (+5 more)

### Community 11 - "Диагностика и управление агентами очереди Asterisk"
Cohesion: 0.13
Nodes (15): 1. Анализ статусов операторов, 2. Проверка сетевого статуса аппаратов SIP, 3. Как отключать агентов из очереди, 5. Проверка агента после добавления, 6.1. Проверка режима DND, 6.2. Проверка переадресации, 6.3. Принудительный тестовый звонок, 6. Что делать, если статус `Not in use`, но звонки не идут (+7 more)

### Community 12 - "Настройка DCOM для Microsoft Excel Application (1С)"
Cohesion: 0.17
Nodes (12): 1. Открытие служб компонентов, 2. Если Microsoft Excel Application отсутствует, 3. Настройка разрешений Launch and Activation, 4. Настройка Access Permissions, 5. Проверка каталогов Desktop, 6. Настройка прав на каталоги, Microsoft Excel Application отсутствует, Возможные проблемы (+4 more)

### Community 13 - "Диск переполнен, а du не находит крупные файлы"
Cohesion: 0.18
Nodes (7): Диск переполнен, а du не находит крупные файлы, Как избежать в будущем, Причина, Проблема, Решение, Linux, заметки

### Community 14 - "Отложенный запуск команды в Linux с помощью `at`"
Cohesion: 0.20
Nodes (10): RHEL / CentOS / Rocky Linux / AlmaLinux, Ubuntu / Debian, Важно, Выполнение команды через 4 часа, Другие примеры, Отложенный запуск команды в Linux с помощью `at`, Просмотр запланированных заданий, Просмотр команды задания (+2 more)

### Community 15 - "Разбор параметров"
Cohesion: 0.25
Nodes (8): 4. Как правильно переподключать агентов, `as 1219`, `Local/1219@from-queue/n`, `penalty 0`, `state_interface hint:1219@ext-local`, `to 131`, Разбор параметров, Эталонная команда

### Community 16 - "sysadmin-notes"
Cohesion: 0.25
Nodes (7): 1. Создать репозиторий на GitHub, 2. Подключить Cloudflare Pages, sysadmin-notes, Деплой на Cloudflare Pages, Как добавлять заметки, Локальный запуск, Структура заметок

### Community 17 - "База знаний системного администратора"
Cohesion: 0.40
Nodes (4): База знаний системного администратора, как-пополнять.txt, последние-заметки.log, разделы

## Knowledge Gaps
- **141 isolated node(s):** `graphify`, `Локальный запуск`, `1. Создать репозиторий на GitHub`, `2. Подключить Cloudflare Pages`, `Структура заметок` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `29. Команды-шпаргалка` connect `29. Команды-шпаргалка` to `debugIpsec.md`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `Диагностика и управление агентами очереди Asterisk` connect `Диагностика и управление агентами очереди Asterisk` to `Диск переполнен, а du не находит крупные файлы`, `Разбор параметров`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `graphify`, `Локальный запуск`, `1. Создать репозиторий на GitHub` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Структура сайта` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `debugIpsec.md` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `29. Команды-шпаргалка` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._