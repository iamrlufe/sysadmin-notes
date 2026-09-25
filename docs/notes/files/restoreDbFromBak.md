---
title: Массовое восстановление баз SQL Server из .bak (новые, перезапись, перенос файлов)
tags:
  - SQL Server
  - MSSQL
  - Backup
summary: "Один T-SQL скрипт для восстановления всех .bak из каталога: только новые базы, перезапись существующих (REPLACE) или перенос файлов с системного диска. Пробный запуск, проверка места по каждой базе, страховочный бэкап, защита от AlwaysOn/снапшотов и коллизий путей, ужатие лога."
---

# Массовое восстановление баз SQL Server из .bak

Когда нужно поднять сразу десяток-другой баз из каталога с бэкапами
(перенос сервера, тестовый стенд, освежение копий свежими бэкапами),
писать `RESTORE DATABASE ... WITH MOVE` под каждый файл вручную — долго
и чревато ошибками в путях. Скрипт ниже делает это одним запуском:
читает список `.bak` из каталога, для каждого строит `RESTORE` с
корректными `MOVE`, показывает план и, если всё устраивает,
восстанавливает.

Во всех примерах имена путей и баз — условные (`\\backup-srv\d$\Backups\`,
`E:\Databases\`, `ИмяБазы`). Подставь свои.

## Типовые сценарии

Один скрипт покрывает три задачи — отличаются только параметры:

| Задача | Параметры |
|---|---|
| Поднять базы на новом сервере, существующие не трогать | `@Mode = 'MISSING'` (по умолчанию) |
| Освежить уже развёрнутые базы свежими бэкапами | `@Mode = 'EXISTING'` или `'ALL'`, `@IConfirmOverwrite = 1` |
| То же, но заодно убрать файлы баз с `C:` на диск данных | + `@MoveFrom = N'C:\'` |

!!! danger "Перезапись — разрушительная операция"

    В режимах `ALL` и `EXISTING` для существующих баз выполняется
    `RESTORE ... WITH REPLACE`: текущее содержимое **безвозвратно
    заменяется** данными из бэкапа, все сессии в базе рвутся через
    `ROLLBACK IMMEDIATE`, открытые транзакции откатываются. Без
    страховочного бэкапа (`@BackupBeforeOverwrite = 1`) откатить
    перезапись будет нечем.

## Параметры

| Параметр | По умолчанию | Что делает |
|---|---|---|
| `@BackupPath` | — | Каталог с `.bak`, слэш в конце обязателен. Имя базы = имя файла без `.bak` |
| `@DataPath` | — | Куда класть файлы новых баз (и перенесённых), слэш в конце обязателен. Папка должна существовать |
| `@Position` | `1` | Номер backup set внутри файла (см. [подготовку](#podgotovka)) |
| `@OnlyDb` | `NULL` | Обработать только одну базу — удобно для крупных |
| `@Mode` | `'MISSING'` | `MISSING` — только отсутствующие; `EXISTING` — только перезаписать существующие; `ALL` — и то, и другое |
| `@UseExistingPaths` | `1` | Для существующих баз: `1` — файлы восстанавливаются туда, где лежат сейчас; `0` — все переезжают в `@DataPath` |
| `@MoveFrom` | `NULL` | Например `N'C:\'` — файлы существующих баз с этого диска переносятся в `@DataPath` с прежними именами |
| `@ReserveGB` | `20` | Сколько оставить свободным на диске. Если база не влезает — `SKIP (место)` |
| `@ShrinkLogMB` | `NULL` | Ужать лог после восстановления до указанного размера, `NULL` — не трогать |
| `@BackupBeforeOverwrite` | `0` | `1` — перед перезаписью снять `COPY_ONLY` бэкап текущей базы в `@SafetyBackupPath` |
| `@Execute` | `0` | `0` — только план и тексты команд; `1` — восстанавливать |
| `@IConfirmOverwrite` | `0` | Отдельное подтверждение перезаписи. Без него `@Execute = 1` в режимах `ALL`/`EXISTING` не запустится |

## Куда попадают файлы

Для каждого файла бэкапа скрипт ищет соответствующий файл текущей базы
в `sys.master_files` — по логическому имени, а если не нашёл, по
`file_id`. Дальше решает так (колонка `Src` в плане):

| `Src` | Когда | Куда |
|---|---|---|
| `new` | Базы (или такого файла в ней) на сервере нет | `@DataPath` + `<база>.mdf`, `<база>_log.ldf`, `<база>_<логическое имя>.ndf`, `<база>_log2.ldf`… |
| `moved` | Файл лежит на диске `@MoveFrom` | `@DataPath` + прежнее имя файла |
| `in-place` | `@UseExistingPaths = 1` | Туда же, где файл лежит сейчас |
| `to-datapath` | `@UseExistingPaths = 0` | `@DataPath` + имя по той же схеме, что и для `new` |

## Защитные механизмы

- **Пробный запуск.** `@Execute = 0` ничего не меняет: выводит план по
  каждому файлу, готовые команды `RESTORE` (с `SINGLE_USER`/`MULTI_USER`
  вокруг для существующих баз) и прикидку места по дискам.
- **Двойное подтверждение перезаписи.** Для `ALL`/`EXISTING` одного
  `@Execute = 1` мало — нужен ещё `@IConfirmOverwrite = 1`, иначе скрипт
  останавливается до любых действий.
- **Проверка места перед каждой базой.** Учитывается, что при
  перезаписи на месте старые файлы переиспользуются — нужен только
  прирост. Не влезает — база пропускается со статусом `SKIP (место)`.
- **Базы, которые трогать нельзя.** Если у базы есть database snapshot
  или она в группе доступности AlwaysOn — `ОШИБКА`, база не трогается.
- **Коллизии путей.** Два файла бэкапа в один путь или путь, занятый
  файлом **другой** базы на сервере, — `ОШИБКА` до восстановления.
- **Страховочный бэкап.** `@BackupBeforeOverwrite = 1` снимает
  `COPY_ONLY` сжатый бэкап текущего состояния базы — цепочку обычных
  бэкапов он не ломает.
- **Ошибка одной базы не останавливает остальные.** Если сбой случился
  после `SINGLE_USER`, скрипт пытается вернуть базу в `MULTI_USER`.
- **Итоговая проверка.** В конце выводятся все базы на сервере не в
  `ONLINE`/`MULTI_USER` — даже те, что не участвовали в прогоне.

## Подготовка { #podgotovka }

1. Убедиться, что папка `@DataPath` существует — `RESTORE` сам папки не
   создаёт.
2. Проверить, что служба SQL Server видит путь к бэкапам и у её учётной
   записи есть права на чтение. Если `xp_dirtree` ничего не вернёт,
   скрипт остановится с сообщением «В папке не найдено .bak». Если прав
   на `xp_dirtree` нет — в скрипте есть закомментированный блок для
   ручного списка файлов.
3. Проверить количество backup set в файлах, если нет уверенности, что
   каждый бэкап пишется в новый файл:

    ```sql
    RESTORE HEADERONLY FROM DISK = N'\\backup-srv\d$\Backups\ИмяБазы.bak';
    ```

    Одна строка — `@Position = 1`. Несколько строк — возьми `Position`
    последней строки с `BackupType = 1` (полный бэкап). Ошибка здесь при
    перезаписи = актуальные данные заменятся старым набором.

4. Если будут перезаписываться существующие базы — убедиться, что их
   можно перезаписывать, и предупредить пользователей: сессии будут
   принудительно отключены.

!!! tip "Запускать через SQL Agent"

    Восстановление большого набора баз может занять несколько часов.
    Надёжнее запускать скрипт шагом задания SQL Server Agent — тогда обрыв
    RDP или закрытие SSMS его не прервут.

## Шаг 1. Пробный запуск

1. Открыть SSMS, подключиться к целевому серверу, новое окно запроса
   (база `master`).
2. Вставить скрипт из раздела «Полный скрипт» ниже целиком, задать
   параметры, оставить `@Execute = 0`.
3. Выполнить (F5) и проверить:
    - первая таблица — итог по базам: действие (`СОЗДАНИЕ` /
      `ПЕРЕЗАПИСЬ` / `ПРОПУСК`), размер, предупреждения о месте;
    - вторая — план по файлам: колонки `Src` и `Target` должны
      совпадать с ожиданиями;
    - третья — место по дискам: сколько нужно на всё и сколько
      свободно;
    - вкладка «Сообщения» — готовые команды `RESTORE` по каждой базе.

Если что-то не совпадает с ожиданиями — боевой запуск не делать.

## Шаг 2. Боевой запуск

1. Поставить `@Execute = 1` (и `@IConfirmOverwrite = 1`, если режим
   с перезаписью).
2. Выполнить (F5).
3. Ход работы — во вкладке «Сообщения»: `=== <база> (<действие>):
   восстановление...`, проценты от `STATS = 10`, затем `<база>: OK`.
4. По окончании — итоговая таблица и список баз в нештатном состоянии
   (должен быть пустым).

| Результат | Что значит | Что делать |
|---|---|---|
| `ГОТОВО` | База восстановлена | Ничего. В примечании могут быть предупреждения (`лог не ужат`) |
| `ПРОПУСК` | База не подходит под `@Mode` | Ничего |
| `SKIP (место)` | Не хватило места, база не трогалась | Освободить место, запустить повторно |
| `ОШИБКА` | Ошибка чтения бэкапа, проверок или `RESTORE`, текст в примечании | Разобрать ошибку, запустить повторно |

## Нехватка места и повторный запуск

Если часть баз получила `SKIP (место)`:

1. Освободить место на целевом диске. Если там лежит большая база с
   кучей пустоты внутри — её можно ужать порциями, см.
   [«Контроль хода DBCC SHRINKFILE»](shrinkProgress.md).
2. Запустить скрипт повторно с `@Mode = 'MISSING'` — восстановятся только
   базы, которых ещё нет на сервере. Не повторяй прогон с `ALL`: он
   заново перезапишет уже восстановленные базы.

!!! warning "Базы со статусом ОШИБКА"

    Если база упала с ошибкой посреди `RESTORE` и осталась на сервере в
    состоянии `RESTORING`/`SUSPECT`, режим `MISSING` её пропустит — она
    ведь «есть». Такую базу нужно удалить вручную или восстановить
    отдельной командой из вывода пробного запуска.

## Проверка после восстановления

1. Базы на месте и в состоянии `ONLINE`:

    ```sql
    SELECT name, state_desc, user_access_desc, is_read_only, recovery_model_desc
    FROM sys.databases
    WHERE database_id > 4
    ORDER BY name;
    ```

2. При переносе с `C:` — у восстановленных баз не осталось файлов на
   старом диске (запрос должен вернуть пусто):

    ```sql
    SELECT DB_NAME(database_id) AS db, name, physical_name
    FROM sys.master_files
    WHERE database_id > 4
      AND physical_name LIKE N'C:\%';
    ```

3. Проверить старую папку данных на `C:` на файлы перенесённых баз.
   Удаляет ли их SQL Server при переносе через `RESTORE ... WITH REPLACE,
   MOVE`, не проверено. Если файлы остались, а запрос из п. 2 для этих
   баз пустой — их можно удалить вручную.
4. Если часть баз должна быть «только для чтения» (закрытые архивные
   периоды) — проверить `is_read_only` из п. 1 и при необходимости
   выставить `ALTER DATABASE [..] SET READ_ONLY`.

## Полный скрипт

Параметры меняются только в блоке в начале.

```sql
/* ================================================================
   Массовое восстановление баз из каталога .bak

   1) @Execute = 0 -> план, команды и прикидка места, ничего не меняется
   2) @Execute = 1 -> восстановление
      (для @Mode = 'ALL' / 'EXISTING' ещё и @IConfirmOverwrite = 1)

   ВНИМАНИЕ: для существующих баз выполняется
       ALTER DATABASE ... SET SINGLE_USER WITH ROLLBACK IMMEDIATE
       RESTORE DATABASE ... WITH REPLACE
   Текущие данные этих баз будут БЕЗВОЗВРАТНО заменены содержимым бэкапа.
   ================================================================ */
SET NOCOUNT ON;

/* --------------------------- параметры ------------------------- */
DECLARE @BackupPath  nvarchar(260) = N'\\backup-srv\d$\Backups\';  -- слэш в конце обязателен
DECLARE @DataPath    nvarchar(260) = N'E:\Databases\';             -- слэш в конце обязателен
DECLARE @Position    int           = 1;       -- номер backup set, см. RESTORE HEADERONLY
DECLARE @OnlyDb      sysname       = NULL;    -- NULL = все файлы каталога

DECLARE @Mode        varchar(10)   = 'MISSING';
        -- 'MISSING'  - только базы, которых нет на сервере (перезаписи нет)
        -- 'EXISTING' - только перезаписать существующие
        -- 'ALL'      - отсутствующие создать, существующие перезаписать

DECLARE @UseExistingPaths bit      = 1;       -- существующие базы: 1 = файлы остаются на своих местах
                                              --                    0 = все файлы переезжают в @DataPath
DECLARE @MoveFrom    nvarchar(3)   = NULL;    -- N'C:\' = файлы существующих баз с этого диска
                                              -- переносятся в @DataPath (имена файлов прежние)

DECLARE @ReserveGB   int           = 20;      -- сколько оставить свободным на диске
DECLARE @ShrinkLogMB int           = NULL;    -- 1024 = ужать лог после восстановления, NULL = не трогать

DECLARE @BackupBeforeOverwrite bit = 0;       -- 1 = COPY_ONLY бэкап базы перед перезаписью
DECLARE @SafetyBackupPath nvarchar(260) = N'E:\SafetyBackup\';

DECLARE @Execute           bit     = 0;       -- 0 = только план, 1 = восстанавливать
DECLARE @IConfirmOverwrite bit     = 0;       -- 1 = подтверждаю перезапись существующих баз


/* --------------------------- предохранители -------------------- */
IF @Mode NOT IN ('ALL', 'EXISTING', 'MISSING')
BEGIN
    RAISERROR(N'@Mode должен быть ALL, EXISTING или MISSING', 16, 1);
    RETURN;
END

IF RIGHT(@BackupPath, 1) <> N'\' OR RIGHT(@DataPath, 1) <> N'\'
BEGIN
    RAISERROR(N'@BackupPath и @DataPath должны заканчиваться на \', 16, 1);
    RETURN;
END

IF @Execute = 1 AND @Mode IN ('ALL', 'EXISTING') AND @IConfirmOverwrite = 0
BEGIN
    RAISERROR(N'Режим %s перезаписывает существующие базы. Поставь @IConfirmOverwrite = 1, если это осознанное решение.', 16, 1, @Mode);
    RETURN;
END


/* --------------------------- список файлов --------------------- */
IF OBJECT_ID('tempdb..#files') IS NOT NULL DROP TABLE #files;
CREATE TABLE #files (FileName nvarchar(260), Depth int, IsFile int);

INSERT INTO #files
EXEC master.sys.xp_dirtree @BackupPath, 1, 1;

DELETE FROM #files WHERE IsFile <> 1 OR FileName NOT LIKE N'%.bak';

/* Если xp_dirtree недоступна (нет прав) — закомментируй два блока выше
   и раскомментируй ручной список:

   INSERT INTO #files (FileName, Depth, IsFile) VALUES
     (N'Base1.bak', 1, 1),
     (N'Base2.bak', 1, 1);
*/

IF @OnlyDb IS NOT NULL
    DELETE FROM #files WHERE LEFT(FileName, LEN(FileName) - 4) <> @OnlyDb;

IF NOT EXISTS (SELECT 1 FROM #files)
BEGIN
    RAISERROR(N'В папке не найдено .bak — SQL Server не видит путь или нет прав на чтение', 16, 1);
    RETURN;
END


/* --------------------------- служебные таблицы ----------------- */
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
CREATE TABLE #tg (
    ord int IDENTITY(1,1), LogicalName nvarchar(128), [Type] char(1),
    SizeMB numeric(20,1), CurPath nvarchar(520), CurMB numeric(20,1),
    TargetPath nvarchar(520), Src varchar(20), NeedMB numeric(20,1)
);

IF OBJECT_ID('tempdb..#plan') IS NOT NULL DROP TABLE #plan;
CREATE TABLE #plan (
    ord int IDENTITY(1,1), DbName sysname, Action varchar(20), LogicalName nvarchar(128),
    [Type] char(1), SizeMB numeric(20,1), Src varchar(20), TargetPath nvarchar(520), NeedMB numeric(20,1)
);

IF OBJECT_ID('tempdb..#need') IS NOT NULL DROP TABLE #need;
CREATE TABLE #need (Drive char(1), NeedMB numeric(20,1));

IF OBJECT_ID('tempdb..#drv') IS NOT NULL DROP TABLE #drv;
CREATE TABLE #drv (Drive char(1), FreeMB int);

IF OBJECT_ID('tempdb..#report') IS NOT NULL DROP TABLE #report;
CREATE TABLE #report (
    DbName sysname, Action varchar(20), Status varchar(20),
    SizeGB decimal(18,2) NULL, Seconds int NULL, Note nvarchar(2000) NULL
);


/* --------------------------- цикл по файлам -------------------- */
DECLARE @FileName nvarchar(260), @DbName sysname, @Full nvarchar(520), @esc nvarchar(258);
DECLARE @sql nvarchar(max), @moves nvarchar(max), @restore nvarchar(max);
DECLARE @msg nvarchar(2000), @err nvarchar(2000), @safe nvarchar(600);
DECLARE @Exists bit, @Act varchar(20), @SizeGB decimal(18,2), @t datetime2;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT FileName FROM #files ORDER BY FileName;

OPEN cur;
FETCH NEXT FROM cur INTO @FileName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @DbName = LEFT(@FileName, LEN(@FileName) - 4);
    SET @DbName = ISNULL(DB_NAME(DB_ID(@DbName)), @DbName);   -- регистр имени как на сервере
    SET @Full   = @BackupPath + @FileName;
    SET @Exists = CASE WHEN DB_ID(@DbName) IS NULL THEN 0 ELSE 1 END;
    SET @Act    = CASE WHEN @Exists = 1 THEN 'ПЕРЕЗАПИСЬ' ELSE 'СОЗДАНИЕ' END;
    SET @esc    = QUOTENAME(@DbName);
    SET @SizeGB = NULL;
    SET @msg    = NULL;

    BEGIN TRY
        /* --- фильтр по режиму --- */
        IF (@Exists = 1 AND @Mode = 'MISSING') OR (@Exists = 0 AND @Mode = 'EXISTING')
        BEGIN
            INSERT INTO #report VALUES (@DbName, 'ПРОПУСК', 'ПРОПУСК', NULL, NULL,
                CASE WHEN @Exists = 1 THEN N'База уже есть, режим MISSING'
                     ELSE N'Базы нет, режим EXISTING' END);
            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        /* --- состояния, при которых restore невозможен --- */
        IF @Exists = 1
        BEGIN
            IF EXISTS (SELECT 1 FROM sys.databases WHERE source_database_id = DB_ID(@DbName))
                RAISERROR(N'У базы есть database snapshot — сначала удали снимки', 16, 1);

            IF EXISTS (SELECT 1 FROM sys.databases WHERE database_id = DB_ID(@DbName) AND replica_id IS NOT NULL)
                RAISERROR(N'База в группе доступности AlwaysOn — этим скриптом не восстанавливается', 16, 1);
        END

        /* --- состав файлов бэкапа --- */
        DELETE FROM #fl;
        SET @sql = N'RESTORE FILELISTONLY FROM DISK = N''' + REPLACE(@Full, N'''', N'''''')
                 + N''' WITH FILE = ' + CAST(@Position AS nvarchar(10)) + N';';
        INSERT INTO #fl EXEC (@sql);

        SELECT @SizeGB = CAST(SUM([Size]) / 1073741824.0 AS decimal(18,2)) FROM #fl;

        /* --- целевые пути файлов --- */
        DELETE FROM #tg;

        ;WITH f AS (
            SELECT fl.LogicalName, fl.[Type], fl.FileId, fl.[Size],
                   ROW_NUMBER() OVER (PARTITION BY fl.[Type] ORDER BY fl.FileId) AS rn,
                   COALESCE(mf1.physical_name, mf2.physical_name) AS cur,
                   COALESCE(mf1.size, mf2.size) / 128.0          AS curmb
            FROM #fl fl
            LEFT JOIN sys.master_files mf1
                   ON mf1.database_id = DB_ID(@DbName) AND mf1.name = fl.LogicalName
            LEFT JOIN sys.master_files mf2
                   ON mf2.database_id = DB_ID(@DbName) AND mf2.file_id = fl.FileId
                  AND mf1.name IS NULL
        ), g AS (
            SELECT f.*,
                   @DataPath + @DbName
                 + CASE WHEN [Type] = 'L' AND rn = 1 THEN N'_log.ldf'
                        WHEN [Type] = 'L'            THEN N'_log' + CAST(rn AS nvarchar(5)) + N'.ldf'
                        WHEN [Type] = 'D' AND rn = 1 THEN N'.mdf'
                        WHEN [Type] = 'D'            THEN N'_' + LogicalName + N'.ndf'
                        ELSE N'_' + LogicalName END AS gen,
                   CASE WHEN cur IS NULL THEN 'new'
                        WHEN @MoveFrom IS NOT NULL AND LEFT(cur, LEN(@MoveFrom)) = @MoveFrom THEN 'moved'
                        WHEN @UseExistingPaths = 1 THEN 'in-place'
                        ELSE 'to-datapath' END AS src
            FROM f
        )
        INSERT INTO #tg (LogicalName, [Type], SizeMB, CurPath, CurMB, TargetPath, Src)
        SELECT LogicalName, [Type], [Size] / 1048576.0, cur, curmb,
               CASE src WHEN 'moved'    THEN @DataPath + RIGHT(cur, CHARINDEX(N'\', REVERSE(cur)) - 1)
                        WHEN 'in-place' THEN cur
                        ELSE gen END,
               src
        FROM g
        ORDER BY FileId;

        /* сколько места реально нужно: при перезаписи на месте — только прирост */
        UPDATE #tg SET NeedMB =
            CASE WHEN TargetPath = CurPath
                 THEN CASE WHEN SizeMB > CurMB THEN SizeMB - CurMB ELSE 0 END
                 ELSE SizeMB END;

        /* --- коллизии путей --- */
        IF EXISTS (SELECT 1 FROM #tg GROUP BY TargetPath HAVING COUNT(*) > 1)
            RAISERROR(N'Два файла бэкапа попадают в один и тот же путь', 16, 1);

        IF EXISTS (SELECT 1 FROM #tg t
                   JOIN sys.master_files mf ON mf.physical_name = t.TargetPath
                   WHERE mf.database_id <> ISNULL(DB_ID(@DbName), -1))
            RAISERROR(N'Целевой путь файла занят другой базой на этом сервере', 16, 1);

        INSERT INTO #plan (DbName, Action, LogicalName, [Type], SizeMB, Src, TargetPath, NeedMB)
        SELECT @DbName, @Act, LogicalName, [Type], SizeMB, Src, TargetPath, NeedMB
        FROM #tg ORDER BY ord;

        /* --- сборка команды --- */
        SET @moves = STUFF((
            SELECT N',' + CHAR(13) + CHAR(10) + N'    MOVE N''' + REPLACE(LogicalName, N'''', N'''''')
                 + N''' TO N''' + REPLACE(TargetPath, N'''', N'''''') + N''''
            FROM #tg ORDER BY ord
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 3, N'');

        SET @restore =
            N'RESTORE DATABASE ' + @esc + CHAR(13) + CHAR(10) +
            N'FROM DISK = N''' + REPLACE(@Full, N'''', N'''''') + N'''' + CHAR(13) + CHAR(10) +
            N'WITH' + CHAR(13) + CHAR(10) +
            N'    FILE = ' + CAST(@Position AS nvarchar(10)) + N',' + CHAR(13) + CHAR(10) +
            CASE WHEN @Exists = 1 THEN N'    REPLACE,' + CHAR(13) + CHAR(10) ELSE N'' END +
            @moves + N',' + CHAR(13) + CHAR(10) +
            N'    RECOVERY,' + CHAR(13) + CHAR(10) +
            N'    STATS = 10;';

        /* --- хватает ли места под эту базу --- */
        DELETE FROM #need;
        INSERT INTO #need (Drive, NeedMB)
        SELECT LEFT(TargetPath, 1), SUM(NeedMB) FROM #tg GROUP BY LEFT(TargetPath, 1);

        TRUNCATE TABLE #drv;
        INSERT INTO #drv EXEC master.sys.xp_fixeddrives;

        SELECT @msg = ISNULL(@msg + N'; ', N'') + n.Drive + N': нужно '
                    + CAST(CAST(n.NeedMB / 1024 AS decimal(18,1)) AS nvarchar(20)) + N' ГБ, свободно '
                    + CAST(CAST(d.FreeMB / 1024.0 AS decimal(18,1)) AS nvarchar(20)) + N' ГБ'
        FROM #need n
        JOIN #drv d ON d.Drive = n.Drive
        WHERE d.FreeMB - @ReserveGB * 1024 < n.NeedMB;

        /* --- режим плана --- */
        IF @Execute = 0
        BEGIN
            INSERT INTO #report VALUES (@DbName, @Act, 'ПЛАН', @SizeGB, NULL,
                CASE WHEN @msg IS NOT NULL THEN N'Места может не хватить: ' + @msg END);
            PRINT N'--- ' + @DbName + N' (' + @Act + N') ---------------------';
            IF @Exists = 1 PRINT N'ALTER DATABASE ' + @esc + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
            PRINT @restore;
            IF @Exists = 1 PRINT N'ALTER DATABASE ' + @esc + N' SET MULTI_USER;';
            PRINT N'';

            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        /* --- выполнение --- */
        IF @msg IS NOT NULL
        BEGIN
            INSERT INTO #report VALUES (@DbName, @Act, 'SKIP (место)', @SizeGB, NULL, @msg);
            RAISERROR(N'%s — ПРОПУЩЕНА, не хватает места: %s', 0, 1, @DbName, @msg) WITH NOWAIT;
            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        SET @t = SYSDATETIME();
        RAISERROR(N'=== %s (%s): восстановление...', 0, 1, @DbName, @Act) WITH NOWAIT;

        IF @Exists = 1
        BEGIN
            /* страховочный бэкап текущего состояния */
            IF @BackupBeforeOverwrite = 1
            BEGIN
                SET @safe = @SafetyBackupPath + @DbName + N'_pre_'
                          + CONVERT(varchar(8), GETDATE(), 112) + N'_'
                          + REPLACE(CONVERT(varchar(8), GETDATE(), 108), ':', '') + N'.bak';
                RAISERROR(N'    страховочный бэкап -> %s', 0, 1, @safe) WITH NOWAIT;
                SET @sql = N'BACKUP DATABASE ' + @esc + N' TO DISK = N''' + REPLACE(@safe, N'''', N'''''')
                         + N''' WITH COPY_ONLY, COMPRESSION, INIT, STATS = 10;';
                EXEC (@sql);
            END

            SET @sql = N'ALTER DATABASE ' + @esc + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE;';
            EXEC (@sql);
        END

        EXEC (@restore);

        IF @Exists = 1
        BEGIN
            BEGIN TRY
                SET @sql = N'ALTER DATABASE ' + @esc + N' SET MULTI_USER;';
                EXEC (@sql);
            END TRY
            BEGIN CATCH
                SET @msg = N'MULTI_USER не выставлен: ' + ERROR_MESSAGE();
                RAISERROR(N'%s: %s', 0, 1, @DbName, @msg) WITH NOWAIT;
            END CATCH
        END

        /* --- ужатие лога --- */
        IF @ShrinkLogMB IS NOT NULL
           AND DATABASEPROPERTYEX(@DbName, 'Updateability') = 'READ_WRITE'
        BEGIN
            SET @sql = N'USE ' + @esc + N'; CHECKPOINT;';
            SELECT @sql = @sql + N' DBCC SHRINKFILE (N''' + REPLACE(LogicalName, N'''', N'''''') + N''', '
                        + CAST(@ShrinkLogMB AS nvarchar(20)) + N') WITH NO_INFOMSGS;'
            FROM #tg WHERE [Type] = 'L';

            BEGIN TRY
                EXEC (@sql);
            END TRY
            BEGIN CATCH
                SET @msg = ISNULL(@msg + N' | ', N'') + N'лог не ужат: ' + ERROR_MESSAGE();
                RAISERROR(N'%s: лог не ужат', 0, 1, @DbName) WITH NOWAIT;
            END CATCH
        END

        INSERT INTO #report VALUES (@DbName, @Act, 'ГОТОВО', @SizeGB,
            DATEDIFF(SECOND, @t, SYSDATETIME()), @msg);
        RAISERROR(N'%s: OK', 0, 1, @DbName) WITH NOWAIT;
    END TRY
    BEGIN CATCH
        SET @err = ERROR_MESSAGE();

        /* вернуть базу в рабочий режим, если она осталась в SINGLE_USER */
        BEGIN TRY
            IF EXISTS (SELECT 1 FROM sys.databases
                       WHERE name = @DbName AND user_access_desc = 'SINGLE_USER' AND state_desc = 'ONLINE')
            BEGIN
                SET @sql = N'ALTER DATABASE ' + @esc + N' SET MULTI_USER;';
                EXEC (@sql);
            END
        END TRY
        BEGIN CATCH
            SET @err = @err + N' | MULTI_USER не вернулся: ' + ERROR_MESSAGE();
        END CATCH

        INSERT INTO #report VALUES (@DbName, @Act, 'ОШИБКА', @SizeGB, NULL, @err);
        RAISERROR(N'%s: ОШИБКА — %s', 0, 1, @DbName, @err) WITH NOWAIT;
    END CATCH

    FETCH NEXT FROM cur INTO @FileName;
END

CLOSE cur;
DEALLOCATE cur;


/* --------------------------- итоги ------------------------------ */
SELECT DbName AS [База], Action AS [Действие], Status AS [Результат],
       SizeGB AS [Размер, ГБ], Seconds AS [Секунд], Note AS [Примечание]
FROM #report
ORDER BY CASE Status WHEN 'ОШИБКА' THEN 1 WHEN 'SKIP (место)' THEN 2 WHEN 'ПЛАН' THEN 3
                     WHEN 'ГОТОВО' THEN 4 ELSE 5 END, DbName;

IF @Execute = 0
BEGIN
    /* план по файлам */
    SELECT DbName AS [База], Action AS [Действие], LogicalName, [Type], SizeMB, Src, TargetPath AS Target
    FROM #plan ORDER BY ord;

    /* место по дискам на весь прогон */
    TRUNCATE TABLE #drv;
    INSERT INTO #drv EXEC master.sys.xp_fixeddrives;

    SELECT n.Drive AS [Диск],
           CAST(n.NeedMB / 1024 AS decimal(18,1))   AS [Нужно всего, ГБ],
           CAST(d.FreeMB / 1024.0 AS decimal(18,1)) AS [Свободно, ГБ],
           CASE WHEN d.FreeMB IS NULL THEN N'диск не виден xp_fixeddrives — проверь вручную'
                WHEN d.FreeMB - @ReserveGB * 1024 < n.NeedMB THEN N'НА ВСЁ НЕ ХВАТИТ — часть баз уйдёт в SKIP'
                ELSE N'ок' END                      AS [Вердикт]
    FROM (SELECT LEFT(TargetPath, 1) AS Drive, SUM(NeedMB) AS NeedMB
          FROM #plan GROUP BY LEFT(TargetPath, 1)) n
    LEFT JOIN #drv d ON d.Drive = n.Drive;
END

/* базы в нештатном состоянии — проверить обязательно */
SELECT name AS [База], state_desc AS [Состояние], user_access_desc AS [Доступ]
FROM sys.databases
WHERE state_desc <> 'ONLINE' OR user_access_desc <> 'MULTI_USER';

DROP TABLE #files, #fl, #tg, #plan, #need, #drv, #report;
```

## Особенности и подводные камни

- **`REPLACE` не проверяет, что внутри бэкапа.** Если `ИмяБазы.bak`
  окажется бэкапом не той базы или не той даты, он всё равно будет
  накатан. Защита — только внимательное чтение плана на `@Execute = 0`
  и `@BackupBeforeOverwrite = 1`.
- **`SINGLE_USER WITH ROLLBACK IMMEDIATE` рвёт все сессии**, включая
  приложения, которые в этот момент пишут данные. Запускать только в
  согласованное окно. Если сервер приложений (например, 1С)
  переподключается мгновенно, он может занять единственное подключение
  раньше `RESTORE` — тогда будет ошибка «exclusive access could not be
  obtained»; остановить службу приложения и запустить повторно.
- **AlwaysOn и снапшоты не автоматизированы намеренно.** Восстановление
  базы из группы доступности требует отдельной процедуры (вывести из AG,
  восстановить, вернуть) — скрипт такие базы не трогает.
- **Несколько backup set в одном файле.** Если бэкапы дописываются в
  один `.bak` без `INIT`, `@Position = 1` восстановит самый **старый**
  набор. Проверяй `RESTORE HEADERONLY`.
- **Права на `xp_dirtree`.** Учётная запись службы SQL Server должна
  иметь доступ на чтение сетевого пути. Нет прав — ручной список файлов.
- **`xp_fixeddrives` видит только буквы локальных дисков.** Для точек
  монтирования и путей на SAN без буквы проверка места не сработает —
  такие диски помечаются «проверь вручную» и **не блокируют**
  восстановление.
- **Проверка места — по одной базе.** Во время боевого прогона каждая
  база проверяется отдельно перед своим `RESTORE`, поэтому крупная база
  может уйти в `SKIP`, а следующие мелкие — восстановиться.
- **Страховочный бэкап использует `COMPRESSION`.** На Express Edition
  сжатие недоступно — убери `COMPRESSION` из команды. Место под
  страховочный бэкап скрипт не проверяет.
- **`SnapshotUrl`.** Колонка появилась в `RESTORE FILELISTONLY` в SQL
  Server 2016 — на более старых версиях скрипт убирает её из временной
  таблицы.
- **После восстановления** крупных баз 1С полезно обновить статистику —
  см. [«Реиндексация и обновление статистики»](sqlReindexStats.md).
