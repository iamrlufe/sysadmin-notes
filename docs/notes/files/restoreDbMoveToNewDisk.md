---
title: Восстановление баз SQL Server из .bak с переносом файлов на другой диск
tags:
  - SQL Server
  - MSSQL
  - Backup
summary: "T-SQL скрипт: восстанавливает все .bak из сетевой папки, новые базы кладёт на целевой диск, существующие перезаписывает (REPLACE) и переносит с системного диска. Проверка свободного места перед каждой базой, пробный запуск, дозапуск только недостающих баз."
---

# Восстановление баз SQL Server из .bak с переносом файлов на другой диск

Ещё один вариант массового восстановления — рядом с
[«Массовым восстановлением из каталога с .bak»](restoreDbFromBak.md) и
[«Восстановлением с перезаписью существующих»](restoreDbOverwriteFromBak.md).
Задача здесь такая: из папки с бэкапами развернуть все базы на сервере,
причём одновременно **убрать файлы баз с системного диска `C:`** на
отдельный диск данных (в примере — `E:\Databases\`).

Во всех примерах имена баз и путей — условные: `\\backup-srv\d$\Backups\`,
`ArchiveDb2023_01`, `AppMain` и т.п. Подставь свои.

## Что делает скрипт

Скрипт проходит по всем `.bak` в `@BackupDir`, по одной базе, и решает,
куда класть файлы, в зависимости от того, есть ли уже такая база на
инстансе и где лежат её файлы:

| Ситуация | Что происходит | Куда | `Src` в плане |
|---|---|---|---|
| Базы на сервере нет | Создаётся новая база | `E:\Databases\<база>.mdf`, `<база>_log.ldf` | `new` |
| База есть, файлы уже не на `C:` | Перезапись (`REPLACE`) на месте | Текущие файлы базы | `existing` |
| База есть, файлы на `C:` | Перезапись с переносом | `E:\Databases\`, имена файлов прежние | `existing->moved` |

Например, для набора `ArchiveDb2023_01 … ArchiveDb2026_09` (помесячные
архивы) и служебных баз `AppMain`, `AppForms`, `AppCalc`, `AppReports`,
`AppMobile` получится: отсутствующие архивы создадутся на `E:`, уже
развёрнутые на `E:` перезапишутся на месте, а служебные базы, исторически
лежавшие на `C:`, переедут на `E:`.

Защитные механизмы:

- перед каждой базой проверяется свободное место на целевых дисках (с
  запасом `@ReserveGB`); если не хватает — база пропускается со статусом
  `SKIP (место)` и не трогается;
- ошибка одной базы не останавливает остальные;
- после восстановления лог ужимается до `@ShrinkLogMB` (если база не
  read-only);
- существующие базы переводятся в `SINGLE_USER` перед восстановлением и
  возвращаются в `MULTI_USER` после;
- режим `@Execute = 0` только печатает план и команды `RESTORE`, ничего
  не меняя.

!!! danger "Перезапись существующих баз"

    Для баз, которые уже есть на инстансе, выполняется `RESTORE ... WITH
    REPLACE` — текущее содержимое безвозвратно заменяется данными из
    бэкапа, сессии пользователей рвутся через `ROLLBACK IMMEDIATE`. Если
    текущие версии могут понадобиться — сначала сними с них бэкап
    (см. страховочный бэкап в [скрипте с перезаписью](restoreDbOverwriteFromBak.md)).

## Подготовка

1. Убедиться, что папка `E:\Databases\` существует — `RESTORE` сам папки
   не создаёт.
2. Проверить, что служба SQL Server видит путь к бэкапам (UNC
   `\\backup-srv\d$\...`) и у её учётной записи есть права на чтение.
   Если путь не виден, скрипт остановится с сообщением «В папке не
   найдено .bak».
3. Прикинуть место на целевом диске: сумма размеров всех файлов из
   бэкапов (её покажет пробный запуск в колонке `SizeMB`) против
   свободного места. Если места не хватит на всё, часть баз уйдёт в
   `SKIP (место)` — это не страшно, их можно дозалить позже.
4. Убедиться, что существующие базы, которые попадут под перезапись,
   действительно можно перезаписывать.
5. Предупредить пользователей: на время восстановления существующих баз
   их сессии будут принудительно отключены.

!!! tip "Запускать через SQL Agent"

    Восстановление большого набора баз может занять несколько часов.
    Надёжнее запускать скрипт шагом задания SQL Server Agent — тогда обрыв
    RDP или закрытие SSMS его не прервут.

## Шаг 1. Пробный запуск

Пробный запуск ничего не меняет на сервере — только показывает план и
команды.

1. Открыть SSMS, подключиться к целевому серверу, новое окно запроса
   (база `master`).
2. Вставить полный текст скрипта из раздела ниже целиком.
3. Проверить параметры в начале: `@Execute = 0`, `@OnlyMissing = 0`.
4. Выполнить (F5).
5. Во вкладке «Результаты»: колонка `Target` у всех файлов должна
   начинаться с `E:\Databases\`, колонка `Src` — `new`, `existing` или
   `existing->moved` (см. таблицу выше).
6. Во вкладке «Сообщения» будут напечатаны готовые команды `RESTORE`, по
   одной на базу.

Если что-то не совпадает с ожиданиями — боевой запуск не делать.

## Шаг 2. Боевой запуск

1. В начале скрипта поставить `@Execute = 1`.
2. Выполнить (F5).
3. Ход работы — во вкладке «Сообщения»: `=== <база>: восстановление...`,
   проценты от `STATS = 10`, затем `<база>: OK`.
4. По окончании во вкладке «Результаты» появится итоговая таблица по
   каждой базе.

| Status | Что значит | Что делать |
|---|---|---|
| `OK` | База восстановлена | Ничего |
| `SKIP (место)` | Не хватило места, база не трогалась | Освободить место, запустить повторно (см. ниже) |
| `ERROR` | Ошибка `RESTORE`, текст в колонке `Msg` | Разобрать ошибку, запустить повторно |
| `READ ERROR` | Не удалось прочитать `.bak` | Проверить файл и права доступа |

Сообщения `SINGLE_USER не выставлен` и `лог не ужат` — предупреждения,
восстановление при этом продолжается.

## Нехватка места и повторный запуск

Если часть баз получила `SKIP (место)`, нужно освободить место на целевом
диске и запустить скрипт повторно только для недостающих баз.

1. Освободить место (как следить за ходом шринка — см. [«Контроль хода DBCC SHRINKFILE»](shrinkProgress.md)). Например, если на том же диске лежит большая база с
   кучей пустоты внутри (в примере — `AuditLog`), её можно ужать
   порциями:

    ```sql
    SELECT name, physical_name, size/128/1024 AS size_gb
    FROM sys.master_files WHERE database_id = DB_ID(N'AuditLog');

    USE [AuditLog];
    DBCC SHRINKFILE (N'AuditLog', 3000000);  -- дальше 2500000, 2000000 ... порциями 300–500 ГБ
    ```

2. В скрипте поставить `@OnlyMissing = 1` и `@Execute = 1`. Будут
   восстановлены только базы, которых ещё нет на сервере; уже
   восстановленные останутся нетронутыми.
3. Запустить и проверить итоговую таблицу.

!!! warning "Базы со статусом ERROR"

    Если база получила `ERROR` и осталась на сервере в неисправном
    состоянии, `@OnlyMissing = 1` её пропустит — она ведь «есть». Такую
    базу нужно удалить вручную или восстановить отдельной командой из
    вывода пробного запуска.

## Проверка после восстановления

1. Все базы на месте и в состоянии `ONLINE`:

    ```sql
    SELECT name, state_desc, user_access_desc, is_read_only, recovery_model_desc
    FROM sys.databases
    WHERE name LIKE N'ArchiveDb%'
       OR name IN (N'AppMain', N'AppForms', N'AppCalc', N'AppReports', N'AppMobile')
    ORDER BY name;
    ```

2. Все файлы этих баз лежат на `E:\Databases\` (запрос должен вернуть
   пусто):

    ```sql
    SELECT DB_NAME(database_id) AS db, name, physical_name
    FROM sys.master_files
    WHERE (DB_NAME(database_id) LIKE N'ArchiveDb%'
           OR DB_NAME(database_id) IN (N'AppMain', N'AppForms', N'AppCalc', N'AppReports', N'AppMobile'))
      AND physical_name NOT LIKE N'E:\Databases\%';
    ```

3. Проверить старую папку данных на `C:` (например,
   `C:\Program Files\Microsoft SQL Server\MSSQL<версия>.MSSQLSERVER\MSSQL\DATA\`)
   на старые файлы перенесённых баз. Удаляет ли их SQL Server при
   переносе через `RESTORE ... MOVE`, не проверено. Если файлы остались,
   а запрос из п. 2 пустой — их можно удалить вручную.
4. Если часть баз должна остаться «только для чтения» (например, закрытые
   архивные периоды), проверить колонку `is_read_only` из п. 1 и при
   необходимости выставить `ALTER DATABASE [..] SET READ_ONLY`.

## Полный текст скрипта

Скопировать целиком в новое окно запроса SSMS. Параметры меняются только
в блоке `DECLARE` в начале.

```sql
/*  Восстановление всех .bak из папки с переносом на E:\Databases\
    Сначала запусти с @Execute = 0 — выведет план и команды, ничего не делая.
*/
SET NOCOUNT ON;

DECLARE @BackupDir   nvarchar(400) = N'\\backup-srv\d$\Backups\';  -- замени на свою папку с .bak
DECLARE @TargetDir   nvarchar(400) = N'E:\Databases\';   -- папка должна существовать
DECLARE @MoveFrom    nvarchar(3)   = N'C:\';             -- базы с этого диска переносим
DECLARE @ReserveGB   int           = 20;                 -- сколько оставить свободным на диске
DECLARE @ShrinkLogMB int           = 1024;               -- NULL = не ужимать лог
DECLARE @Execute     bit           = 0;                  -- 0 = только план, 1 = восстанавливать
DECLARE @OnlyMissing bit           = 0;                  -- 1 = только базы, которых ещё нет на сервере

IF OBJECT_ID('tempdb..#dir')  IS NOT NULL DROP TABLE #dir;
IF OBJECT_ID('tempdb..#fl')   IS NOT NULL DROP TABLE #fl;
IF OBJECT_ID('tempdb..#plan') IS NOT NULL DROP TABLE #plan;
IF OBJECT_ID('tempdb..#drv')  IS NOT NULL DROP TABLE #drv;
IF OBJECT_ID('tempdb..#res')  IS NOT NULL DROP TABLE #res;

CREATE TABLE #dir (subdirectory nvarchar(512), depth int, isfile bit);
CREATE TABLE #fl (
    LogicalName nvarchar(128), PhysicalName nvarchar(260), [Type] char(1),
    FileGroupName nvarchar(128), Size numeric(20,0), MaxSize numeric(20,0),
    FileId bigint, CreateLSN numeric(25,0), DropLSN numeric(25,0),
    UniqueId uniqueidentifier, ReadOnlyLSN numeric(25,0), ReadWriteLSN numeric(25,0),
    BackupSizeInBytes bigint, SourceBlockSize int, FileGroupId int,
    LogGroupGUID uniqueidentifier, DifferentialBaseLSN numeric(25,0),
    DifferentialBaseGUID uniqueidentifier, IsReadOnly bit, IsPresent bit,
    TDEThumbprint varbinary(32), SnapshotUrl nvarchar(360));
CREATE TABLE #plan (
    DbName sysname, BakFile nvarchar(600), LogicalName nvarchar(128),
    [Type] char(1), FileId bigint, SizeMB numeric(20,1),
    Target nvarchar(600), Src varchar(20));
CREATE TABLE #drv (drive char(1), MBfree bigint);
CREATE TABLE #res (DbName sysname, Status nvarchar(40), Msg nvarchar(2000),
                   StartedAt datetime, FinishedAt datetime);

INSERT #dir EXEC master.sys.xp_dirtree @BackupDir, 1, 1;
IF NOT EXISTS (SELECT 1 FROM #dir WHERE isfile = 1 AND subdirectory LIKE N'%.bak')
BEGIN
    RAISERROR(N'В папке не найдено .bak — SQL Server не видит путь.', 16, 1);
    RETURN;
END

DECLARE @f nvarchar(512), @db sysname, @path nvarchar(900), @sql nvarchar(max);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT subdirectory FROM #dir
    WHERE isfile = 1 AND subdirectory LIKE N'%.bak' ORDER BY subdirectory;
OPEN c; FETCH NEXT FROM c INTO @f;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @db   = LEFT(@f, LEN(@f) - 4);
    SET @db   = ISNULL(DB_NAME(DB_ID(@db)), @db);
    SET @path = @BackupDir + @f;
    SET @sql  = N'RESTORE FILELISTONLY FROM DISK = N'''
              + REPLACE(@path, N'''', N'''''') + N''' WITH FILE = 1;';
    TRUNCATE TABLE #fl;
    BEGIN TRY
        INSERT #fl EXEC (@sql);
    END TRY
    BEGIN CATCH
        INSERT #res VALUES (@db, N'READ ERROR', ERROR_MESSAGE(), GETDATE(), GETDATE());
    END CATCH;

    INSERT #plan
    SELECT @db, @path, fl.LogicalName, fl.[Type], fl.FileId, fl.Size / 1048576.0,
           CASE
             WHEN x.cur IS NULL THEN
                  @TargetDir + @db
                + CASE WHEN fl.[Type] = 'L' AND fl.FileId = 2 THEN N'_log.ldf'
                       WHEN fl.[Type] = 'L' THEN N'_log' + CAST(fl.FileId AS nvarchar(10)) + N'.ldf'
                       WHEN fl.FileId = 1   THEN N'.mdf'
                       ELSE N'_' + CAST(fl.FileId AS nvarchar(10)) + N'.ndf' END
             WHEN LEFT(x.cur, 3) = @MoveFrom THEN
                  @TargetDir + RIGHT(x.cur, CHARINDEX(N'\', REVERSE(x.cur)) - 1)
             ELSE x.cur
           END,
           CASE WHEN x.cur IS NULL THEN 'new'
                WHEN LEFT(x.cur, 3) = @MoveFrom THEN 'existing->moved'
                ELSE 'existing' END
    FROM #fl fl
    LEFT JOIN sys.master_files mf1
           ON mf1.database_id = DB_ID(@db) AND mf1.name = fl.LogicalName
    LEFT JOIN sys.master_files mf2
           ON mf2.database_id = DB_ID(@db) AND mf2.file_id = fl.FileId
          AND mf1.name IS NULL
    CROSS APPLY (SELECT COALESCE(mf1.physical_name, mf2.physical_name) AS cur) x;

    FETCH NEXT FROM c INTO @f;
END
CLOSE c; DEALLOCATE c;

SELECT DbName, Src, LogicalName, [Type], SizeMB, Target FROM #plan ORDER BY DbName, FileId;

DECLARE @bak nvarchar(600), @existing bit, @cmd nvarchar(max), @msg nvarchar(2000),
        @lname nvarchar(128), @started datetime;

DECLARE d CURSOR LOCAL FAST_FORWARD FOR
    SELECT DbName, MAX(BakFile),
           CAST(MAX(CASE WHEN Src = 'new' THEN 0 ELSE 1 END) AS bit)
    FROM #plan
    WHERE @OnlyMissing = 0 OR DB_ID(DbName) IS NULL
    GROUP BY DbName
    ORDER BY MAX(CASE WHEN Src = 'new' THEN 1 ELSE 0 END), DbName;
OPEN d; FETCH NEXT FROM d INTO @db, @bak, @existing;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @started = GETDATE();

    SELECT @cmd = N'RESTORE DATABASE ' + QUOTENAME(@db)
        + N' FROM DISK = N''' + REPLACE(@bak, N'''', N'''''') + N''' WITH FILE = 1, '
        + STRING_AGG(CAST(N'MOVE N''' + REPLACE(LogicalName, N'''', N'''''')
                        + N''' TO N''' + Target + N'''' AS nvarchar(max)), N', ')
               WITHIN GROUP (ORDER BY FileId)
        + CASE WHEN @existing = 1 THEN N', REPLACE' ELSE N'' END
        + N', RECOVERY, STATS = 10;'
    FROM #plan WHERE DbName = @db;

    IF @Execute = 0
    BEGIN
        PRINT @cmd;
        FETCH NEXT FROM d INTO @db, @bak, @existing;
        CONTINUE;
    END

    TRUNCATE TABLE #drv;
    INSERT #drv EXEC master.sys.xp_fixeddrives;

    SELECT @msg = NULL;
    SELECT @msg = STRING_AGG(CAST(n.drv + N': нужно ' + CAST(CAST(n.need/1024 AS numeric(10,1)) AS nvarchar(20))
                  + N' ГБ, свободно ' + CAST(CAST(ISNULL(dr.MBfree,0)/1024.0 AS numeric(10,1)) AS nvarchar(20))
                  + N' ГБ' AS nvarchar(max)), N'; ')
    FROM (SELECT LEFT(Target,1) AS drv, SUM(SizeMB) AS need
          FROM #plan WHERE DbName = @db GROUP BY LEFT(Target,1)) n
    LEFT JOIN #drv dr ON dr.drive = n.drv
    WHERE ISNULL(dr.MBfree, 0) - @ReserveGB * 1024 < n.need;

    IF @msg IS NOT NULL
    BEGIN
        INSERT #res VALUES (@db, N'SKIP (место)', @msg, @started, GETDATE());
        RAISERROR(N'%s — ПРОПУЩЕНА: %s', 0, 1, @db, @msg) WITH NOWAIT;
        FETCH NEXT FROM d INTO @db, @bak, @existing;
        CONTINUE;
    END

    RAISERROR(N'=== %s: восстановление...', 0, 1, @db) WITH NOWAIT;

    IF @existing = 1
    BEGIN
        BEGIN TRY
            SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
            EXEC (@sql);
        END TRY
        BEGIN CATCH
            SET @msg = ERROR_MESSAGE();
            RAISERROR(N'%s: SINGLE_USER не выставлен (%s), продолжаю', 0, 1, @db, @msg) WITH NOWAIT;
        END CATCH;
    END

    BEGIN TRY
        EXEC (@cmd);
        INSERT #res VALUES (@db, N'OK', NULL, @started, GETDATE());
        RAISERROR(N'%s: OK', 0, 1, @db) WITH NOWAIT;
    END TRY
    BEGIN CATCH
        SET @msg = ERROR_MESSAGE();
        INSERT #res VALUES (@db, N'ERROR', @msg, @started, GETDATE());
        RAISERROR(N'%s: ОШИБКА — %s', 0, 1, @db, @msg) WITH NOWAIT;
    END CATCH;

    IF DB_ID(@db) IS NOT NULL
    BEGIN
        BEGIN TRY
            SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET MULTI_USER;';
            EXEC (@sql);
        END TRY
        BEGIN CATCH
            PRINT N'';
        END CATCH;
    END

    IF @ShrinkLogMB IS NOT NULL
       AND EXISTS (SELECT 1 FROM #res WHERE DbName = @db AND Status = N'OK')
       AND DATABASEPROPERTYEX(@db, 'Updateability') = 'READ_WRITE'
    BEGIN
        DECLARE l CURSOR LOCAL FAST_FORWARD FOR
            SELECT LogicalName FROM #plan WHERE DbName = @db AND [Type] = 'L';
        OPEN l; FETCH NEXT FROM l INTO @lname;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            BEGIN TRY
                SET @sql = N'USE ' + QUOTENAME(@db) + N'; CHECKPOINT; DBCC SHRINKFILE (N'''
                         + REPLACE(@lname, N'''', N'''''') + N''', '
                         + CAST(@ShrinkLogMB AS nvarchar(20)) + N') WITH NO_INFOMSGS;';
                EXEC (@sql);
            END TRY
            BEGIN CATCH
                SET @msg = ERROR_MESSAGE();
                RAISERROR(N'%s: лог не ужат (%s)', 0, 1, @db, @msg) WITH NOWAIT;
            END CATCH;
            FETCH NEXT FROM l INTO @lname;
        END
        CLOSE l; DEALLOCATE l;
    END

    FETCH NEXT FROM d INTO @db, @bak, @existing;
END
CLOSE d; DEALLOCATE d;

SELECT DbName, Status, Msg, StartedAt, FinishedAt,
       DATEDIFF(MINUTE, StartedAt, FinishedAt) AS Minutes
FROM #res ORDER BY StartedAt;
```
