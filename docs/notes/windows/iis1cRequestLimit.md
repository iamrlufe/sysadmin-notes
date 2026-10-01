---
title: Ошибка 413 на публикации 1С в IIS — увеличение лимита размера запроса
tags:
  - 1C
  - IIS
  - Windows Server
summary: "Большие POST-запросы к HTTP-сервису 1С на IIS получают 413 за миллисекунды: лимит Request Filtering maxAllowedContentLength (~28,6 МБ по умолчанию). Диагностика по логам IIS и HTTP.sys, увеличение лимита через appcmd /commit:apphost, проверка, откат и трассировка FREB."
---

# Ошибка 413 на публикации 1С в IIS — увеличение лимита размера запроса

## Симптомы

POST-запрос с большим телом на публикацию 1С (например, к HTTP-сервису
`/mybase/hs/exchange/upload/`) получает ответ **413**, а небольшие
запросы проходят. Признаки:

- в логе IIS строка вида `POST /mybase/hs/... 80 - <IP> ... - 413 1 0 10`,
  то есть `sc-status = 413`, `sc-substatus = 1`;
- время ответа (`time-taken`) всего 10–100 мс: запрос отбивается сразу,
  до чтения тела;
- до 1С запрос не доходит, в журнале регистрации базы его нет;
- работа идёт по HTTP (порт 80), клиентские SSL-сертификаты не
  используются.

Во всех примерах `mybase` — имя публикации, `Default Web Site` — сайт
IIS. Подставь свои.

## Причина

Модуль Request Filtering в IIS ограничивает размер тела запроса
параметром `maxAllowedContentLength`. Если он нигде не задан, действует
значение по умолчанию: **30 000 000 байт (примерно 28,6 МБ)**.

Модуль сравнивает заголовок `Content-Length` с лимитом и отказывает
сразу — поэтому ответ приходит за миллисекунды. Публикация 1С работает
через ISAPI-модуль `wsisapi.dll`, а не через ASP.NET, поэтому
`httpRuntime maxRequestLength` на неё не влияет.

!!! note "404.13 или 413.1"

    Классически превышение этого лимита даёт в логе `404 13`. В описанном
    случае в логе было `413 1`, и причина такого подстатуса не выяснена —
    но увеличение `maxAllowedContentLength` проблему решило. Если сомнения
    остаются, точный модуль-виновник покажет трассировка (см. раздел
    [«Если не помогло»](#esli-ne-pomoglo)).

## Диагностика

Все команды — в PowerShell, запущенном от администратора. Для краткости
дальше используются две переменные — задай их один раз в начале сессии:

```powershell
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$app    = "Default Web Site/mybase"   # сайт/публикация
```

1. Найти актуальные логи IIS:

    ```powershell
    Get-ChildItem C:\inetpub\logs\LogFiles\ -Recurse -Filter *.log |
        Sort-Object LastWriteTime | Select-Object -Last 3 FullName, LastWriteTime
    ```

2. Найти ответы 413 именно в поле статуса (после статуса идут ещё три
   числа: substatus, win32-status, time-taken):

    ```powershell
    Select-String -Path C:\inetpub\logs\LogFiles\W3SVC*\*.log -Pattern ' 413 \d+ \d+ \d+$'
    ```

3. Если в логе IIS пусто — проверить лог HTTP.sys (отказы до IIS):

    ```powershell
    Select-String -Path C:\Windows\System32\LogFiles\HTTPERR\*.log -Pattern '413'
    ```

4. Посмотреть текущий лимит для публикации. Пустой `<requestLimits>` без
   `maxAllowedContentLength` означает значение по умолчанию (~28,6 МБ):

    ```powershell
    & $appcmd list config $app -section:system.webServer/security/requestFiltering |
        Select-String maxAllowed
    ```

5. Проверить, не задан ли лимит выше по иерархии:

    ```powershell
    Get-Content C:\inetpub\wwwroot\web.config -ErrorAction SilentlyContinue
    Select-String -Path "$env:windir\system32\inetsrv\config\applicationHost.config" `
        -Pattern 'maxAllowedContentLength|uploadReadAheadSize|requestLimits'
    ```

## Увеличение лимита

Перед правками сделать резервную копию конфигурации IIS:

```powershell
& $appcmd add backup "before-413-fix"
```

### Способ 1. appcmd (рекомендуется)

Настройка с ключом `/commit:apphost` ложится в `applicationHost.config`
блоком `<location>` и **не слетает при переопубликации базы**.
Применяется сразу, перезапуск IIS не нужен. Число — нужный лимит в
байтах (таблица ниже):

```powershell
& $appcmd set config $app -section:system.webServer/security/requestFiltering `
    /requestLimits.maxAllowedContentLength:524288000 /commit:apphost
```

Ожидаемый ответ: «Изменения конфигурации применены к разделу ... на пути
применения конфигурации MACHINE/WEBROOT/APPHOST».

Если работаешь в cmd, а не в PowerShell, команда пишется без переменных:

```bat
%windir%\system32\inetsrv\appcmd.exe set config "Default Web Site/mybase" -section:system.webServer/security/requestFiltering /requestLimits.maxAllowedContentLength:524288000 /commit:apphost
```

### Способ 2. Диспетчер IIS

1. Открыть Диспетчер IIS, слева выбрать сайт, затем публикацию.
2. Открыть «Фильтрация запросов» (Request Filtering).
3. Справа нажать «Изменить параметры функции…».
4. В поле «Максимальная допустимая длина содержимого (байт)» ввести
   значение из таблицы и нажать ОК.

!!! warning "Настройка может пропасть"

    Так настройка записывается в `web.config` публикации и может
    пропасть при повторной публикации через `webinst` или конфигуратор.
    Поэтому предпочтителен способ 1.

### Таблица значений

| Лимит | Значение, байт |
|---|---|
| По умолчанию (~28,6 МБ) | `30000000` |
| 100 МБ | `104857600` |
| 500 МБ | `524288000` |
| 1 ГБ | `1073741824` |
| 2 ГБ | `2147483648` |
| Максимум (~4 ГБ) | `4294967295` |

Ставь с запасом к реальному размеру выгрузок, но без фанатизма: слишком
большой лимит ослабляет защиту от засорения сервера огромными запросами.

## Проверка результата

1. Убедиться, что значение записалось:

    ```powershell
    & $appcmd list config $app -section:system.webServer/security/requestFiltering |
        Select-String maxAllowed
    ```

    Ожидаемый вывод: `<requestLimits maxAllowedContentLength="524288000">`.

2. Запустить просмотр лога в реальном времени с фильтром по HTTP-сервису
   (выход — Ctrl+C). `W3SVC1` — папка логов сайта с ID 1, для другого
   сайта номер будет другим:

    ```powershell
    $log = (Get-ChildItem C:\inetpub\logs\LogFiles\W3SVC1\*.log |
            Sort-Object LastWriteTime | Select-Object -Last 1).FullName
    Get-Content $log -Tail 5 -Wait | Select-String "hs/exchange"
    ```

3. Отправить запрос с большим телом (например, из Postman).
4. IIS пишет лог с задержкой (буфер сбрасывается примерно раз в минуту).
   Чтобы увидеть строку сразу, в соседнем окне выполнить:

    ```powershell
    netsh http flush logbuffer
    ```

Как читать результат:

| Код в логе | Что значит |
|---|---|
| `200` | Лимит был причиной, проблема решена |
| `413 1` | Лимит задан ещё где-то, нужна трассировка |
| `500` или долгий `time-taken` | Запрос дошёл до 1С, разбираться со стороны 1С |

## Откат

Вернуть стандартный лимит той же командой:

```powershell
& $appcmd set config $app -section:system.webServer/security/requestFiltering `
    /requestLimits.maxAllowedContentLength:30000000 /commit:apphost
```

Или восстановить всю конфигурацию IIS из резервной копии:

```powershell
& $appcmd restore backup "before-413-fix"
```

## Если не помогло { #esli-ne-pomoglo }

Если после увеличения лимита 413 остался, включить трассировку
неудачных запросов (FREB) — она покажет, какой модуль IIS выставил
ошибку.

1. В Диспетчере IIS выбрать сайт и справа нажать «Трассировка неудачных
   запросов…», включить её.
2. Выбрать публикацию, открыть «Правила трассировки неудачных запросов»
   и добавить правило: «Все содержимое», код состояния `413`, остальное
   по умолчанию.
3. Повторить запрос.
4. Открыть файл `C:\inetpub\logs\FailedReqLogFiles\W3SVC1\fr*.xml` в
   браузере (рядом должен лежать `freb.xsl`).
5. Найти событие `MODULE_SET_RESPONSE_ERROR_STATUS` — поле `ModuleName`
   в нём и есть виновник.
6. После диагностики трассировку выключить, чтобы не копить файлы.

Что ещё может ограничивать размер запроса:

- **Прокси перед IIS** (nginx, Cloudflare, reverse proxy и т.п.) со
  своим лимитом. Признак: в логе IIS запроса нет вообще.
- **Клиентские SSL-сертификаты на HTTPS** — тогда влияет
  `uploadReadAheadSize` (см. ниже).
- **Таймауты** при долгой передаче больших файлов. Это уже не 413, а
  обрыв или 500.
- **Ограничения внутри самой 1С** (код HTTP-сервиса, настройки работы с
  файлами в БСП). Признак: в логе IIS `200` или `500`, а ошибку
  формирует сама база.

## Подводные камни

- **PowerShell и cmd.** В PowerShell `%windir%` не раскрывается —
  получишь ошибку «Не удалось загрузить модуль». Используй
  `& "$env:windir\system32\inetsrv\appcmd.exe"` (или переменную
  `$appcmd`, как выше).
- **Переопубликация.** `webinst` и конфигуратор перезаписывают
  `web.config` публикации. Настройка, сделанная с `/commit:apphost`,
  хранится в `applicationHost.config` и переживает это.
- **Переименование публикации.** Настройка привязана к пути
  (`Default Web Site/mybase`). Новая или переименованная публикация
  получит лимит по умолчанию — команду нужно повторить. Чтобы задать
  лимит сразу для всех публикаций сайта, укажи путь `"Default Web Site"`.
- **HTTPS с клиентскими сертификатами.** Если в «Параметрах SSL» стоит
  «Принимать» или «Требовать», тело запроса должно умещаться в
  `uploadReadAheadSize` (по умолчанию 48 КБ). Лучшее решение, если
  сертификаты не нужны, — поставить «Игнорировать». Иначе поднять буфер:

    ```powershell
    & $appcmd set config $app -section:system.webServer/serverRuntime `
        /uploadReadAheadSize:524288000 /commit:apphost
    ```

- **Память на стороне 1С.** Большое тело запроса HTTP-сервис обычно
  читает целиком в память рабочего процесса. При лимитах в сотни
  мегабайт стоит следить за потреблением памяти на сервере 1С.
