# Graph Report - sysadmin-notes  (2026-07-23)

## Corpus Check
- 28 files · ~19,371 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 318 nodes · 300 edges · 33 communities (21 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9c0bfff3`
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
- Как это устроено
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
- Инструкция: включение отладки и смена пути каталога `srvinfo` сервера 1С:Предприятие
- Назначение прав глобального администратора в Zimbra 8.8.12 (CLI)
- Сброс и уменьшение размера tempdb в MS SQL Server
- Автозагрузка программы на Windows Server (2016–2025)

## God Nodes (most connected - your core abstractions)
1. `Диагностика и отладка IPsec в MikroTik RouterOS` - 33 edges
2. `29. Команды-шпаргалка` - 16 edges
3. `MkDocs Material site configuration (RLUFE.KZ)` - 14 edges
4. `Принцип работы` - 12 edges
5. `Назначение прав глобального администратора в Zimbra 8.8.12 (CLI)` - 11 edges
6. `Windows Server 2016 определяет доменную сеть как Public` - 11 edges
7. `Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG` - 10 edges
8. `Настройка DCOM для Microsoft Excel Application (1С)` - 10 edges
9. `Диагностика и управление агентами очереди Asterisk` - 9 edges
10. `Отложенный запуск команды в Linux с помощью `at`` - 8 edges

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

## Communities (33 total, 12 thin omitted)

### Community 0 - "Хук главной страницы"
Cohesion: 0.22
Nodes (12): _first_paragraph(), _frontmatter_date(), _git_first_commit_dates(), _inject_section_note_dates(), on_files(), on_page_markdown(), Собирает список последних заметок для главной страницы (docs/index.md).  В выбор, Первый обычный абзац заметки: без заголовков, кода и таблиц. (+4 more)

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
Cohesion: 0.08
Nodes (22): PFS и Phase 2 в MikroTik, Phase 1 — IKE, Phase 2 — IPsec / PFS, Быстрая шпаргалка, Важное различие: Phase 1 и Phase 2, Где настраивается DH Group в Juniper SSG, Где настраивается DH Group в MikroTik, Итог (+14 more)

### Community 10 - "Windows Server 2016 определяет доменную сеть как Public"
Cohesion: 0.12
Nodes (13): Windows и ПО, заметки, Windows Server 2016 определяет доменную сеть как Public, Быстрое решение, Если проблема возникает после каждой перезагрузки, Итог, Краткое решение, Описание проблемы (+5 more)

### Community 11 - "Диагностика и управление агентами очереди Asterisk"
Cohesion: 0.09
Nodes (23): 1. Анализ статусов операторов, 2. Проверка сетевого статуса аппаратов SIP, 3. Как отключать агентов из очереди, 4. Как правильно переподключать агентов, 5. Проверка агента после добавления, 6.1. Проверка режима DND, 6.2. Проверка переадресации, 6.3. Принудительный тестовый звонок (+15 more)

### Community 12 - "Настройка DCOM для Microsoft Excel Application (1С)"
Cohesion: 0.17
Nodes (12): 1. Открытие служб компонентов, 2. Если Microsoft Excel Application отсутствует, 3. Настройка разрешений Launch and Activation, 4. Настройка Access Permissions, 5. Проверка каталогов Desktop, 6. Настройка прав на каталоги, Microsoft Excel Application отсутствует, Возможные проблемы (+4 more)

### Community 13 - "Диск переполнен, а du не находит крупные файлы"
Cohesion: 0.09
Nodes (17): RHEL / CentOS / Rocky Linux / AlmaLinux, Ubuntu / Debian, Важно, Выполнение команды через 4 часа, Другие примеры, Отложенный запуск команды в Linux с помощью `at`, Просмотр запланированных заданий, Просмотр команды задания (+9 more)

### Community 14 - "Отложенный запуск команды в Linux с помощью `at`"
Cohesion: 0.12
Nodes (17): 10. Обработка ошибок, 11. Итоги, 1. Предохранитель на входе, 2. Список файлов и фильтрация, 3. Определение действия для каждой базы, 4. Проверки, блокирующие restore, 5. Состав бэкапа и целевые пути файлов, 6. Проверка коллизий (+9 more)

### Community 15 - "Как это устроено"
Cohesion: 0.13
Nodes (14): upload_common.cmd, upload_diff.cmd, upload_full.cmd, Выгрузка бэкапов SQL Server на FTP через WinSCP (FULL/DIFF), Защита от аплоада недописанного файла, Как использовать, Как это устроено, Ожидаемая структура каталогов (+6 more)

### Community 16 - "sysadmin-notes"
Cohesion: 0.25
Nodes (7): 1. Создать репозиторий на GitHub, 2. Подключить Cloudflare Pages, sysadmin-notes, Деплой на Cloudflare Pages, Как добавлять заметки, Локальный запуск, Структура заметок

### Community 17 - "База знаний системного администратора"
Cohesion: 0.40
Nodes (4): База знаний системного администратора, как-пополнять.txt, последние-заметки.log, разделы

### Community 19 - "index.md"
Cohesion: 0.12
Nodes (13): заметки, Файлы и утилиты, 1. Получение списка файлов, 2. Пропуск существующих баз, 3. Разбор состава backup-файла, 4. Генерация MOVE для каждого файла, 5. Два режима: отчёт и выполнение, 6. Проверка свободного места (+5 more)

### Community 27 - "Инструкция: включение отладки и смена пути каталога `srvinfo` сервера 1С:Предприятие"
Cohesion: 0.08
Nodes (24): 1. Включение серверной отладки, 2. Перенос каталога `srvinfo`, Было, Быстрая памятка, Возможные проблемы, Инструкция: включение отладки и смена пути каталога `srvinfo` сервера 1С:Предприятие, Кластер не отображается, Назначение (+16 more)

### Community 28 - "Назначение прав глобального администратора в Zimbra 8.8.12 (CLI)"
Cohesion: 0.14
Nodes (14): Версия, Возможные ошибки, Вход в административную панель, Итог, Команда не найдена, Назначение прав глобального администратора в Zimbra 8.8.12 (CLI), Назначение существующего пользователя глобальным администратором, Не открывается консоль администратора (+6 more)

### Community 29 - "Сброс и уменьшение размера tempdb в MS SQL Server"
Cohesion: 0.17
Nodes (11): Авторасширение (Auto-Growth), Диагностика: как найти «виновника» разрастания, Несколько файлов данных tempdb, Особенности и подводные камни, Сброс и уменьшение размера tempdb в MS SQL Server, Способ 1. Перезапуск службы SQL Server (самый надёжный), Способ 2. Уменьшение размера «на лету» (без перезапуска), Способ 3. Изменение начального (исходного) размера (+3 more)

### Community 32 - "Автозагрузка программы на Windows Server (2016–2025)"
Cohesion: 0.22
Nodes (8): Автозагрузка программы на Windows Server (2016–2025), Какой способ выбрать, Особенности и подводные камни, Способ 1. Папка «Автозагрузка» (запуск при входе пользователя), Способ 2. Планировщик заданий (рекомендуется для серверов), Способ 3. Превращение программы в службу Windows, Через NSSM (Non-Sucking Service Manager), Через встроенную утилиту `sc`

## Knowledge Gaps
- **226 isolated node(s):** `graphify`, `Локальный запуск`, `1. Создать репозиторий на GitHub`, `2. Подключить Cloudflare Pages`, `Структура заметок` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Диагностика и отладка IPsec в MikroTik RouterOS` connect `debugIpsec.md` to `29. Команды-шпаргалка`, `Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `Инструкция: включение отладки и смена пути каталога `srvinfo` сервера 1С:Предприятие` connect `Инструкция: включение отладки и смена пути каталога `srvinfo` сервера 1С:Предприятие` to `Windows Server 2016 определяет доменную сеть как Public`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `Диагностика и управление агентами очереди Asterisk` connect `Диагностика и управление агентами очереди Asterisk` to `Диск переполнен, а du не находит крупные файлы`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `graphify`, `Локальный запуск`, `1. Создать репозиторий на GitHub` to the rest of the system?**
  _226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Структура сайта` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `debugIpsec.md` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `29. Команды-шпаргалка` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._