---
title: Массовое восстановление баз SQL Server из каталога с .bak
tags:
  - SQL Server
  - MSSQL
  - Backup
summary: "T-SQL скрипт для восстановления всех .bak-файлов из каталога на новый инстанс: пропуск уже существующих баз, автоматический MOVE файлов, режим предпросмотра и проверка свободного места."
---

# Массовое восстановление баз SQL Server из каталога с .bak

Когда нужно поднять на новом инстансе сразу десяток-другой баз из каталога
с бэкапами (например, после переноса сервера или разворачивания тестового
стенда), вручную писать `RESTORE DATABASE` под каждый файл — долго и
чревато ошибками в путях. Скрипт ниже делает это одним запуском: читает
список `.bak`-файлов из каталога, для каждого строит корректный
`RESTORE DATABASE ... WITH MOVE` и либо показывает, что будет сделано
(режим отчёта), либо выполняет восстановление.

## Принцип работы

Скрипт проходит по каталогу с бэкапами циклом (`CURSOR`) и на каждой
итерации выполняет следующие шаги.

### 1. Получение списка файлов

Каталог с `.bak`-файлами сканируется через `xp_dirtree` в временную таблицу
`#files`, оставляются только файлы с расширением `.bak`. Если у учётной
записи SQL Server нет прав на `xp_dirtree` (частая ситуация с сетевыми
шарами под доменной учёткой службы), в скрипте есть закомментированный блок
для ручного перечисления имён файлов — достаточно раскомментировать и
подставить свой список.

Параметр `@OnlyDb` позволяет обработать один конкретный файл — полезно,
когда основная масса баз уже восстановлена, а осталась одна крупная и её
хочется гонять отдельно, не трогая остальные.

### 2. Пропуск существующих баз

Перед восстановлением скрипт проверяет `DB_ID(@DbName)`. Если база с таким
именем уже есть на инстансе — она отмечается в отчёте как `ПРОПУСК` и
восстановление для неё не выполняется. **`REPLACE` в `RESTORE DATABASE` не
используется нигде** — это осознанное решение, чтобы случайный повторный
запуск скрипта не затёр рабочую базу поверх уже поднятой.

### 3. Разбор состава backup-файла

Для каждого файла выполняется `RESTORE FILELISTONLY` — это возвращает
список логических файлов внутри бэкапа (данные и лог) с их размерами, без
самого восстановления. Из этого списка скрипт считает, сколько места
потребуется на диске (`SUM([Size])` в гигабайтах).

Параметр `@Position` задаёт номер backup set внутри файла — актуально,
если бэкапы дописываются в один и тот же файл несколько раз подряд
(`BACKUP DATABASE ... TO DISK` без `INIT`). Если не уверены, сколько
наборов в файле, в шапке скрипта есть отдельная команда
`RESTORE HEADERONLY`, которую стоит один раз прогнать вручную: одна строка
в результате — всё чисто, несколько строк — нужно взять `Position`
последней записи с `BackupType = 1` (полный бэкап).

### 4. Генерация MOVE для каждого файла

Восстановление на новый путь требует явного `MOVE 'логическое_имя' TO
'физический_путь'` для каждого файла бэкапа — иначе SQL Server попытается
восстановить файлы туда же, откуда бэкап снимался на исходном сервере, и
упадёт с ошибкой доступа к пути. Скрипт строит список `MOVE` динамически
через `STUFF(... FOR XML PATH(''))`, присваивая файлам предсказуемые имена:
первый файл данных получает `<база>.mdf`, дополнительные — `<база>_<имя>.ndf`,
лог — `<база>_log.ldf` (и `_log2.ldf` и т.д. при нескольких файлах лога).

### 5. Два режима: отчёт и выполнение

Флаг `@Execute` переключает поведение:

- **`@Execute = 0`** — ничего не восстанавливается. Для каждой базы в отчёт
  попадает статус `К ВОССТАНОВЛЕНИЮ`, требуемый объём места, а собранный
  текст `RESTORE DATABASE` печатается через `PRINT` — можно визуально
  проверить пути и имена файлов до реального запуска.
- **`@Execute = 1`** — команда `RESTORE` выполняется через `EXEC (@restore)`,
  прогресс виден по `STATS = 5` (шаг 5%).

Такой порядок — сначала отчёт, потом выполнение — позволяет поймать
проблемы (неверный путь, нехватка места, чужой backup set) до того, как
скрипт начнёт реально писать на диск.

### 6. Проверка свободного места

В конце скрипт считает суммарный объём, необходимый для всех баз со
статусом `К ВОССТАНОВЛЕНИЮ`, и сравнивает его (с запасом ×1.1) со свободным
местом на целевом диске через `xp_fixeddrives`. Если места не хватает —
явно выводится `МЕСТА НЕ ХВАТАЕТ` в столбце «Вердикт».

Все ошибки (например, повреждённый файл или занятый путь) перехватываются
`TRY/CATCH` и попадают в отчёт со статусом `ОШИБКА` и текстом
`ERROR_MESSAGE()`, не прерывая обработку остальных файлов в цикле.

## Как использовать

1. Проверить количество backup set в файлах (если не уверены, что каждый
   бэкап пишется в новый файл):

   ```sql
   RESTORE HEADERONLY FROM DISK = N'\\srvsql-02\d$\072026\aspGas.bak';
   ```

2. Задать в шапке скрипта `@BackupPath` (сетевой путь до каталога с `.bak`,
   обязательно со слэшем в конце) и `@DataPath` (куда класть `.mdf`/`.ldf`
   на целевом инстансе, тоже со слэшем в конце).
3. Прогнать с `@Execute = 0` и проверить отчёт: какие базы будут
   восстановлены, какие пропущены (уже существуют), хватает ли места на
   диске.
4. Убедиться, что в блоке итогов нет `МЕСТА НЕ ХВАТАЕТ`.
5. Поставить `@Execute = 1` и запустить восстановление. При необходимости
   ограничить прогон одной базой — задать `@OnlyDb = N'ИмяБазы'`.

!!! warning "Важно"

    Скрипт не перезаписывает существующие базы — это защита от случайного
    затирания, а не гарантия актуальности данных. Если база уже есть на
    инстансе, но её нужно обновить свежим бэкапом, её сначала нужно
    удалить (`DROP DATABASE`) или переименовать вручную — скрипт такие
    базы просто пропустит.

## Полный скрипт

```sql
/* ================================================================
   Восстановление баз из каталога .bak
   Существующие базы ПРОПУСКАЮТСЯ (перезаписи нет, REPLACE не используется).

   Порядок работы:
     1) @Execute = 0  -> отчёт: что будет восстановлено, сколько нужно места
     2) @Execute = 1  -> восстановление

   @OnlyDb = N'aspGas'  -> обработать только одну базу (для крупных)
   ================================================================ */
SET NOCOUNT ON;

DECLARE @BackupPath nvarchar(260) = N'\\srvsql-02\d$\072026\';   -- слэш в конце обязателен
DECLARE @DataPath   nvarchar(260) = N'E:\Databases\';            -- слэш в конце обязателен
DECLARE @Position   int           = 1;    -- см. блок 0 ниже
DECLARE @Execute    bit           = 0;
DECLARE @OnlyDb     sysname       = NULL; -- NULL = все файлы каталога


/* ---------------------------------------------------------------
   БЛОК 0. Проверка количества backup set в файлах.
   Выполни один раз ОТДЕЛЬНО, если не уверен, что бэкапы пишутся
   в новый файл каждый раз:

       RESTORE HEADERONLY FROM DISK = N'\\srvsql-02\d$\072026\aspGas.bak';

   Одна строка в результате -> @Position = 1, всё в порядке.
   Несколько строк -> возьми Position последней строки с BackupType = 1.
   --------------------------------------------------------------- */


/* --------------------------- список файлов --------------------- */
IF OBJECT_ID('tempdb..#files') IS NOT NULL DROP TABLE #files;
CREATE TABLE #files (FileName nvarchar(260), Depth int, IsFile int);

INSERT INTO #files
EXEC master.sys.xp_dirtree @BackupPath, 1, 1;

DELETE FROM #files WHERE IsFile <> 1 OR FileName NOT LIKE '%.bak';

/* Если xp_dirtree недоступна (нет прав) — закомментируй два блока выше
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
    Status    varchar(30),
    NeedGB    decimal(18,2) NULL,
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


/* --------------------------- цикл по файлам -------------------- */
DECLARE @FileName nvarchar(260), @DbName sysname, @Full nvarchar(520);
DECLARE @sql nvarchar(max), @moves nvarchar(max), @restore nvarchar(max), @NeedGB decimal(18,2);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT FileName FROM #files ORDER BY FileName;

OPEN cur;
FETCH NEXT FROM cur INTO @FileName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @DbName = LEFT(@FileName, LEN(@FileName) - 4);
    SET @Full   = @BackupPath + @FileName;

    BEGIN TRY
        /* --- база уже есть? --- */
        IF DB_ID(@DbName) IS NOT NULL
        BEGIN
            INSERT INTO #report VALUES (@DbName, 'ПРОПУСК', NULL, N'База уже существует на инстансе');
            FETCH NEXT FROM cur INTO @FileName;
            CONTINUE;
        END

        /* --- состав файлов бэкапа --- */
        DELETE FROM #fl;
        SET @sql = N'RESTORE FILELISTONLY FROM DISK = N''' + REPLACE(@Full, '''', '''''')
                 + N''' WITH FILE = ' + CAST(@Position AS nvarchar(10)) + N';';
        INSERT INTO #fl EXEC (@sql);

        SELECT @NeedGB = CAST(SUM([Size]) / 1073741824.0 AS decimal(18,2)) FROM #fl;

        /* --- сборка MOVE с уникальными именами --- */
        SET @moves = NULL;

        ;WITH f AS (
            SELECT LogicalName, [Type],
                   ROW_NUMBER() OVER (PARTITION BY [Type] ORDER BY FileId) AS rn
            FROM #fl
        )
        SELECT @moves = STUFF((
            SELECT ',' + CHAR(13) + CHAR(10) + N'    MOVE N''' + REPLACE(LogicalName, '''', '''''') + N''' TO N'''
                 + @DataPath
                 + CASE
                       WHEN [Type] = 'D' AND rn = 1 THEN @DbName + N'.mdf'
                       WHEN [Type] = 'D'            THEN @DbName + N'_' + LogicalName + N'.ndf'
                       WHEN [Type] = 'L' AND rn = 1 THEN @DbName + N'_log.ldf'
                       WHEN [Type] = 'L'            THEN @DbName + N'_log' + CAST(rn AS nvarchar(5)) + N'.ldf'
                       ELSE @DbName + N'_' + LogicalName
                   END + N''''
            FROM f ORDER BY [Type], rn
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 3, '');

        SET @restore =
            N'RESTORE DATABASE [' + REPLACE(@DbName, ']', ']]') + N']' + CHAR(13) + CHAR(10) +
            N'FROM DISK = N''' + REPLACE(@Full, '''', '''''') + N'''' + CHAR(13) + CHAR(10) +
            N'WITH' + CHAR(13) + CHAR(10) +
            N'    FILE = ' + CAST(@Position AS nvarchar(10)) + N',' + CHAR(13) + CHAR(10) +
            @moves + N',' + CHAR(13) + CHAR(10) +
            N'    RECOVERY,' + CHAR(13) + CHAR(10) +
            N'    STATS = 5;';

        IF @Execute = 0
        BEGIN
            INSERT INTO #report VALUES (@DbName, 'К ВОССТАНОВЛЕНИЮ', @NeedGB, NULL);
            PRINT N'--- ' + @DbName + N' -------------------------------';
            PRINT @restore;
            PRINT '';
        END
        ELSE
        BEGIN
            PRINT N'>>> ' + CONVERT(varchar(19), GETDATE(), 120) + N'  старт: ' + @DbName;
            EXEC (@restore);
            PRINT N'<<< ' + CONVERT(varchar(19), GETDATE(), 120) + N'  готово: ' + @DbName;
            INSERT INTO #report VALUES (@DbName, 'ВОССТАНОВЛЕНА', @NeedGB, NULL);
        END
    END TRY
    BEGIN CATCH
        INSERT INTO #report VALUES (@DbName, 'ОШИБКА', NULL, ERROR_MESSAGE());
    END CATCH

    FETCH NEXT FROM cur INTO @FileName;
END

CLOSE cur;
DEALLOCATE cur;


/* --------------------------- итоги ------------------------------ */
SELECT DbName, Status, NeedGB AS [Требуется, ГБ], Note AS [Примечание]
FROM #report
ORDER BY CASE Status WHEN 'ОШИБКА' THEN 1 WHEN 'К ВОССТАНОВЛЕНИЮ' THEN 2
                     WHEN 'ВОССТАНОВЛЕНА' THEN 3 ELSE 4 END, DbName;

DECLARE @Need decimal(18,2) = (SELECT ISNULL(SUM(NeedGB), 0) FROM #report WHERE Status = 'К ВОССТАНОВЛЕНИЮ');
DECLARE @Drive char(1) = LEFT(@DataPath, 1);

IF OBJECT_ID('tempdb..#free') IS NOT NULL DROP TABLE #free;
CREATE TABLE #free (Drive char(1), FreeMB int);
INSERT INTO #free EXEC master.dbo.xp_fixeddrives;

SELECT
    @Need                                            AS [Нужно всего, ГБ],
    CAST(FreeMB / 1024.0 AS decimal(18,2))           AS [Свободно на диске, ГБ],
    CASE WHEN CAST(FreeMB / 1024.0 AS decimal(18,2)) < @Need * 1.1
         THEN N'МЕСТА НЕ ХВАТАЕТ' ELSE N'ок' END     AS [Вердикт]
FROM #free WHERE Drive = @Drive;

DROP TABLE #files, #fl, #report, #free;
```

## Особенности и подводные камни

- **Без перезаписи.** `REPLACE` нигде не используется — база, которая уже
  существует на инстансе, просто пропускается со статусом `ПРОПУСК`. Это
  безопасно для повторных запусков, но означает, что скрипт не годится для
  «освежения» уже поднятой базы новым бэкапом без ручного `DROP DATABASE`.
- **Права на `xp_dirtree`.** Расширенная процедура требует, чтобы учётная
  запись службы SQL Server имела доступ на чтение сетевого пути. Если прав
  нет — используйте закомментированный блок с ручным списком файлов.
- **Несколько backup set в одном файле.** Если бэкапы дописываются в один
  и тот же `.bak` без `INIT`, `@Position = 1` восстановит самый старый
  набор. Проверяйте `RESTORE HEADERONLY` перед запуском.
- **`xp_fixeddrives`** видит только локальные фиксированные диски — для
  проверки места на сетевом или подключённом через SAN хранилище эта
  проверка не сработает и нужно проверять место иначе.
- **Совместимость колонки `SnapshotUrl`.** Она появилась в `RESTORE
  FILELISTONLY` начиная с SQL Server 2016 (13-я версия); на более старых
  версиях скрипт убирает её из временной таблицы через
  `ALTER TABLE #fl DROP COLUMN SnapshotUrl`.
