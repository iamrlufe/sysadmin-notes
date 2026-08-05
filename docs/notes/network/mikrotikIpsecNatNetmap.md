---
title: IPsec-туннель host-to-host с NAT netmap на MikroTik
tags:
  - Сети
  - VPN
  - MikroTik
  - IPsec
  - NAT
summary: "Настройка IPsec-туннеля между «фейковыми» публичными адресами: внутренний сервер маппится через src-nat/netmap в согласованный с партнёром IP, туннель поднимается между этими адресами. CLI, Winbox и чек-лист типовых ошибок."
---

# Настройка IPsec-туннеля (host-to-host) с NAT netmap на MikroTik

## Суть схемы

Это не обычный site-to-site IPsec между локальными подсетями, а схема **host-to-host через «фейковые» публичные адреса**.

Партнёр (внешняя организация) готов пускать трафик только с определённого публичного IP на определённый публичный IP — то есть у него в правилах указано что-то вроде «разрешён доступ с IP A на IP B». Вместо того чтобы городить сложные policy с реальными внутренними адресами, делаем так:

1. Реальный внутренний сервер (например, `10.100.0.82`) через NAT «превращается» в нужный партнёру IP-адрес (например, `43.10.100.2`) — это может быть как реальный дополнительный публичный IP на WAN-интерфейсе роутера, так и просто адрес, согласованный с партнёром как «виртуальный».
2. IPsec-туннель поднимается именно между этими двумя «фейковыми» (или дополнительными публичными) адресами.
3. NAT (netmap) прозрачно превращает входящий/исходящий трафик между внутренним сервером и этим фейковым адресом в обе стороны.

Реальные же участники обмена данными по SA (Security Association) в IPsec — это боевые WAN IP роутеров (`sa-src-address` / `sa-dst-address`), а `src-address`/`dst-address` в policy — уже те самые фейковые/выделенные адреса.

### Схема адресов (пример, замени на свои)

| Обозначение | Что это | Пример |
|---|---|---|
| `LOCAL_WAN_IP` | Реальный внешний (WAN) IP твоего MikroTik | `203.0.113.10` |
| `LOCAL_FAKE_IP` | «Фейковый»/выделенный адрес, под который мапится внутренний сервер, согласован с партнёром | `198.51.100.2` |
| `LOCAL_INTERNAL_IP` | Реальный внутренний сервер в локальной сети | `10.100.0.82` |
| `REMOTE_PEER_IP` | Публичный IP удалённой стороны (партнёра), с которым поднимается IPsec SA | `203.0.113.50` |
| `REMOTE_FAKE_IP` | Адрес партнёра, который он «выставляет» тебе для доступа | `198.51.100.7` |
| `WAN_INTERFACE` | Название WAN-интерфейса на роутере | `ether2` |

---

## Часть 1. Настройка через терминал (CLI)

### Шаг 1. Profile — параметры IKE (Phase 1)

Profile описывает, как согласуется сам защищённый канал управления (IKE SA) — алгоритмы шифрования/хэширования для первой фазы, время жизни, DPD (проверка доступности пира).

```routeros
/ip ipsec profile add name="profile-partner" hash-algorithm=sha256 enc-algorithm=aes-256 dh-group=modp2048 lifetime=1d proposal-check=obey nat-traversal=yes ppk=no dpd-interval=30s dpd-maximum-failures=5
```

Пояснение параметров:

- `hash-algorithm=sha256` — алгоритм хэширования для проверки целостности на этапе IKE. Согласовывается с тем, что требует партнёр.
- `enc-algorithm=aes-256` — шифрование управляющего канала.
- `dh-group=modp2048` — группа Диффи-Хеллмана для генерации общего ключа. Чем выше группа — тем безопаснее, но чуть дороже по CPU.
- `lifetime=1d` — как часто пересогласовывается IKE SA.
- `nat-traversal=yes` — обязательно, если между сторонами есть NAT (а он тут есть по определению схемы).
- `dpd-interval` / `dpd-maximum-failures` — Dead Peer Detection: через сколько секунд проверять, жив ли собеседник, и сколько неудачных попыток допустимо перед тем как считать туннель мёртвым.

!!! warning "Важно"
    Название profile должно быть уникальным на роутере. Если позже будешь делать ещё один такой туннель — дай другое имя (например, `profile-partner2`), иначе возможен конфликт.

### Шаг 2. Proposal — параметры Phase 2 (шифрование самого трафика)

Proposal — это уже про то, как шифруются непосредственно пакеты данных внутри туннеля (ESP).

```routeros
/ip ipsec proposal add name="proposal-partner" auth-algorithms=sha256 enc-algorithms=aes-256-cbc lifetime=8h pfs-group=modp2048
```

- `auth-algorithms` / `enc-algorithms` — алгоритмы аутентификации и шифрования данных. Должны совпадать с требованиями партнёра.
- `lifetime=8h` — как часто пересогласуется Phase 2 SA (обычно короче, чем Phase 1).
- `pfs-group` — Perfect Forward Secrecy, дополнительный обмен ключами для каждой Phase 2, повышает безопасность.

### Шаг 3. Peer — кто удалённая сторона

```routeros
/ip ipsec peer add name="peer-partner" address=REMOTE_PEER_IP/32 profile=profile-partner exchange-mode=ike2 send-initial-contact=yes
```

- `address` — публичный IP партнёра (WAN-адрес его стороны, с которым будет устанавливаться SA).
- `exchange-mode=ike2` — версия протокола IKE (уточняй у партнёра, иногда нужен `ike1` / `main`).
- `send-initial-contact=yes` — при (пере)подключении сообщать партнёру «это новое соединение», что помогает быстрее разорвать зависшие старые SA.

!!! failure "Частая ошибка"
    `Multiple initiator peers for the same address/dns` — означает, что на роутере уже есть другой peer с тем же `address`. MikroTik не разрешает два инициирующих peer на один и тот же удалённый IP. Если нужно несколько туннелей к разным сервисам одного партнёра — разбираться нужно через разные policy на один peer, а не плодить peer'ы.

### Шаг 4. Identity — аутентификация (PSK)

```routeros
/ip ipsec identity add peer=peer-partner auth-method=pre-shared-key secret="СЮДА_ОБЩИЙ_КЛЮЧ" generate-policy=no
```

- `secret` — Pre-Shared Key, согласованный с партнёром заранее (по защищённому каналу, не по почте открытым текстом).
- `generate-policy=no` — не создавать policy автоматически на основе входящего трафика; policy опишем вручную на следующем шаге (это надёжнее и предсказуемее).

!!! warning "Важно"
    Если команда `identity add` выдаёт `input does not match any value of peer` — значит peer из Шага 3 не создался (проверь `/ip ipsec peer print`).

### Шаг 5. Policy — что именно шифровать

```routeros
/ip ipsec policy add comment="Partner tunnel" peer=peer-partner tunnel=yes src-address=LOCAL_FAKE_IP/32 dst-address=REMOTE_FAKE_IP/32 protocol=all action=encrypt level=require ipsec-protocols=esp proposal=proposal-partner
```

- `tunnel=yes` — режим туннеля (в отличие от transport mode), заворачивает исходный IP-пакет целиком в новый ESP-пакет.
- `src-address` / `dst-address` — это те самые «фейковые» адреса, между которыми якобы происходит обмен (с точки зрения IPsec policy это выглядит как трафик именно между ними, а не между реальными внутренними хостами).
- `action=encrypt level=require` — требовать шифрование для трафика, подпадающего под этот src/dst; если SA не установлена — трафик просто не пройдёт (в отличие от `level=use`).
- `proposal` — ссылка на Шаг 2.

Policy автоматически привязывается к `group=default`, если явно не указано иное — для одиночного туннеля этого достаточно.

### Шаг 6–8. NAT — три правила

Это ключевая часть, которая связывает реальный внутренний сервер с «фейковым» IP, участвующим в туннеле. Нужно понимать: **IPsec policy видит трафик уже ПОСЛЕ обработки NAT в цепочке srcnat для исходящих пакетов**, а для входящих (dstnat) NAT происходит после расшифровки. Поэтому порядок и логика важны.

#### 6. src-nat — исходящий трафик, реальный сервер → в туннель

```routeros
/ip firewall nat add chain=srcnat comment="Partner NAT" action=src-nat to-addresses=LOCAL_FAKE_IP src-address=LOCAL_INTERNAL_IP dst-address=REMOTE_FAKE_IP log=yes log-prefix="outPartner"
```

Когда внутренний сервер `LOCAL_INTERNAL_IP` отправляет пакет на `REMOTE_FAKE_IP`, его исходный (source) адрес подменяется на `LOCAL_FAKE_IP`. Именно после этой подмены пакет «видится» IPsec policy как трафик от `LOCAL_FAKE_IP` — и попадает под шифрование.

`log=yes` — полезно на первое время для отладки (видно в логах, что трафик реально идёт), потом можно отключить, чтобы не засорять лог.

#### 7. netmap (srcnat) — то же самое, но через action=netmap

```routeros
/ip firewall nat add chain=srcnat comment="Partner OUT" action=netmap to-addresses=LOCAL_FAKE_IP src-address=LOCAL_INTERNAL_IP dst-address=REMOTE_FAKE_IP
```

!!! note "Важный нюанс"
    В конфигурации-источнике этой инструкции присутствуют одновременно `action=src-nat` (шаг 6) и `action=netmap` (шаг 7) с одинаковыми условиями src/dst. Формально это избыточно — оба правила делают одно и то же (подмену source-адреса) для одного и того же трафика, отличие `netmap` от `src-nat` проявляется в первую очередь при работе с диапазонами/подсетями (netmap умеет маппить целые подсети 1:1, src-nat — обычно один IP или пул). Так исторически сложилось в рабочей конфигурации, и трогать не стоит, раз работает — но при построении **новой** схемы с нуля обычно достаточно **одного** правила srcnat (шаг 6) плюс dstnat (шаг 8 ниже). Дублирующее netmap-правило можно не добавлять, если делаешь чистую настройку.

#### 8. netmap (dstnat) — входящий трафик, фейковый IP → реальный сервер

```routeros
/ip firewall nat add chain=dstnat action=netmap to-addresses=LOCAL_INTERNAL_IP src-address=REMOTE_FAKE_IP dst-address=LOCAL_FAKE_IP comment="Partner IN" log=yes log-prefix="partnerLOG"
```

Когда партнёр (`REMOTE_FAKE_IP`) присылает пакет на твой `LOCAL_FAKE_IP` (уже расшифрованный IPsec'ом), dstnat подменяет адрес назначения на реальный внутренний `LOCAL_INTERNAL_IP`, чтобы пакет дошёл до сервера в локальной сети.

Здесь именно `netmap`, а не `dst-nat`, обычно осознанный выбор — netmap лучше подходит, когда нужна симметричная и предсказуемая замена адреса 1:1 в обе стороны.

---

## Часть 2. Проверка результата

```routeros
/ip ipsec active-peers print detail
/ip ipsec policy print detail
```

Смотри на поле `ph2-state` в выводе policy:

- `established` — Phase 2 поднялась, туннель работает.
- `no-phase2` / пусто — SA ещё не согласована. Причины обычно: неверный PSK, партнёр ещё не разрешил твой новый IP, несовпадение proposal/profile параметров, либо трафика ещё не было (туннель поднимается по факту первого пакета, если не настроен принудительный keep-alive).

Полезно также посмотреть лог:

```routeros
/log print where topics~"ipsec"
```

Подробнее про включение отладки — в заметке [Debug IPsec MikroTik](debugIpsec.md), а про сопоставление DH-групп с оборудованием другого вендора — в [Различия DH Group: MikroTik vs Juniper ScreenOS](dh.md).

---

## Часть 3. Та же настройка через Winbox (GUI)

### 1. Profile

`IP → IPsec → Profiles → +`

- Name: `profile-partner`
- Hash Algorithm: `sha256`
- Encryption Algorithm: отметить только `aes-256`
- DH Group: `modp2048`
- Lifetime: `1d`
- NAT Traversal: включено (галка)
- DPD Interval: `30s`, DPD Maximum Failures: `5`
- OK

### 2. Proposal

`IP → IPsec → Proposals → +`

- Name: `proposal-partner`
- Auth. Algorithms: `sha256`
- Enc. Algorithms: только `aes-256 cbc`
- Lifetime: `8h`
- PFS Group: `modp2048`
- OK

### 3. Peer

`IP → IPsec → Peers → вкладка Peers → +`

- Name: `peer-partner`
- Address: `REMOTE_PEER_IP/32`
- Profile: `profile-partner`
- Exchange Mode: `IKE2`
- Send Initial Contact: включено (галка)
- OK

### 4. Identity

`IP → IPsec → Peers → вкладка Identities → +`

- Peer: `peer-partner`
- Auth. Method: `pre shared key`
- Secret: вставить общий ключ
- Generate Policy: `no`
- OK

### 5. Policy

`IP → IPsec → Policies → +`

- вкладка General:
    - Src. Address: `LOCAL_FAKE_IP/32`
    - Dst. Address: `REMOTE_FAKE_IP/32`
    - Protocol: `all`
    - Action: `encrypt`
- вкладка Action:
    - Tunnel: включено (галка)
    - Proposal: `proposal-partner`
    - Level: `require`
    - IPsec Protocols: `esp`
- OK

### 6–8. NAT-правила

`IP → Firewall → вкладка NAT → +`

**Правило 1 (src-nat, исходящий):**

- General: Chain `srcnat`, Src. Address `LOCAL_INTERNAL_IP`, Dst. Address `REMOTE_FAKE_IP`
- Action: `src-nat`, To Addresses: `LOCAL_FAKE_IP`
- Comment: «Partner NAT»

**Правило 2 (netmap, исходящий, опционально/дублирующее):**

- General: Chain `srcnat`, Src. Address `LOCAL_INTERNAL_IP`, Dst. Address `REMOTE_FAKE_IP`
- Action: `netmap`, To Addresses: `LOCAL_FAKE_IP`
- Comment: «Partner OUT»

**Правило 3 (netmap, входящий):**

- General: Chain `dstnat`, Src. Address `REMOTE_FAKE_IP`, Dst. Address `LOCAL_FAKE_IP`
- Action: `netmap`, To Addresses: `LOCAL_INTERNAL_IP`
- Comment: «Partner IN»

---

## Часть 4. Чек-лист типовых ошибок

| Симптом | Вероятная причина |
|---|---|
| `Multiple initiator peers for the same address/dns` | На роутере уже есть peer с таким же `address` (Remote Peer IP) |
| `input does not match any value of peer` (при add identity/policy) | Peer не создался на предыдущем шаге — проверить `/ip ipsec peer print` |
| `ph2-state=no-phase2` долго | Неверный PSK / не совпадают proposal-параметры / партнёр не разрешил твой IP / нет трафика для инициации |
| Туннель поднимается, но данные не идут | Проверить NAT-правила (chain, порядок), а также firewall filter — не блокируется ли трафик до/после NAT |
| Трафик шифруется, но сервер не отвечает | Проверить маршрутизацию на внутреннем сервере — знает ли он, куда слать ответ (обычно default gateway = сам MikroTik, тогда всё ок автоматически) |

---

## Важное общее замечание

Перед выполнением команд **всегда** проверяй, на каком именно устройстве ты находишься:

```routeros
/system identity print
```

И перед созданием нового peer с уже существующим `address` — проверяй, нет ли конфликта:

```routeros
/ip ipsec peer print detail
```

Если конфигурация похожая, но нужна ещё для одного партнёра/сервера — просто меняй суффиксы в именах (`profile-partner2`, `proposal-partner2` и т.д.) и все адреса, чтобы не было пересечений.
