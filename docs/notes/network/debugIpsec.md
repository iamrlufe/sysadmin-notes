# Диагностика и отладка IPsec в MikroTik RouterOS

## Введение

При проблемах с IPsec-туннелями в MikroTik основным инструментом диагностики являются системные логи RouterOS.

IPsec Debug позволяет диагностировать:

- запуск IKE negotiation;
- Phase 1 / IKE SA;
- Phase 2 / Child SA;
- согласование алгоритмов шифрования;
- согласование DH Group;
- согласование PFS Group;
- ошибки аутентификации;
- проблемы PSK;
- ошибки Proposal;
- проблемы Identity;
- подбор IPsec Policy;
- создание Security Association;
- удаление SA;
- отсутствие ответа от удалённого Peer;
- ошибки удалённого VPN-шлюза.

> **Важно:** IPsec Debug создаёт большое количество сообщений.
>
> После завершения диагностики Debug необходимо отключать.

---

## 1. Проверка текущего логирования

Перед включением Debug необходимо проверить существующие правила логирования:

```routeros
/system logging print
```

Пример:

```text
Flags: * - DEFAULT
Columns: TOPICS, ACTION

#   TOPICS    ACTION
0 * info      memory
1 * error     memory
2 * warning   memory
3 * critical  echo
4   ipsec     memory
    !debug
    !packet
```

Правило:

```text
ipsec
!debug
!packet
```

означает:

- логировать обычные события IPsec;
- не логировать Debug;
- не логировать Packet.

Это рекомендуемый режим для обычной эксплуатации MikroTik.

---

## 2. Просмотр обычных IPsec-логов

Посмотреть только IPsec-сообщения:

```routeros
/log print where topics~"ipsec"
```

Просмотр IPsec-логов в реальном времени:

```routeros
/log print follow where topics~"ipsec"
```

Поиск IPsec по тексту сообщения:

```routeros
/log print where message~"ipsec"
```

Остановить просмотр:

```text
Ctrl+C
```

---

## 3. Включение IPsec Debug

Сначала посмотреть номер правила IPsec Logging:

```routeros
/system logging print
```

Пример:

```text
4   ipsec     memory
    !debug
    !packet
```

В данном примере номер правила:

```text
4
```

Для включения IPsec Debug выполнить:

```routeros
/system logging set 4 topics=ipsec,debug,!packet
```

Проверить:

```routeros
/system logging print
```

Должно отображаться:

```text
4   ipsec     memory
    debug
    !packet
```

IPsec Debug включён.

Параметр:

```text
!packet
```

оставляется для исключения Packet Debug.

Packet Debug может создавать очень большое количество логов.

---

## 4. Альтернативный способ включения Debug

Вместо изменения существующего правила можно создать отдельное временное правило:

```routeros
/system logging add topics=ipsec,debug,!packet action=memory
```

Проверить:

```routeros
/system logging print
```

Пример:

```text
4   ipsec     memory
    !debug
    !packet

5   ipsec     memory
    debug
    !packet
```

Правило №5 является временным Debug-правилом.

После диагностики его необходимо удалить.

---

## 5. Просмотр IPsec Debug

Основная команда:

```routeros
/log print follow where topics~"ipsec"
```

Просмотр Debug:

```routeros
/log print follow where topics~"debug"
```

Просмотр только IPsec Debug:

```routeros
/log print follow where topics~"ipsec" and topics~"debug"
```

Для остановки:

```text
Ctrl+C
```

---

## 6. Отключение IPsec Debug

После завершения диагностики необходимо вернуть обычный режим логирования.

Если изменялось существующее правило:

```routeros
/system logging set 4 topics=ipsec,!debug,!packet
```

Проверить:

```routeros
/system logging print
```

Результат:

```text
4   ipsec     memory
    !debug
    !packet
```

Это означает:

- обычные события IPsec логируются;
- Debug отключён;
- Packet Debug отключён.

---

## 7. Удаление временного Debug-правила

Если Debug был добавлен отдельным правилом:

```routeros
/system logging print
```

Пример:

```text
5   ipsec     memory
    debug
    !packet
```

Удалить правило:

```routeros
/system logging remove 5
```

Проверить:

```routeros
/system logging print
```

---

## 8. Рекомендуемая последовательность диагностики IPsec

Диагностику IPsec рекомендуется выполнять в следующем порядке:

```text
Peer
  ↓
Identity
  ↓
Profile / Phase 1
  ↓
Proposal / Phase 2
  ↓
IPsec Debug
  ↓
Создание интересующего трафика
  ↓
Active Peers
  ↓
Installed SA
  ↓
IPsec Policy
  ↓
NAT
  ↓
Firewall
  ↓
Маршрутизация
  ↓
Удалённая сторона
```

---

## 9. Проверка IPsec Peer

Выполнить:

```routeros
/ip ipsec peer print detail
```

Проверить:

- `address`;
- `local-address`;
- `exchange-mode`;
- `profile`;
- `passive`.

Пример:

```text
address=195.12.113.7/32
local-address=67.12.144.2
exchange-mode=ike2
profile=SmartBridge
```

Необходимо проверить правильность IP-адреса удалённого Peer.

---

## 10. Проверка IPsec Identity

Выполнить:

```routeros
/ip ipsec identity print detail
```

Проверить:

- `peer`;
- `auth-method`;
- `secret`;
- `my-id`;
- `remote-id`.

Особое внимание:

```text
my-id
remote-id
```

Неправильный ID может приводить к ошибкам IKE Authentication.

Типичные причины:

- неправильный PSK;
- неправильный `my-id`;
- неправильный `remote-id`;
- несовпадение метода аутентификации.

---

## 11. Проверка IPsec Profile

Выполнить:

```routeros
/ip ipsec profile print detail
```

Проверить:

- `hash-algorithm`;
- `enc-algorithm`;
- `dh-group`;
- `lifetime`.

Profile используется при согласовании IKE / Phase 1.

Параметры должны быть совместимы с удалённой стороной.

Пример:

```text
hash-algorithm=sha256
enc-algorithm=aes-256
dh-group=modp2048
lifetime=1d
```

---

## 12. Проверка IPsec Proposal

Выполнить:

```routeros
/ip ipsec proposal print detail
```

Проверить:

- `auth-algorithms`;
- `enc-algorithms`;
- `pfs-group`;
- `lifetime`.

Proposal используется для Phase 2 / Child SA.

Пример:

```text
auth-algorithms=sha256
enc-algorithms=aes-256-cbc
pfs-group=modp2048
lifetime=1h
```

При ошибке:

```text
no suitable proposal found
```

необходимо сравнить Proposal MikroTik с настройками удалённого VPN-шлюза.

Проверить:

- Encryption Algorithm;
- Authentication Algorithm;
- DH Group;
- PFS Group;
- Lifetime.

---

## 13. Проверка IPsec Policy

Выполнить:

```routeros
/ip ipsec policy print detail
```

Проверить:

- `src-address`;
- `dst-address`;
- `tunnel`;
- `action`;
- `proposal`;
- `peer`.

Пример MikroTik:

```text
src-address=192.168.1.0/24
dst-address=10.100.0.0/24
```

На удалённой стороне сети должны быть настроены зеркально:

```text
src-address=10.100.0.0/24
dst-address=192.168.1.0/24
```

Одна из распространённых причин проблем IPsec — неправильное направление Local Subnet и Remote Subnet.

---

## 14. Проверка Active Peers

Выполнить:

```routeros
/ip ipsec active-peers print detail
```

Если Peer присутствует в списке, IKE SA обычно установлена.

Если список пустой, проблема чаще всего находится на этапе:

```text
IKE
Phase 1
Authentication
Peer connectivity
```

В этом случае необходимо анализировать IPsec Debug.

---

## 15. Проверка Installed SA

Выполнить:

```routeros
/ip ipsec installed-sa print detail
```

Проверить:

- `src-address`;
- `dst-address`;
- `state`;
- `spi`;
- `auth-algorithm`;
- `enc-algorithm`;
- `current-bytes`.

Особое внимание необходимо обратить на:

```text
current-bytes
```

Повторно выполнить:

```routeros
/ip ipsec installed-sa print detail
```

Если `current-bytes` увеличивается, трафик проходит через SA.

Если SA установлена, но счётчики не изменяются, необходимо проверить:

- IPsec Policy;
- маршрутизацию;
- NAT;
- Firewall;
- обратный маршрут;
- настройки удалённой стороны.

---

## 16. Принудительный запуск IPsec-туннеля

Некоторые Site-to-Site IPsec-туннели поднимаются только при наличии интересующего трафика.

Для запуска туннеля необходимо создать трафик в удалённую сеть.

Пример:

```routeros
/ping 10.100.0.8
```

При необходимости указать Source Address:

```routeros
/ping 10.100.0.8 src-address=192.168.1.1
```

Одновременно открыть IPsec Debug:

```routeros
/log print follow where topics~"ipsec"
```

Рекомендуемая последовательность:

1. Включить IPsec Debug.
2. Запустить просмотр логов.
3. Создать трафик в удалённую сеть.
4. Анализировать IKE negotiation.
5. Проверить Active Peers.
6. Проверить Installed SA.
7. Проверить IPsec Policy.
8. После диагностики отключить Debug.

---

## 17. Перезапуск IPsec SA

Посмотреть Active Peers:

```routeros
/ip ipsec active-peers print
```

Посмотреть Installed SA:

```routeros
/ip ipsec installed-sa print
```

Для сброса активных IPsec-соединений:

```routeros
/ip ipsec active-peers kill-connections
```

> **Внимание:** команда может разорвать активные IPsec-туннели на маршрутизаторе.

Если на MikroTik настроено много VPN-туннелей, использовать команду необходимо осторожно.

После сброса создать интересующий трафик:

```routeros
/ping REMOTE-IP src-address=LOCAL-IP
```

Одновременно смотреть лог:

```routeros
/log print follow where topics~"ipsec"
```

---

## 18. Ошибка `no suitable proposal found`

Пример:

```text
no suitable proposal found
```

Проверить:

```routeros
/ip ipsec profile print detail
```

И:

```routeros
/ip ipsec proposal print detail
```

Сравнить с удалённой стороной:

```text
Encryption Algorithm
Authentication Algorithm
DH Group
PFS Group
Lifetime
```

Для IKE / Phase 1 проверяется Profile.

Для Phase 2 проверяется Proposal.

---

## 19. Ошибка `authentication failed`

Пример:

```text
authentication failed
```

Проверить:

```routeros
/ip ipsec identity print detail
```

Основные причины:

- неправильный PSK;
- неправильный `my-id`;
- неправильный `remote-id`;
- несовпадение `auth-method`;
- удалённая сторона ожидает другой Peer ID.

---

## 20. Ошибка `peer not responding`

Пример:

```text
peer not responding
```

Проверить доступность удалённого Peer:

```routeros
/ping REMOTE-PUBLIC-IP
```

Проверить Firewall:

```routeros
/ip firewall filter print detail
```

Для IPsec необходимо проверить прохождение:

```text
UDP 500
UDP 4500
ESP
```

UDP 500 используется для IKE.

UDP 4500 используется для NAT-T.

ESP используется для IPsec-трафика без UDP encapsulation.

---

## 21. Ошибка `phase1 negotiation failed`

Проблема обычно связана с IKE / Phase 1.

Проверить:

```routeros
/ip ipsec peer print detail
```

```routeros
/ip ipsec profile print detail
```

```routeros
/ip ipsec identity print detail
```

Сравнить с удалённой стороной:

- IKE Version;
- Encryption;
- Hash / Integrity;
- DH Group;
- Lifetime;
- PSK;
- Local ID;
- Remote ID.

---

## 22. Phase 1 работает, но трафик не проходит

Проверить Installed SA:

```routeros
/ip ipsec installed-sa print detail
```

Проверить Policy:

```routeros
/ip ipsec policy print detail
```

Проверить NAT:

```routeros
/ip firewall nat print detail
```

Проверить Firewall:

```routeros
/ip firewall filter print detail
```

Типичные причины:

- неправильная IPsec Policy;
- неправильные Local/Remote Subnet;
- NAT изменяет Source Address;
- отсутствует NAT Bypass;
- Firewall блокирует трафик;
- отсутствует обратный маршрут;
- удалённая сторона использует неправильный Traffic Selector.

---

## 23. Проверка NAT при проблемах IPsec

Посмотреть NAT:

```routeros
/ip firewall nat print detail
```

Для Site-to-Site IPsec часто требуется исключить VPN-трафик из Masquerade.

Пример:

```routeros
/ip firewall nat add chain=srcnat src-address=192.168.1.0/24 dst-address=10.100.0.0/24 action=accept comment="IPsec NAT Bypass"
```

Правило должно находиться выше общего Masquerade.

Проверить порядок:

```routeros
/ip firewall nat print
```

Пример:

```text
0   chain=srcnat src-address=192.168.1.0/24 dst-address=10.100.0.0/24 action=accept
1   chain=srcnat out-interface=WAN action=masquerade
```

VPN-трафик сначала попадает в NAT Bypass.

---

## 24. Логирование отдельного NAT-правила

Для диагностики конкретного NAT-правила включить:

```text
log=yes
```

И задать уникальный:

```text
log-prefix
```

Пример:

```routeros
/ip firewall nat set 2 log=yes log-prefix="smartBridgeLOG"
```

Пример правила:

```text
;;; SmartBridge IN
chain=dstnat
action=netmap
to-addresses=10.100.0.8
src-address=195.12.113.7
dst-address=67.12.144.2
log=yes
log-prefix="smartBridgeLOG"
```

Посмотреть только логи этого правила:

```routeros
/log print follow where message~"smartBridgeLOG"
```

Посмотреть накопленные логи:

```routeros
/log print where message~"smartBridgeLOG"
```

Для остановки:

```text
Ctrl+C
```

---

## 25. Логирование отдельного Firewall-правила

Сначала посмотреть правила:

```routeros
/ip firewall filter print
```

Включить логирование необходимого правила:

```routeros
/ip firewall filter set 10 log=yes log-prefix="IPSEC-FW-LOG"
```

Просмотр:

```routeros
/log print follow where message~"IPSEC-FW-LOG"
```

После диагностики логирование рекомендуется отключить:

```routeros
/ip firewall filter set 10 log=no
```

---

## 26. Поиск конкретного Peer в логах

Если на MikroTik настроено много IPsec-туннелей, общий Debug может быть неудобен.

Можно искать IP-адрес конкретного Peer.

Пример:

```routeros
/log print where message~"195.12.113.7"
```

Просмотр в реальном времени:

```routeros
/log print follow where message~"195.12.113.7"
```

Для конкретного Peer:

```text
195.12.113.7
```

это позволяет отфильтровать значительную часть посторонних IPsec-сообщений.

---

## 27. Поиск ошибок в логах

Поиск сообщений с `failed`:

```routeros
/log print where message~"failed"
```

Поиск Authentication:

```routeros
/log print where message~"auth"
```

Поиск Proposal:

```routeros
/log print where message~"proposal"
```

Поиск Phase:

```routeros
/log print where message~"phase"
```

Поиск конкретного IP:

```routeros
/log print where message~"195.12.113.7"
```

Поиск конкретного NAT Log Prefix:

```routeros
/log print where message~"smartBridgeLOG"
```

---

## 28. Рекомендуемый алгоритм IPsec Debug

```text
1. Проверить Peer
        ↓
2. Проверить Identity
        ↓
3. Проверить Profile / Phase 1
        ↓
4. Проверить Proposal / Phase 2
        ↓
5. Проверить Policy
        ↓
6. Включить IPsec Debug
        ↓
7. Запустить просмотр логов
        ↓
8. Создать интересующий трафик
        ↓
9. Проверить Active Peers
        ↓
10. Проверить Installed SA
        ↓
11. Проверить current-bytes
        ↓
12. Проверить NAT
        ↓
13. Проверить Firewall
        ↓
14. Проверить маршрутизацию
        ↓
15. Проверить обратный маршрут
        ↓
16. Проверить удалённую сторону
        ↓
17. Отключить IPsec Debug
```

---

## 29. Команды-шпаргалка

### Проверить Logging

```routeros
/system logging print
```

### Включить IPsec Debug

```routeros
/system logging set 4 topics=ipsec,debug,!packet
```

### Смотреть IPsec в реальном времени

```routeros
/log print follow where topics~"ipsec"
```

### Смотреть конкретный Peer

```routeros
/log print follow where message~"REMOTE-PEER-IP"
```

### Отключить IPsec Debug

```routeros
/system logging set 4 topics=ipsec,!debug,!packet
```

### Проверить Peer

```routeros
/ip ipsec peer print detail
```

### Проверить Identity

```routeros
/ip ipsec identity print detail
```

### Проверить Profile

```routeros
/ip ipsec profile print detail
```

### Проверить Proposal

```routeros
/ip ipsec proposal print detail
```

### Проверить Policy

```routeros
/ip ipsec policy print detail
```

### Проверить Active Peers

```routeros
/ip ipsec active-peers print detail
```

### Проверить Installed SA

```routeros
/ip ipsec installed-sa print detail
```

### Проверить NAT

```routeros
/ip firewall nat print detail
```

### Проверить Firewall

```routeros
/ip firewall filter print detail
```

### Смотреть NAT Log Prefix

```routeros
/log print follow where message~"LOG-PREFIX"
```

---

## 30. Практические рекомендации

1. Не оставлять `ipsec,debug` включённым постоянно.

2. Использовать `!packet`, если Packet Debug не требуется.

3. Перед запуском тестового трафика открыть:

```routeros
/log print follow where topics~"ipsec"
```

4. После включения Debug обязательно создать интересующий IPsec-трафик.

5. При большом количестве туннелей фильтровать лог по IP-адресу Peer:

```routeros
/log print follow where message~"REMOTE-PEER-IP"
```

6. Всегда отдельно проверять:

```text
Phase 1 = Profile
Phase 2 = Proposal
```

7. Если Active Peer отсутствует — анализировать IKE / Phase 1.

8. Если Active Peer есть, но Installed SA отсутствует — проверять Phase 2, Proposal и Policy.

9. Если Installed SA есть, но трафика нет — проверять:

```text
current-bytes
Policy
NAT
Firewall
Routing
Remote Routing
```

10. Для диагностики NAT и Firewall использовать уникальный `log-prefix`.

Пример:

```text
smartBridgeLOG
```

11. После диагностики отключить логирование временных NAT и Firewall правил.

12. После завершения диагностики вернуть IPsec Logging в режим:

```text
ipsec
!debug
!packet
```

Команда:

```routeros
/system logging set 4 topics=ipsec,!debug,!packet
```

---

## Итог

Основная последовательность диагностики IPsec на MikroTik:

```text
Проверить конфигурацию
        ↓
Включить IPsec Debug
        ↓
Открыть Log Follow
        ↓
Создать интересующий трафик
        ↓
Найти конкретный Peer в логах
        ↓
Проверить Active Peer
        ↓
Проверить Installed SA
        ↓
Проверить current-bytes
        ↓
Проверить Policy
        ↓
Проверить NAT
        ↓
Проверить Firewall
        ↓
Проверить маршрутизацию
        ↓
Отключить Debug
```

Для повседневной эксплуатации рекомендуется использовать:

```routeros
/system logging set 4 topics=ipsec,!debug,!packet
```

Для временной диагностики:

```routeros
/system logging set 4 topics=ipsec,debug,!packet
```

Просмотр IPsec в реальном времени:

```routeros
/log print follow where topics~"ipsec"
```

Просмотр конкретного Peer:

```routeros
/log print follow where message~"REMOTE-PEER-IP"
```