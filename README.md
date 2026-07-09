# sysadmin-notes

Сайт заметок сисадмина на MkDocs Material.

## Локальный запуск

```bash
pip install -r requirements.txt
mkdocs serve
```

Открыть http://127.0.0.1:8000

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
   - Build command: `pip install -r requirements.txt && mkdocs build`
   - Build output directory: `site`
4. Save and Deploy.

Cloudflare сам подберёт Python. Если сборка не найдёт Python — добавить в настройках переменную окружения `PYTHON_VERSION` = `3.12`.

После первого деплоя сайт будет доступен на `sysadmin-notes-xxx.pages.dev`. При каждом `git push` в `main` Cloudflare пересобирает сайт автоматически.

Свой домен подключается там же: Custom domains → Set up a domain.

## Как добавлять заметки

1. Создать `docs/notes/имя-заметки.md`.
2. Добавить строку в `nav` в `mkdocs.yml`:
   ```yaml
   nav:
     - Заметки:
         - notes/example-note.md
         - notes/имя-заметки.md
   ```
3. `git add . && git commit -m "новая заметка" && git push`
