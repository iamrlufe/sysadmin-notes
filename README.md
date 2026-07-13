# sysadmin-notes

Сайт заметок сисадмина на MkDocs Material.

## Локальный запуск

```bash
pip install -r requirements.txt
mkdocs serve
```

Открыть http://127.0.0.1:8000

Проверка перед пушем (та же строгая сборка, что и на Cloudflare):

```bash
mkdocs build --strict
```

## Деплой на Cloudflare Pages

### 1. Создать репозиторий на GitHub

1. Зайти на github.com → New repository → назвать `sysadmin-notes` → Create.
2. В папке проекта:

```bash
cd sysadmin-notes
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/USERNAME/sysadmin-notes.git
git push -u origin main
```

Заменить `USERNAME` на свой логин. В `mkdocs.yml` тоже поправить `repo_url` и `repo_name` на свой логин.

### 2. Подключить Cloudflare Pages

1. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Выбрать репозиторий `sysadmin-notes`.
3. Настройки сборки:
   - Framework preset: None
   - Build command: `pip install -r requirements.txt && mkdocs build --strict`
   - Build output directory: `site`
4. Save and Deploy.

Cloudflare сам подберёт Python. Если сборка не найдёт Python — добавить в настройках переменную окружения `PYTHON_VERSION` = `3.12`.

После первого деплоя сайт будет доступен на `sysadmin-notes-xxx.pages.dev`. При каждом `git push` в `main` Cloudflare пересобирает сайт автоматически.

Свой домен подключается там же: Custom domains → Set up a domain.

## Структура заметок

Заметки лежат по разделам в `docs/notes/`:

```text
docs/
├── index.md                 # главная
├── tags.md                  # индекс тегов
└── notes/
    ├── linux/               # Linux
    ├── windows/             # Windows и ПО
    ├── network/             # Сети
    ├── monitoring/          # Мониторинг
    └── files/               # приложенные файлы и утилиты
```

В каждом разделе есть `index.md` — страница раздела со списком заметок.

## Как добавлять заметки

1. Создать файл в нужном разделе, например `docs/notes/linux/имя-заметки.md`.
2. В начале файла указать теги (и по желанию описание для главной):
   ```yaml
   ---
   tags:
     - Linux
     - Диски
   summary: Краткое описание для блока «Последние заметки» на главной.
   section_label: Linux
   date: 2026-07-13
   ---
   ```
   Все поля необязательные: без `summary` описание возьмётся из первого абзаца,
   без `section_label` — из названия раздела, без `date` — из даты последнего
   git-коммита файла. Заметка появится в «Последних заметках» автоматически.
3. Добавить файл в `nav` в `mkdocs.yml` в соответствующий раздел:
   ```yaml
   nav:
     - Linux:
         - notes/linux/index.md
         - notes/linux/example-note.md
         - notes/linux/имя-заметки.md
   ```
4. Добавить ссылку на заметку в `index.md` раздела.
5. `git add . && git commit -m "новая заметка" && git push`

Сборка идёт со `strict: true` — битая ссылка или файл, не попавший в `nav`, уронят деплой. Перед пушем можно проверить локально: `mkdocs build --strict`.
