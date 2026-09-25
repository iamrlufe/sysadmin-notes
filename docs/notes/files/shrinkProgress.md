---
title: Контроль хода DBCC SHRINKFILE / SHRINKDATABASE в MS SQL Server
tags:
  - SQL Server
  - MSSQL
  - 1C
summary: "Как смотреть прогресс шринка через sys.dm_exec_requests (percent_complete, DbccFilesCompact), почему процент стоит на месте, как отличить ожидание блокировки от работы, как безопасно прервать шринк и ужимать большой файл порциями."
---

# Контроль хода DBCC SHRINKFILE / SHRINKDATABASE в MS SQL Server

Шринк большого файла данных может идти часами, а в SSMS в это время видно
только «Выполняется запрос…». Ниже — как посмотреть реальный прогресс, как
понять, что шринк не завис, а ждёт блокировку, и как ужимать файл
порциями, чтобы не держать сервер под нагрузкой полсуток подряд.

## Прогресс шринка

Для `DBCC SHRINKDATABASE` и `DBCC SHRINKFILE` SQL Server заполняет поле
`percent_complete` в `sys.dm_exec_requests`. Запускать из **другого**
окна запроса, пока шринк работает:

```sql
SELECT
    r.session_id,
    DB_NAME(r.database_id)              AS db,
    r.command,
    r.status,
    r.percent_complete,
    r.total_elapsed_time / 60000        AS elapsed_min,
    r.estimated_completion_time / 60000 AS est_remaining_min,
    r.wait_type,
    r.wait_time,
    r.blocking_session_id
FROM sys.dm_exec_requests r
WHERE r.command LIKE 'Dbcc%';
```

Для шринка в поле `command` обычно будет `DbccFilesCompact`.

## Как читать результат

- **Процент приблизительный.** Он может долго стоять на месте, а потом
  скакнуть. `est_remaining_min` для шринка тоже неточный — ориентироваться
  на него не стоит.
- **Смотри на `wait_type` и `blocking_session_id`.** Если висит `LCK_M_*`
  и есть блокирующая сессия — шринк стоит и ждёт. Это частая причина того,
  что процент не меняется. Бывает и наоборот: шринк сам блокирует
  пользователей 1С — тогда его `session_id` будет в `blocking_session_id`
  у других запросов.
- **Размер файла почти не меняется до конца.** Сначала страницы
  перемещаются внутри файла, а усечение происходит в самом конце. Поэтому
  по размеру файла в `sys.database_files` прогресс не видно.

Кто кого блокирует — посмотреть все запросы, стоящие в блокировке:

```sql
SELECT r.session_id, r.blocking_session_id, r.command, r.wait_type,
       r.wait_time / 1000 AS wait_sec, DB_NAME(r.database_id) AS db,
       s.host_name, s.program_name, s.login_name
FROM sys.dm_exec_requests r
JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
WHERE r.blocking_session_id <> 0;
```

## Сколько места реально можно отдать

Перед шринком полезно понять, сколько пустоты внутри файлов — чтобы
выбрать целевой размер и не ужимать «до упора»:

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO
SELECT
    name                                                  AS logical_name,
    type_desc,
    size / 128                                            AS size_mb,
    FILEPROPERTY(name, 'SpaceUsed') / 128                 AS used_mb,
    (size - FILEPROPERTY(name, 'SpaceUsed')) / 128        AS free_mb,
    physical_name
FROM sys.database_files;
```

Целевой размер для `DBCC SHRINKFILE` задаётся в мегабайтах. Оставляй запас
над `used_mb` (10–20%) — иначе база сразу начнёт снова расти через
авторасширение.

## Шринк порциями

Один `DBCC SHRINKFILE` сразу на сотни гигабайт — долгая операция без
промежуточных точек. Удобнее ужимать шагами: каждый шаг — отдельная
команда, после каждой место на диске действительно освобождается, а
остановиться можно между шагами.

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO
SET NOCOUNT ON;

DECLARE @File     sysname = N'ИмяФайла';  -- логическое имя файла данных
DECLARE @TargetMB int     = 500000;       -- до какого размера ужимаем
DECLARE @StepMB   int     = 300000;       -- размер порции (300–500 ГБ)

DECLARE @CurMB int, @NextMB int, @t datetime;

SELECT @CurMB = size / 128 FROM sys.database_files WHERE name = @File;
IF @CurMB IS NULL
BEGIN
    RAISERROR(N'Файл %s не найден в текущей базе', 16, 1, @File);
    RETURN;
END

WHILE @CurMB > @TargetMB
BEGIN
    SET @NextMB = CASE WHEN @CurMB - @StepMB > @TargetMB
                       THEN @CurMB - @StepMB ELSE @TargetMB END;
    SET @t = GETDATE();
    RAISERROR(N'%s: %d МБ -> %d МБ ...', 0, 1, @File, @CurMB, @NextMB) WITH NOWAIT;

    DBCC SHRINKFILE (@File, @NextMB) WITH NO_INFOMSGS;

    SELECT @CurMB = size / 128 FROM sys.database_files WHERE name = @File;
    RAISERROR(N'   готово, сейчас %d МБ, шаг занял %d мин', 0, 1,
              @CurMB, DATEDIFF(MINUTE, @t, GETDATE())) WITH NOWAIT;

    IF @CurMB > @NextMB
    BEGIN
        RAISERROR(N'Файл не ужался до %d МБ — дальше не иду', 0, 1, @NextMB) WITH NOWAIT;
        BREAK;
    END
END
```

Если файл после шага не дошёл до нужного размера (в конце файла остались
данные, которые шринк не смог переместить, например LOB-страницы) —
скрипт останавливается, чтобы не крутиться впустую.

!!! tip "Где смотреть вывод"

    Сообщения идут во вкладку **Messages** сразу, благодаря
    `RAISERROR ... WITH NOWAIT`. Процент внутри текущего шага — запросом
    из раздела «Прогресс шринка» выше, из другого окна.

## Прерывание шринка

Шринк можно безопасно прервать — `KILL <session_id>` или отмена запроса в
SSMS. Уже перемещённые страницы останутся на новых местах, откатывать
ничего не придётся; при следующем запуске шринк продолжит фактически с
того же места. Место на диске при этом **не освободится**, пока шринк не
дойдёт до усечения — поэтому порции удобнее одного большого прогона.

## После шринка

!!! warning "Фрагментация индексов"

    Шринк переносит страницы из конца файла в свободные места в начале,
    не заботясь о порядке — после него индексы будут сильно
    фрагментированы. Для 1С после шринка стоит сделать обслуживание
    индексов и обновить статистику — см.
    [«Реиндексация и обновление статистики MS SQL Server (1С)»](sqlReindexStats.md).
    Учти, что `REBUILD` сам по себе снова потребует свободного места в
    файле — примерно размер самого большого индекса.

Шринк — разовая операция после удаления большого объёма данных, а не
регулярное обслуживание. Для `tempdb` есть свои нюансы — см.
[«Сброс и уменьшение размера tempdb»](../windows/shrinkTempdb.md).
