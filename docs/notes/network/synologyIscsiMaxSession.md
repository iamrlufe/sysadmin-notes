---
title: iSCSI-диски не подключились после перезагрузки Windows Server (Synology NAS)
tags:
  - iSCSI
  - Synology
  - Windows Server
  - SAN
summary: "После перезагрузки Windows Server не переподключились iSCSI-диски Synology NAS — таргет циклически падает с ошибкой max session reached. Причина — рассинхронизация счётчика сессий в DSM, решение — reset TPG через configfs."
---

# iSCSI-диски не подключились после перезагрузки Windows Server (Synology NAS)

## Симптомы

- После перезагрузки Windows Server пропали ранее подключённые по iSCSI диски (Synology NAS).
- В Диспетчере дисков диски отсутствуют полностью.
- В iSCSI Initiator (`iscsicpl.exe`) → вкладка **Конечные объекты** — таргет находится в состоянии «Восстановление соединения…», циклически (раз в минуту) пытается переподключиться и падает.
- В журнале Windows (Event Viewer → System, источник `iScsiPrt`) — событие:

```text
Конечный объект вернул недопустимый пакет ответа входа. Пакет ответа входа содержится в данных дампа. (Target returned an invalid Login Response packet.)
```

- В SAN Manager на Synology (Журнал) — повторяющиеся Warning-события каждую минуту:

```text
Initiator [<initiator-iqn>] failed to login to iSCSI Target [Target-1] due to max session reached.
```

---

## Диагностика

Диагностика проводилась по SSH на Synology NAS (`root`).

### Шаг 1. Найти таргет в configfs

Стандартный `targetcli` в DSM отсутствует — используется прямой доступ через `configfs`:

```bash
ls /sys/kernel/config/target/iscsi/
```

Показал целевой таргет `<target-iqn>`.

### Шаг 2. Проверить ACL конкретного инициатора

```bash
ls /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/acls/
cat /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/acls/<initiator-iqn>/info
```

Результат:

```text
No active iSCSI Session for Initiator Endpoint: <initiator-iqn>
```

→ На уровне ядра (LIO) реальной активной сессии не было.

### Шаг 3. Проверить лимит сессий на TPG

```bash
cat /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/max_session
```

Результат: `1` — на таргете разрешена ровно одна одновременная сессия (без MPIO).

---

## Причина

При перезагрузке Windows-сервера iSCSI-сессия оборвалась некорректно — без штатного
logout, например из-за резкого выключения ОС или кратковременного сбоя сети в этот
момент. В результате:

- На уровне ядра Linux (LIO/configfs) сессия была корректно очищена — `info` показывал «No active session».
- Но на уровне демона управления iSCSI Target'ом в DSM (надстройка Synology над LIO) внутренний счётчик занятых сессий не обнулился — остался «призрачный» слот, формально считавшийся занятым.
- Поскольку `max_session = 1`, единственный разрешённый слот считался занятым несуществующей сессией, и каждая новая попытка логина от Windows отклонялась с ошибкой `max session reached`.

Это типичный сценарий при «грязных» перезагрузках или сетевых сбоях во время активной
iSCSI-сессии: рассинхронизация состояния между демоном управления DSM и реальным
состоянием ядра.

---

## Решение

Программный сброс (реинициализация) Target Portal Group напрямую через `configfs` —
эквивалент Disable/Enable таргета в SAN Manager, но выполненный на уровне ядра:

```bash
echo 0 > /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/enable
sleep 3
echo 1 > /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/enable
```

После выполнения команд Windows-сервер (при следующей автоматической попытке
подключения, раз в минуту, либо после ручного Connect в iSCSI Initiator) успешно
залогинился на таргет, диски появились в Диспетчере дисков.

!!! warning "Важно при повторении"

    - Команда `enable 0` кратковременно (на пару секунд) обрывает все активные сессии на данном TPG. Перед выполнением на продакшн-таргете стоит убедиться, что нет других живых клиентов, для которых обрыв будет критичен.
    - Если к таргету может параллельно подключаться несколько хостов или используется MPIO — стоит увеличить `max_session` с 1 до 2+, чтобы избежать повторения проблемы:

    ```bash
    echo 2 > /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/max_session
    ```

---

## Быстрая шпаргалка

1. В SAN Manager → Журнал искать точный текст ошибки (не полагаться на обрезанный текст в списке — открывать/наводить на строку).
2. Если ошибка `max session reached`, а на Windows-стороне точно не открыто несколько сессий одновременно — проверить состояние ACL на NAS:

    ```bash
    cat /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/acls/<initiator-iqn>/info
    ```

3. Если там `No active iSCSI Session`, но ошибка `max session reached` продолжается — сделать reset TPG:

    ```bash
    echo 0 > /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/enable
    sleep 3
    echo 1 > /sys/kernel/config/target/iscsi/<target-iqn>/tpgt_1/enable
    ```

4. Альтернатива без SSH: **SAN Manager → iSCSI** → выбрать таргет → **Отключить** → подождать 15–20 сек → **Включить** (то же действие через GUI).
