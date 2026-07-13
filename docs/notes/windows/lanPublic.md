# Windows Server 2016 определяет доменную сеть как Public

## Описание проблемы

На сервере **Windows Server 2016**, включённом в домен Active Directory, сетевой профиль может ошибочно определяться как `Public` вместо `DomainAuthenticated`.

Проверить текущий сетевой профиль можно командой:

```powershell
Get-NetConnectionProfile
```

Пример проблемного состояния:

```text
Name             : Сеть 2
InterfaceAlias   : Ethernet
InterfaceIndex   : 7
NetworkCategory  : Public
IPv4Connectivity : Internet
IPv6Connectivity : NoTraffic
```

Основной признак проблемы:

```text
NetworkCategory : Public
```

Для сервера, включённого в домен Active Directory, ожидаемый сетевой профиль:

```text
NetworkCategory : DomainAuthenticated
```

Из-за неправильного определения сетевого профиля Windows Firewall может применять правила профиля `Public`, что может привести к проблемам с доступом к серверу и доменным службам.

---

## Быстрое решение

Запустите PowerShell от имени администратора.

Перезапустите службу **Network Location Awareness (NLA)**:

```powershell
Restart-Service NlaSvc -Force
```

После перезапуска службы повторно проверьте сетевой профиль:

```powershell
Get-NetConnectionProfile
```

Пример корректного результата:

```text
Name             : domain.local
InterfaceAlias   : Ethernet
InterfaceIndex   : 7
NetworkCategory  : DomainAuthenticated
IPv4Connectivity : NoTraffic
IPv6Connectivity : NoTraffic
```

Сетевой профиль изменился:

```text
Public → DomainAuthenticated
```

Служба NLA повторно выполнила определение сети, обнаружила домен Active Directory и автоматически применила доменный сетевой профиль.

---

## Проверка DNS-серверов

Если перезапуск службы NLA не помог, необходимо проверить DNS-серверы сетевого интерфейса.

Выполните:

```powershell
Get-DnsClientServerAddress -AddressFamily IPv4
```

Пример корректной конфигурации:

```text
InterfaceAlias               Interface Address ServerAddresses
                             Index     Family
--------------               --------- ------- ---------------
Ethernet                             7 IPv4    {10.100.0.4, 10.100.0.3}
Loopback Pseudo-Interface 1          1 IPv4    {}
```

Сервер, включённый в домен Active Directory, должен использовать DNS-серверы, обслуживающие DNS-зону домена.

Не рекомендуется напрямую указывать на сетевом интерфейсе публичные DNS-серверы:

```text
8.8.8.8
1.1.1.1
DNS роутера
DNS провайдера
```

Публичные DNS-серверы при необходимости следует настраивать как **DNS Forwarders** на внутренних DNS-серверах Active Directory.

---

## Проверка обнаружения контроллера домена

Для проверки обнаружения контроллера домена используется команда:

```powershell
nltest /dsgetdc:domain.local
```

Команда должна обнаружить доступный контроллер домена.

Если появляется ошибка:

```text
Не удалось получить имя контроллера домена:
Status = 1355
0x54b
ERROR_NO_SUCH_DOMAIN
```

необходимо проверить:

- настройки DNS сетевого интерфейса;
- доступность контроллеров домена;
- разрешение имени домена;
- SRV-записи Active Directory;
- работу службы Netlogon;
- сетевую связность между сервером и контроллером домена.

---

## Проверка безопасного канала с доменом

Для проверки доверительного канала между сервером и Active Directory выполните:

```powershell
Test-ComputerSecureChannel -Verbose
```

Корректный результат:

```text
ПОДРОБНО: Безопасный канал между локальным компьютером и доменом rcku.net находится в хорошем состоянии.
True
```

Значение:

```text
True
```

означает, что безопасный канал между сервером и доменом Active Directory исправен.

Если команда возвращает:

```text
False
```

необходимо отдельно диагностировать доверительные отношения компьютера с доменом.

---

## Проверка служб NLA и Netlogon

Проверьте состояние служб:

```powershell
Get-Service NlaSvc,Netlogon
```

Необходимо обратить внимание на службы:

```text
NlaSvc   — Network Location Awareness
Netlogon — Netlogon
```

Служба `NlaSvc` отвечает за определение сетевого расположения и выбор сетевого профиля.

Служба `Netlogon` участвует в обнаружении контроллеров домена и поддержании безопасного канала с Active Directory.

---

## Просмотр событий сетевого профиля

Для просмотра последних событий определения сетевого профиля выполните:

```powershell
Get-WinEvent -LogName "Microsoft-Windows-NetworkProfile/Operational" -MaxEvents 20 |
Select-Object TimeCreated, Id, Message
```

Для более подробной диагностики можно увеличить количество событий:

```powershell
Get-WinEvent -LogName "Microsoft-Windows-NetworkProfile/Operational" -MaxEvents 50 |
Select-Object TimeCreated, Id, Message
```

В журнале необходимо проверить события, появившиеся во время запуска сервера или изменения сетевого профиля.

---

## Если проблема возникает после каждой перезагрузки

Если после запуска Windows Server сетевой профиль определяется как:

```text
Public
```

а после выполнения:

```powershell
Restart-Service NlaSvc -Force
```

изменяется на:

```text
DomainAuthenticated
```

возможна проблема с порядком запуска сетевых и доменных служб.

Служба Network Location Awareness может выполнить определение сетевого профиля до того, как станут доступны:

- сетевой интерфейс;
- внутренние DNS-серверы;
- DNS-зона Active Directory;
- контроллер домена;
- служба Netlogon.

В результате NLA не обнаруживает домен и временно назначает сети профиль `Public`.

После перезапуска NLA сетевые и доменные службы уже доступны. Служба повторно обнаруживает домен и устанавливает профиль `DomainAuthenticated`.

Для диагностики необходимо выполнить:

```powershell
nltest /dsgetdc:domain.local
```

Проверить безопасный канал:

```powershell
Test-ComputerSecureChannel -Verbose
```

Проверить службы:

```powershell
Get-Service NlaSvc,Netlogon
```

И просмотреть события сетевого профиля:

```powershell
Get-WinEvent -LogName "Microsoft-Windows-NetworkProfile/Operational" -MaxEvents 50 |
Select-Object TimeCreated, Id, Message
```

---

## Краткое решение

Проверить текущий сетевой профиль:

```powershell
Get-NetConnectionProfile
```

Если отображается:

```text
NetworkCategory : Public
```

перезапустить службу NLA:

```powershell
Restart-Service NlaSvc -Force
```

Повторно проверить сетевой профиль:

```powershell
Get-NetConnectionProfile
```

Ожидаемый результат:

```text
NetworkCategory : DomainAuthenticated
```

---

## Итог

В данном случае Windows Server 2016 ошибочно определил доменную сеть как `Public`.

Текущий профиль сети был:

```text
Name             : Сеть 2
NetworkCategory  : Public
```

После перезапуска службы Network Location Awareness:

```powershell
Restart-Service NlaSvc -Force
```

служба повторно выполнила определение сети.

Сервер обнаружил домен `domain.local`, после чего сетевой профиль автоматически изменился на:

```text
Name             : domain.local
NetworkCategory  : DomainAuthenticated
```

Безопасный канал между сервером и доменом был дополнительно проверен командой:

```powershell
Test-ComputerSecureChannel -Verbose
```

Результат:

```text
True
```

DNS-серверы сетевого интерфейса также были настроены на внутренние DNS-серверы Active Directory:

```text
10.100.0.4
10.100.0.3
```

Таким образом, проблема была связана с некорректным определением доменной сети службой **Network Location Awareness (NLA)**.

В данном случае проблему решила команда:

```powershell
Restart-Service NlaSvc -Force
```