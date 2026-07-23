---
title: Реиндексация и обновление статистики MS SQL Server (1С)
tags:
  - SQL Server
  - 1C
summary: "Порядок реиндексации и обновления статистики MS SQL Server для баз 1С: оценка фрагментации, REORGANIZE/REBUILD, IndexOptimize (Ola Hallengren) и ручные скрипты с контролем хода."
---

# Реиндексация и обновление статистики MS SQL Server (1С)

Инструкция описывает безопасный порядок реиндексации и обновления статистики
на базах 1С под MS SQL Server: как оценить фрагментацию, выбрать между
`REORGANIZE` и `REBUILD`, обновить статистику и проконтролировать результат.

Во всех скриптах имена баз и таблиц — плейсхолдеры вида `[ИмяБазы]`,
`[ИмяТаблицы]`. Перед запуском подставь свои значения (помечено комментарием
`-- замени…`).

---

## Шаг 0. Подготовка — редакция и окно обслуживания

```sql
SELECT SERVERPROPERTY('Edition');
SELECT SERVERPROPERTY('ProductVersion');
```

- **Enterprise / Developer** → можно использовать `ONLINE = ON` (без блокировки таблиц).
- **Standard** → перестроение крупных индексов блокирует таблицу — делать **только в окно обслуживания** (вечер / ночь / выходной).

Проверить текущую нагрузку перед стартом:

```sql
SELECT session_id, status, total_elapsed_time, command
FROM sys.dm_exec_requests
WHERE session_id > 50;
```

Если есть активные тяжёлые запросы пользователей — лучше подождать паузу в работе.

---

## Шаг 1. Проверить, не идёт ли сейчас бэкап

```sql
SELECT r.session_id, r.command, r.percent_complete, t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.command = 'BACKUP DATABASE';
```

Реиндексация и бэкап **не должны пересекаться по времени** — конкуренция за диск и CPU.
Если бэкап идёт — дождись его завершения или перенеси реиндексацию.

---

## Шаг 2. Найти проблемные индексы (фрагментация)

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO
SELECT
    OBJECT_NAME(ips.object_id) AS TableName,
    i.name AS IndexName,
    ips.avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.page_count > 1000
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

**Правило принятия решения:**

| Фрагментация | Что делать |
|---|---|
| < 5% | Не трогать |
| 5–30% | `REORGANIZE` |
| > 30% | `REBUILD` |
| `page_count < 1000` | Игнорировать независимо от % (слишком мелкая таблица, эффекта не будет) |

---

## Шаг 3А. Автоматический вариант — IndexOptimize (Ola Hallengren)

Самый безопасный и правильный способ, если решение
[Ola Hallengren](https://ola.hallengren.com/) уже установлено — одним вызовом
закрывает и реорганизацию / перестроение, и статистику:

```sql
EXECUTE dbo.IndexOptimize
    @Databases = 'USER_DATABASES',  -- либо перечисли через запятую: 'База1,База2'
    @FragmentationLow = NULL,
    @FragmentationMedium = 'INDEX_REORGANIZE',
    @FragmentationHigh = 'INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE',
    @UpdateStatistics = 'ALL',
    @OnlyModifiedStatistics = 'Y',
    @LogToTable = 'Y';
```

- `@Databases = 'USER_DATABASES'` — все пользовательские базы; можно заменить списком конкретных баз через запятую.
- `@FragmentationHigh` со списком через запятую — сначала пробует ONLINE, если недоступно (Standard Edition) — автоматически откатывается на OFFLINE.
- `@OnlyModifiedStatistics = 'Y'` — не тратит время на таблицы, где данные не менялись.

Проверить, что реально выполнилось:

```sql
SELECT DatabaseName, SchemaName, ObjectName, IndexName, CommandType, StartTime, EndTime, ErrorNumber
FROM dbo.CommandLog
ORDER BY StartTime DESC;
```

---

## Шаг 3Б. Ручной вариант — точечно по конкретным таблицам

Если IndexOptimize не установлен или нужно обработать 1–2 конкретные проблемные таблицы:

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO

-- Для фрагментации 5–30%
ALTER INDEX [ИмяИндекса] ON dbo.[ИмяТаблицы] REORGANIZE;

-- Для фрагментации > 30% (Enterprise / Developer)
ALTER INDEX [ИмяИндекса] ON dbo.[ИмяТаблицы]
REBUILD WITH (ONLINE = ON, FILLFACTOR = 90, MAXDOP = 4);

-- Для фрагментации > 30% (Standard Edition — блокирующая операция!)
ALTER INDEX [ИмяИндекса] ON dbo.[ИмяТаблицы]
REBUILD WITH (FILLFACTOR = 90, MAXDOP = 4);
```

!!! warning "Статистика после реиндексации"

    - `REORGANIZE` **не обновляет статистику** — после него обязателен Шаг 4.
    - `REBUILD` статистику обновляет автоматически (эквивалент `WITH FULLSCAN`) — Шаг 4 для этих таблиц не нужен.

---

## Шаг 4. Обновление статистики (для того, что не прошло REBUILD)

### Вариант А — быстрый, по всей базе

Обновляет только реально изменившееся:

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO
EXEC sp_updatestats;
```

### Вариант Б — точный, с полным сканированием и прогрессом

Дольше и тяжелее, но точнее. Скрипт идёт по всем пользовательским таблицам,
печатает процент выполнения, статус по каждой таблице и суммарное время:

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO

SET NOCOUNT ON;

DECLARE @TableName NVARCHAR(256);
DECLARE @SQL NVARCHAR(500);
DECLARE @TotalTables INT;
DECLARE @CurrentTable INT = 0;
DECLARE @PercentDone DECIMAL(5,2);
DECLARE @StartTime DATETIME = GETDATE();

-- Список всех пользовательских таблиц
DECLARE TableCursor CURSOR FOR
SELECT QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name)
FROM sys.tables
WHERE is_ms_shipped = 0
ORDER BY name;

SELECT @TotalTables = COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0;

PRINT 'Начало обновления статистики. Всего таблиц: ' + CAST(@TotalTables AS VARCHAR(10));
PRINT '----------------------------------------';

OPEN TableCursor;
FETCH NEXT FROM TableCursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @CurrentTable = @CurrentTable + 1;
    SET @PercentDone = CAST(@CurrentTable AS DECIMAL(10,2)) / @TotalTables * 100;

    SET @SQL = 'UPDATE STATISTICS ' + @TableName + ' WITH FULLSCAN';

    BEGIN TRY
        EXEC sp_executesql @SQL;
        PRINT CAST(@PercentDone AS VARCHAR(10)) + '% (' + CAST(@CurrentTable AS VARCHAR(10)) + '/' + CAST(@TotalTables AS VARCHAR(10)) + ') - OK: ' + @TableName;
    END TRY
    BEGIN CATCH
        PRINT CAST(@PercentDone AS VARCHAR(10)) + '% (' + CAST(@CurrentTable AS VARCHAR(10)) + '/' + CAST(@TotalTables AS VARCHAR(10)) + ') - ОШИБКА: ' + @TableName + ' -> ' + ERROR_MESSAGE();
    END CATCH

    FETCH NEXT FROM TableCursor INTO @TableName;
END

CLOSE TableCursor;
DEALLOCATE TableCursor;

PRINT '----------------------------------------';
PRINT 'Готово. Затрачено времени: ' + CAST(DATEDIFF(SECOND, @StartTime, GETDATE()) AS VARCHAR(10)) + ' сек.';
```

!!! tip "Как смотреть прогресс"

    Вывод `PRINT` появляется в SSMS на вкладке **Messages** по мере выполнения.
    Чтобы строки шли сразу, а не в конце, в SSMS выбери *Query → Query Options →
    Results → Grid* и убедись, что не включён режим отложенного вывода.

### Вариант В — точечно, одна таблица

```sql
UPDATE STATISTICS dbo.[ИмяТаблицы] WITH FULLSCAN;
```

---

## Шаг 5. Контроль хода выполнения (пока крутится)

```sql
SELECT session_id, status, command, wait_type, blocking_session_id,
       percent_complete, total_elapsed_time
FROM sys.dm_exec_requests
WHERE session_id > 50;
```

- `blocking_session_id = 0` и `wait_type` вроде `CXSYNC_PORT` / `CXPACKET` / `PAGEIOLATCH_*` — норма, не блокировка.
- `blocking_session_id ≠ 0` — кто-то реально блокирует, разбираться отдельно.

---

## Шаг 6. Проверка результата после завершения

```sql
USE [ИмяБазы];  -- замени на имя своей базы
GO

-- Фрагментация ушла?
SELECT OBJECT_NAME(ips.object_id) AS TableName, i.name, ips.avg_fragmentation_in_percent
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE OBJECT_NAME(ips.object_id) IN ('ПроблемнаяТаблица1', 'ПроблемнаяТаблица2');

-- Статистика свежая?
SELECT OBJECT_NAME(object_id) AS TableName, STATS_DATE(object_id, stats_id) AS LastUpdated
FROM sys.stats
WHERE OBJECT_NAME(object_id) IN ('ПроблемнаяТаблица1', 'ПроблемнаяТаблица2');
```

Попроси пользователя заново сформировать проблемный отчёт, сними план выполнения
ещё раз и проверь, ушла ли подсказка «Отсутствует индекс» и что стало с
`Hash Match` / `Table Scan`.

---

## Общие правила безопасности

1. Никогда не запускай `REBUILD` крупных таблиц в рабочее время без `ONLINE` — блокировка положит пользователей.
2. Не совмещай реиндексацию с окном бэкапа.
3. `REORGANIZE` → всегда обновляй статистику отдельно.
4. `REBUILD` → статистику обновлять не нужно, уже сделано.
5. Веди лог выполнения (`@LogToTable = 'Y'` в IndexOptimize или `PRINT` в ручном скрипте) — пригодится для актов выполненных работ и разбора инцидентов.
