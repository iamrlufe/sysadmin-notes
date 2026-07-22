---
title: Восстановление баз SQL Server из .bak с перезаписью существующих
tags:
  - SQL Server
  - MSSQL
  - Backup
summary: "T-SQL скрипт для восстановления баз с REPLACE: отключение пользователей (SINGLE_USER ROLLBACK IMMEDIATE), сохранение текущих путей файлов, страховочный бэкап перед перезаписью, проверки AlwaysOn/снапшотов и автовосстановление MULTI_USER при ошибке."
---

# Восстановление баз SQL Server из .bak с перезаписью существующих

Это развитие скрипта [«Массовое восстановление баз SQL Server из
каталога с .bak»](restoreDbFromBak.md). Тот скрипт нарочно пропускает
базы, которые уже есть на инстансе — это безопасно, но не подходит для
задачи «регулярно освежать тестовый стенд свежими бэкапами из прода».
Здесь — вариант с `REPLACE`, который умеет полностью заменять содержимое
существующей базы бэкапом, с несколькими слоями защиты от случайного
запуска не туда.

!!! danger "Это разрушительная операция"

    Восстановление с `REPLACE` **безвозвратно заменяет** текущее
    содержимое базы данными из бэкапа. Все активные сессии в базе
    разрываются, открытые транзакции откатываются. Без включённого
    страховочного бэкапа (`@BackupBeforeOverwrite`) откатить перезапись
    будет нечем.

## Чем отличается от базового скрипта

- **Режимы (`@Mode`).** `ALL` — отсутствующие восстанавливаются,
  существующие перезаписываются; `EXISTING` — трогать только то, что уже
  есть на инстансе; `MISSING` — вести себя как базовый скрипт (перезаписи
  нет вообще). Это позволяет прогонять один и тот же скрипт и для
  первичного разворачивания, и для последующих «освежений».
- **Явное подтверждение перезаписи.** Флаг `@IConfirmOverwrite` — отдельный
  от `@Execute`. Если режим предполагает перезапись, а флаг не поднят,
  скрипт останавливается через `RAISERROR` до того, как что-либо тронуть.
  Это защита от бездумного copy-paste: одного `@Execute = 1` недостаточно,
  чтобы что-то перезаписать.
- **Сохранение текущих путей файлов (`@UseExistingPaths`).** Базовый
  скрипт всегда кладёт файлы в `@DataPath` с предсказуемыми именами. Этот
  скрипт по умолчанию (`@UseExistingPaths = 1`) сопоставляет логические
  имена файлов бэкапа с `sys.master_files` уже существующей базы и
  восстанавливает файлы **туда же, где они лежат сейчас** — важно, если
  файлы базы на инстансе разложены по разным дискам вручную и переезжать
  им не нужно. Файлы, которых в текущей базе нет (новый `.ndf`, например),
  и все файлы полностью новых баз всё равно уходят в `@DataPath`.
- **Отключение пользователей перед перезаписью.** Для существующей базы
  перед `RESTORE ... WITH REPLACE` выполняется
  `ALTER DATABASE ... SET SINGLE_USER WITH ROLLBACK IMMEDIATE` — иначе
  `RESTORE` откажется работать, пока к базе есть активные подключения.
  После восстановления база возвращается в `MULTI_USER`.
- **Страховочный бэкап перед перезаписью (`@BackupBeforeOverwrite`).**
  Если включён, перед `SINGLE_USER`/`REPLACE` снимается `COPY_ONLY`
  сжатый бэкап текущего состояния базы в `@SafetyBackupPath` — не
  трогает цепочку обычных бэкапов и даёт возможность откатиться, если
  восстановили не тот файл.
- **Проверки, блокирующие restore.** Перед перезаписью скрипт проверяет,
  нет ли у базы database snapshot (`sys.databases.source_database_id`) —
  с ним `RESTORE` не сработает, снапшот сначала нужно удалить руками — и
  не состоит ли база в группе доступности AlwaysOn (`replica_id`) — такие
  базы этот скрипт сознательно не трогает, для них restore делается
  через отдельную процедуру с учётом реплик.
- **Проверка коллизий путей.** Помимо дублирования путей внутри одной
  базы, скрипт проверяет, не указывает ли целевой путь файла на файл,
  которым уже владеет **другая** база на этом инстансе
  (`sys.master_files`) — защита от случайной перезаписи чужих файлов при
  ошибке в путях.
- **Автовосстановление `MULTI_USER` при сбое.** Если восстановление
  упало между `SINGLE_USER` и `RESTORE`, блок `CATCH` пытается вернуть
  базу в `MULTI_USER`, чтобы сбой посреди ночи не оставил прод-базу
  недоступной для всех до утра.
- **Замер времени и итоговая проверка состояния.** Для каждой базы
  считается длительность восстановления в секундах, а в конце скрипт
  отдельно выводит список баз, которые остались не в `ONLINE`/`MULTI_USER`
  — это сигнал проверить их вручную, даже если основной отчёт не показал
  ошибок.

## Принцип работы

### 1. Предохранитель на входе

Прежде чем открывать `xp_dirtree` и что-либо сканировать, скрипт
проверяет: если `@Execute = 1`, режим предполагает перезапись (`ALL` или
`EXISTING`), а `@IConfirmOverwrite = 0` — выполнение прерывается
`RAISERROR`. Дальше скрипт не идёт вообще.

### 2. Список файлов и фильтрация

Как и в базовом скрипте: `xp_dirtree` в `#files`, фильтр по `.bak`,
опциональный ручной список файлов (если нет прав на `xp_dirtree`),
опциональное сужение до одной базы через `@OnlyDb`.

### 3. Определение действия для каждой базы

Для каждого файла проверяется `DB_ID(@DbName)`. Комбинация
существования базы и `@Mode` определяет, что делать:

| Существует | @Mode = ALL | @Mode = EXISTING | @Mode = MISSING |
|---|---|---|---|
| да | перезапись | перезапись | пропуск |
| нет | создание | пропуск | создание |

### 4. Проверки, блокирующие restore

Для уже существующей базы скрипт проверяет наличие database snapshot и
членство в AlwaysOn AG — при совпадении бросает `RAISERROR` и база
попадает в отчёт со статусом `ОШИБКА`, не трогая данные.

### 5. Состав бэкапа и целевые пути файлов

`RESTORE FILELISTONLY` даёт список логических файлов бэкапа, как и в
базовом скрипте. Дальше — таблица `#tg` с целевыми путями: `LEFT JOIN` к
`sys.master_files` текущей базы по логическому имени файла. Если
совпадение нашлось и `@UseExistingPaths = 1` — берётся текущий физический
путь. Иначе путь строится так же, как в базовом скрипте (`.mdf`/`.ndf`
для данных, `.ldf`/`_logN.ldf` для лога) — под `@DataPath`.

### 6. Проверка коллизий

Две проверки перед тем, как строить `RESTORE`: нет ли дублирующихся
целевых путей внутри одной базы (например, если два логических файла
случайно сопоставились с одним и тем же путём), и не занят ли какой-то
целевой путь файлом другой базы на инстансе.

### 7. Сборка команды `RESTORE`

Как и в базовом скрипте, `MOVE` собирается динамически через
`STUFF(... FOR XML PATH(''))`. Для существующих баз в текст команды
добавляется `REPLACE`.

### 8. Режим отчёта

`@Execute = 0` печатает то, что будет выполнено, включая
`ALTER DATABASE ... SET SINGLE_USER` и `SET MULTI_USER` вокруг `RESTORE`
для существующих баз — можно прочитать весь план целиком до первого
реального изменения.

### 9. Выполнение

Для существующей базы: опциональный страховочный `COPY_ONLY` бэкап →
`SINGLE_USER WITH ROLLBACK IMMEDIATE` → `RESTORE ... WITH REPLACE` →
`MULTI_USER`. Для новой базы — просто `RESTORE`. Время выполнения
фиксируется через `SYSDATETIME()`/`DATEDIFF`.

### 10. Обработка ошибок

`TRY/CATCH` вокруг всего блока на базу: при ошибке скрипт отдельно
пытается вернуть базу в `MULTI_USER` (на случай, если упали между
`SINGLE_USER` и `RESTORE`), затем пишет в отчёт статус `ОШИБКА` с текстом
исключения — обработка остальных файлов в цикле продолжается.

### 11. Итоги

Помимо таблицы отчёта (с сортировкой: сначала ошибки, потом план, потом
готово), скрипт отдельно выводит список **всех** баз на инстансе, которые
не в состоянии `ONLINE`/`MULTI_USER` — это ловит зависшие в `SINGLE_USER`
базы, даже не участвовавшие в этом прогоне. В конце — проверка места на
`@DataPath` (актуальна прежде всего при `@UseExistingPaths = 0`).

## Как использовать

1. Проверить количество backup set в файлах (как в базовом скрипте):
   ```sql
   RESTORE HEADERONLY FROM DISK = N'\\srvsql-02\d$\072026\aspGas.bak';
   ```
2. Задать `@BackupPath`, `@DataPath`, выбрать `@Mode` под задачу.
3. Прогнать с `@Execute = 0` и внимательно прочитать план: для каких баз
   будет `REPLACE`, куда лягут файлы, совпадает ли это с ожиданиями.
4. Если решили держать страховочный бэкап — включить
   `@BackupBeforeOverwrite = 1` и указать `@SafetyBackupPath`.
5. Поставить `@Execute = 1` и `@IConfirmOverwrite = 1`, запустить.
6. После выполнения обязательно проверить блок «базы в нештатном
   состоянии» в конце вывода — пустой результат означает, что все базы
   вернулись в `ONLINE`/`MULTI_USER`.

## Полный скрипт

```sql
/* ================================================================
   Восстановление баз из каталога .bak С ПЕРЕЗАПИСЬЮ существующих

   ВНИМАНИЕ: для существующих баз выполняется
       ALTER DATABASE ... SET SINGLE_USER WITH ROLLBACK IMMEDIATE
       RESTORE DATABASE ... WITH REPLACE
   Текущие данные этих баз будут БЕЗВОЗВРАТНО заменены содержимым бэкапа.
   Все сессии в базе будут разорваны, открытые транзакции откачены.

   Порядок работы:
     1) @Execute = 0                        -> отчёт и тексты команд, ничего не делается
     2) @Execute = 1, @IConfirmOverwrite = 1 -> восстановление с перезаписью

   @Mode:  'ALL'      - существующие перезаписать, отсутствующие восстановить
           'EXISTING' - только перезаписать существующие
           'MISSING'  - только восстановить отсутствующие (перезаписи нет)

   @OnlyDb = N'aspGas' -> обработать одну базу (для крупных)
   ================================================================ */
SET NOCOUNT ON;

DECLARE @BackupPath        nvarchar(260) = N'\\srvsql-02\d$\072026\';  -- слэш в конце обязателен
DECLARE @DataPath          nvarchar(260) = N'E:\Databases\';           -- слэш в конце обязателен
DECLARE @Position          int           = 1;      -- см. блок 0
DECLARE @Mode              varchar(10)   = 'ALL';
DECLARE @OnlyDb            sysname       = NULL;   -- NULL = все файлы каталога

DECLARE @Execute           bit           = 1;      -- 1 = выполнять
DECLARE @IConfirmOverwrite bit           = 1;      -- 1 = подтверждаю перезапись существующих

DECLARE @UseExistingPaths  bit           = 1;      -- 1 = поверх текущих файлов базы
                                                   -- 0 = все файлы переехать в @DataPath

DECLARE @BackupBeforeOverwrite bit       = 0;      -- 1 = COPY_ONLY бэкап базы перед перезаписью
DECLARE @SafetyBackupPath  nvarchar(260) = N'E:\SafetyBackup\';


/* ---------------------------------------------------------------
   БЛОК 0. Сколько backup set в файле?
   Выполни ОТДЕЛЬНО хотя бы по одному крупному файлу:

       RESTORE HEADERONLY FROM DISK = N'\\srvsql-02\d$\072026\aspGas.bak';

   Одна строка -> @Position = 1.
   Несколько строк -> Position последней строки с BackupType = 1.
   Ошибка здесь = перезапись актуальных данных старым набором.
   --------------------------------------------------------------- */


/* --------------------------- предохранитель -------------------- */
IF @Execute = 1 AND @Mode IN ('ALL', 'EXISTING') AND @IConfirmOverwrite = 0
BEGIN
    RAISERROR('Режим %s перезаписывает существующие базы. Установи @IConfirmOverwrite = 1, если это осознанное решение.', 16, 1, @Mode);
    RETURN;
END


/* --------------------------- список файлов --------------------- */
IF OBJECT_ID('tempdb..#files') IS NOT NULL DROP TABLE #files;
CREATE TABLE #files (FileName nvarchar(260), Depth int, IsFile int);

INSERT INTO #files
EXEC master.sys.xp_dirtree @BackupPath, 1, 1;

DELETE FROM #files WHERE IsFile <> 1 OR FileName NOT LIKE '%.bak';

/* Если xp_dirtree недоступна (нет прав sysadmin) — закомментируй два блока выше
   и раскомментируй ручной список:

   INSERT INTO #files (FileName) VALUES
     (N'aspbase2026_03.bak'), (N'aspbase2026_04.bak'), (N'aspbase2026_05.bak'),
     (N'aspbase2026_06.bak'), (N'aspBase2026_07.bak'), (N'aspCommon.bak'),
     (N'aspElectric.bak'),    (N'aspForm.bak'),        (N'aspGas.bak'),
     (N'aspHeat.bak'),        (N'aspReports.bak'),     (N'ControlCheckPda.bak'),
     (N'IsasAttachments.bak'),(N'Protocol.bak'),       (N'TransferSrvDataGas.bak');
*/

IF @OnlyDb IS NOT NULL
    DELETE FROM #files WHERE LEFT(FileName, LEN(FileName) - 4) <> @OnlyDb;


/* --------------------------- служебные таблицы ----------------- */
IF OBJECT_ID('tempdb..#report') IS NOT NULL DROP TABLE #report;
CREATE TABLE #report (
    DbName    sysname,
    Action    varchar(30),
    Status    varchar(30),
    SizeGB    decimal(18,2) NULL,
    Seconds   int NULL,
    Note      nvarchar(1000) NULL
);

DECLARE @major int = CAST(PARSENAME(CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')), 4) AS int);

IF OBJECT_ID('tempdb..#fl') IS NOT NULL DROP TABLE #fl;
CREATE TABLE #fl (
    LogicalName nvarchar(128), PhysicalName nvarchar(260), [Type] char(1), FileGroupName nvarchar(128),
    [Size] numeric(20,0), MaxSize numeric(20,0), FileId bigint, CreateLSN numeric(25,0), DropLSN numeric(25,0),
    UniqueId uniqueidentifier, ReadOnlyLSN numeric(25,0), ReadWriteLSN numeric(25,0), BackupSizeInBytes bigint,
    SourceBlockSize int, FileGroupId int, LogGroupGUID uniqueidentifier, DifferentialBaseLSN numeric(25,0),
    DifferentialBaseGUID uniqueidentifier, IsReadOnly bit, IsPresent bit, TDEThumbprint varbinary(32),
    SnapshotUrl nvarchar(360)
);
IF @major < 13 ALTER TABLE #fl DROP COLUMN SnapshotUrl;

IF OBJECT_ID('tempdb..#tg') IS NOT NULL DROP TABLE #tg;
CREATE TABLE #tg (ord int IDENTITY(1,1), LogicalName nvarchar(128), TargetPath nvarchar(520));


/* --------------------------- цикл по файлам -------------------- */
DECLARE @FileName nvarchar(260), @DbName sysname, @Full nvarchar(520);
DECLARE @sql nvarchar(max), @moves nvarchar(max), @restore nvarchar(max);
DECLARE @SizeGB decimal(18,2), @Exists bit, @Act varchar(30), @Dup int;
DECLARE @t datetime2, @esc nvarchar(300);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT FileName FROM #files ORDER BY FileName;

OPEN cur;
FETCH NEXT FROM cur INTO @FileName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @DbName = LEFT(@FileName, LEN(@FileName) - 4);
    SET @Full   = @BackupPath + @FileName;
    SET @Exists = CASE WHEN DB_ID(@DbName) IS NOT NULL THEN 1 ELSE 0 END;
    SET @esc    = REPLACE(@DbName, ']', ']]');

    BEGIN TRY
        /* --- фильтр по режиму --- */
        IF (@Exists = 1 AND @Mode = 'MISSING') OR (@Exists = 0 AND @Mode = 'EXISTING')
        BEGIN
            INSERT INTO #report VALUES (@DbName, 'ПРОПУСК', 'ПРОПУСК', NULL, NULL,
                CASE WHEN @Exists = 1 THEN N'База существует, режим MISSING'
                     ELSE N'Базы нет, режим EXISTING' END);
            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        SET @Act = CASE WHEN @Exists = 1 THEN 'ПЕРЕЗАПИСЬ' ELSE 'СОЗДАНИЕ' END;

        /* --- проверка на состояния, мешающие restore --- */
        IF @Exists = 1
        BEGIN
            IF EXISTS (SELECT 1 FROM sys.databases WHERE source_database_id = DB_ID(@DbName))
                RAISERROR('У базы есть снимки (database snapshot) — restore невозможен, удали их', 16, 1);

            IF EXISTS (SELECT 1 FROM sys.databases WHERE name = @DbName AND replica_id IS NOT NULL)
                RAISERROR('База участвует в группе доступности AlwaysOn — restore через этот скрипт не выполняется', 16, 1);
        END

        /* --- состав файлов бэкапа --- */
        DELETE FROM #fl;
        SET @sql = N'RESTORE FILELISTONLY FROM DISK = N''' + REPLACE(@Full, '''', '''''')
                 + N''' WITH FILE = ' + CAST(@Position AS nvarchar(10)) + N';';
        INSERT INTO #fl EXEC (@sql);

        SELECT @SizeGB = CAST(SUM([Size]) / 1073741824.0 AS decimal(18,2)) FROM #fl;

        /* --- целевые пути ---
           Для существующей базы при @UseExistingPaths = 1 файлы кладутся туда,
           где лежат сейчас (сопоставление по логическому имени). Файлы, которых
           в текущей базе нет, и все файлы новых баз идут в @DataPath. --- */
        DELETE FROM #tg;

        ;WITH f AS (
            SELECT fl.LogicalName, fl.[Type], fl.FileId,
                   ROW_NUMBER() OVER (PARTITION BY fl.[Type] ORDER BY fl.FileId) AS rn,
                   mf.physical_name
            FROM #fl fl
            LEFT JOIN sys.master_files mf
                   ON mf.database_id = DB_ID(@DbName)
                  AND mf.name = fl.LogicalName
        )
        INSERT INTO #tg (LogicalName, TargetPath)
        SELECT LogicalName,
               CASE
                   WHEN @UseExistingPaths = 1 AND physical_name IS NOT NULL THEN physical_name
                   WHEN [Type] = 'D' AND rn = 1 THEN @DataPath + @DbName + N'.mdf'
                   WHEN [Type] = 'D'            THEN @DataPath + @DbName + N'_' + LogicalName + N'.ndf'
                   WHEN [Type] = 'L' AND rn = 1 THEN @DataPath + @DbName + N'_log.ldf'
                   WHEN [Type] = 'L'            THEN @DataPath + @DbName + N'_log' + CAST(rn AS nvarchar(5)) + N'.ldf'
                   ELSE @DataPath + @DbName + N'_' + LogicalName
               END
        FROM f
        ORDER BY [Type], rn;

        /* коллизии внутри базы */
        SELECT @Dup = COUNT(*) FROM (SELECT TargetPath FROM #tg GROUP BY TargetPath HAVING COUNT(*) > 1) x;
        IF @Dup > 0 RAISERROR('Коллизия целевых путей файлов внутри базы', 16, 1);

        /* пути, занятые ДРУГОЙ базой на этом инстансе */
        IF EXISTS (
            SELECT 1 FROM #tg t
            JOIN sys.master_files mf ON mf.physical_name = t.TargetPath
            WHERE mf.database_id <> ISNULL(DB_ID(@DbName), -1)
        )
            RAISERROR('Целевой путь файла занят другой базой на этом инстансе', 16, 1);

        /* --- сборка команды --- */
        SELECT @moves = STUFF((
            SELECT ',' + CHAR(13) + CHAR(10) + N'    MOVE N''' + REPLACE(LogicalName, '''', '''''')
                 + N''' TO N''' + REPLACE(TargetPath, '''', '''''') + N''''
            FROM #tg ORDER BY ord
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 3, '');

        SET @restore =
            N'RESTORE DATABASE [' + @esc + N']' + CHAR(13) + CHAR(10) +
            N'FROM DISK = N''' + REPLACE(@Full, '''', '''''') + N'''' + CHAR(13) + CHAR(10) +
            N'WITH' + CHAR(13) + CHAR(10) +
            N'    FILE = ' + CAST(@Position AS nvarchar(10)) + N',' + CHAR(13) + CHAR(10) +
            CASE WHEN @Exists = 1 THEN N'    REPLACE,' + CHAR(13) + CHAR(10) ELSE N'' END +
            @moves + N',' + CHAR(13) + CHAR(10) +
            N'    RECOVERY,' + CHAR(13) + CHAR(10) +
            N'    STATS = 5;';

        /* --- режим отчёта --- */
        IF @Execute = 0
        BEGIN
            INSERT INTO #report VALUES (@DbName, @Act, 'ПЛАН', @SizeGB, NULL,
                CASE WHEN @Exists = 1 THEN N'Текущее содержимое базы будет заменено' ELSE NULL END);
            PRINT N'--- ' + @DbName + N' (' + @Act + N') ---------------------';
            IF @Exists = 1
            BEGIN
                PRINT N'ALTER DATABASE [' + @esc + N'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
                PRINT @restore;
                PRINT N'ALTER DATABASE [' + @esc + N'] SET MULTI_USER;';
            END
            ELSE PRINT @restore;
            PRINT '';

            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        /* --- выполнение --- */
        SET @t = SYSDATETIME();
        PRINT N'>>> ' + CONVERT(varchar(19), GETDATE(), 120) + N'  ' + @Act + N': ' + @DbName;

        IF @Exists = 1
        BEGIN
            /* страховочный бэкап текущего состояния */
            IF @BackupBeforeOverwrite = 1
            BEGIN
                DECLARE @safe nvarchar(600) = @SafetyBackupPath + @DbName + N'_pre_'
                        + CONVERT(varchar(8), GETDATE(), 112) + N'_'
                        + REPLACE(CONVERT(varchar(8), GETDATE(), 108), ':', '') + N'.bak';
                PRINT N'    страховочный бэкап -> ' + @safe;
                EXEC (N'BACKUP DATABASE [' + @esc + N'] TO DISK = N''' + @safe
                    + N''' WITH COPY_ONLY, COMPRESSION, INIT, STATS = 10;');
            END

            EXEC (N'ALTER DATABASE [' + @esc + N'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;');
        END

        EXEC (@restore);

        IF @Exists = 1
            EXEC (N'ALTER DATABASE [' + @esc + N'] SET MULTI_USER;');

        INSERT INTO #report VALUES (@DbName, @Act, 'ГОТОВО', @SizeGB,
            DATEDIFF(SECOND, @t, SYSDATETIME()), NULL);
        PRINT N'<<< ' + CONVERT(varchar(19), GETDATE(), 120) + N'  готово: ' + @DbName;
    END TRY
    BEGIN CATCH
        DECLARE @err nvarchar(1000) = ERROR_MESSAGE();

        /* попытка вернуть базу в рабочий режим, если она осталась в SINGLE_USER */
        BEGIN TRY
            IF EXISTS (SELECT 1 FROM sys.databases
                       WHERE name = @DbName AND user_access_desc = 'SINGLE_USER' AND state_desc = 'ONLINE')
                EXEC (N'ALTER DATABASE [' + @esc + N'] SET MULTI_USER;');
        END TRY
        BEGIN CATCH
            SET @err = @err + N' | Не удалось вернуть MULTI_USER: ' + ERROR_MESSAGE();
        END CATCH

        INSERT INTO #report VALUES (@DbName, ISNULL(@Act, '?'), 'ОШИБКА', NULL, NULL, @err);
        PRINT N'!!! ошибка: ' + @DbName + N' — ' + @err;
    END CATCH

    FETCH NEXT FROM cur INTO @FileName;
END

CLOSE cur;
DEALLOCATE cur;


/* --------------------------- итоги ------------------------------ */
SELECT DbName, Action AS [Действие], Status AS [Результат],
       SizeGB AS [Размер, ГБ], Seconds AS [Секунд], Note AS [Примечание]
FROM #report
ORDER BY CASE Status WHEN 'ОШИБКА' THEN 1 WHEN 'ПЛАН' THEN 2
                     WHEN 'ГОТОВО' THEN 3 ELSE 4 END, DbName;

/* базы, оставшиеся в нештатном состоянии — проверить обязательно */
SELECT name AS [База], state_desc AS [Состояние], user_access_desc AS [Доступ]
FROM sys.databases
WHERE state_desc <> 'ONLINE' OR user_access_desc <> 'MULTI_USER';

/* свободное место (актуально при @UseExistingPaths = 0) */
DECLARE @Need decimal(18,2) = (SELECT ISNULL(SUM(SizeGB), 0) FROM #report WHERE Status = 'ПЛАН');
IF OBJECT_ID('tempdb..#free') IS NOT NULL DROP TABLE #free;
CREATE TABLE #free (Drive char(1), FreeMB int);
INSERT INTO #free EXEC master.dbo.xp_fixeddrives;

SELECT @Need AS [Сумма размеров баз, ГБ],
       Drive AS [Диск],
       CAST(FreeMB / 1024.0 AS decimal(18,2)) AS [Свободно, ГБ]
FROM #free WHERE Drive = LEFT(@DataPath, 1);

DROP TABLE #files, #fl, #tg, #report, #free;
```

## Особенности и подводные камни

- **`REPLACE` необратим без страховки.** Скрипт не проверяет, из какой
  базы на самом деле сделан бэкап — если файл `aspGas.bak` окажется
  бэкапом не той версии или не той базы, `REPLACE` всё равно её накатит.
  Единственная защита от этого — `@BackupBeforeOverwrite` и внимательное
  чтение отчёта на `@Execute = 0` перед реальным запуском.
- **`SINGLE_USER WITH ROLLBACK IMMEDIATE` разрывает вообще все сессии**,
  включая приложения, которые могут в этот момент писать данные —
  открытые транзакции откатываются немедленно, без ожидания. Запускать
  только в согласованное окно обслуживания.
- **AlwaysOn и снапшоты — не автоматизированы намеренно.** Restore базы,
  участвующей в группе доступности, требует отдельной процедуры (снятие
  с реплики, восстановление, добавление обратно) — если попытаться
  прогнать через этот скрипт, он остановится на проверке и не тронет базу.
- **`@UseExistingPaths = 0`** ведёт себя как базовый скрипт — все файлы
  переезжают в `@DataPath`; в этом случае актуальна финальная проверка
  свободного места.
- **Итоговая проверка «баз в нештатном состоянии»** — не пропускайте её:
  она ловит не только базы из этого прогона, а вообще все базы на
  инстансе, которые почему-то остались не в `ONLINE`/`MULTI_USER`
  (например, из-за не связанной с этим скриптом проблемы, которая иначе
  осталась бы незамеченной).
