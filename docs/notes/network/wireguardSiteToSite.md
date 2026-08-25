---
title: Site-to-site туннель WireGuard на MikroTik (миграция с IPsec)
tags:
  - Сети
  - VPN
  - MikroTik
  - WireGuard
  - IPsec
summary: "Перевод site-to-site туннеля с policy-based IPsec на route-based WireGuard между двумя MikroTik на RouterOS 7+: интерфейс, обмен ключами, peer с allowed-address, маршруты, проверка handshake и безопасное отключение старого IPsec."
---

# Site-to-site туннель WireGuard на RouterOS (MikroTik)

Инструкция описывает перевод одного site-to-site туннеля с IPsec (policy-based) на WireGuard (route-based) между двумя роутерами MikroTik с RouterOS 7+. Выполняется через WinBox на обеих сторонах.

## Идея миграции

В IPsec policy-based для каждой пары подсетей (src/dst) нужна отдельная policy. В WireGuard туннель — route-based: маршрутизация решается через таблицу маршрутов и allowed-ips, а не через набор policy. Поэтому даже если на одном конце несколько локальных подсетей, достаточно:

- **На стороне A**: одного peer + одного (или нескольких) static route до сетей стороны B, при этом allowed-ips peer'а = сети стороны B.
- **На стороне B**: зеркально — allowed-ips = все сети стороны A, и по маршруту на каждую из них.

## Подготовка (сделать на обеих сторонах заранее)

Заранее согласуйте между сторонами:

| Параметр | Пример |
|---|---|
| WAN-адрес стороны A | `<WAN_IP_A>` |
| WAN-адрес стороны B | `<WAN_IP_B>` |
| UDP-порт WireGuard (слушает сторона A) | `<PORT_A>` |
| UDP-порт WireGuard (слушает сторона B) | `<PORT_B>` |
| Подсеть для самого туннеля (point-to-point) | `10.255.255.0/30` |
| IP стороны A на туннеле | `10.255.255.1/30` |
| IP стороны B на туннеле | `10.255.255.2/30` |
| Локальные сети стороны A | `<LAN_A_1>, <LAN_A_2>, ...` |
| Локальные сети стороны B | `<LAN_B_1>, <LAN_B_2>, ...` |

Каждая сторона отдаёт другой свой Public Key (генерируется автоматически, это не секрет — можно передавать открытым текстом).

---

## Шаги на стороне A

Каждый шаг — сначала через WinBox (GUI), рядом эквивалент через консоль (CLI: `New Terminal` в WinBox или SSH).

1. **Создать интерфейс.**
   GUI: `WireGuard → вкладка WireGuard → плюс`
   Name: произвольное осмысленное (например `wg-<название удалённой точки>`)
   Listen Port: `<PORT_A>`
   Остальное — по умолчанию, ключи сгенерируются автоматически. `OK`.

    ```routeros
    /interface wireguard add name=wg-<remote> listen-port=<PORT_A>
    ```

2. **Скопировать свой Public Key.**
   GUI: двойной клик по созданному интерфейсу → скопировать значение поля **Public Key** → передать стороне B.

    ```routeros
    /interface wireguard print
    ```

    (значение из колонки `public-key` — передать стороне B)

3. **Назначить IP на интерфейс.**
   GUI: `IP → Addresses → плюс`
   Address: `10.255.255.1/30`
   Interface: созданный wg-интерфейс
   `OK`.

    ```routeros
    /ip address add address=10.255.255.1/30 interface=wg-<remote>
    ```

4. **Разрешить порт в firewall.**
   GUI: `IP → Firewall → Filter Rules → плюс`
   Chain: `input`, Protocol: `udp`, Dst. Port: `<PORT_A>`, Action: `accept`
   Поднять правило выше любых drop-правил.

    ```routeros
    /ip firewall filter add chain=input protocol=udp dst-port=<PORT_A> action=accept place-before=0 comment="wg-<remote>"
    ```

    (`place-before=0` ставит правило первым в списке — при необходимости поправьте номер под свою нумерацию правил)

5. **Добавить peer (сторона B).**
   GUI: `WireGuard → вкладка Peers → плюс`
   Interface: созданный wg-интерфейс
   Public Key: ключ, полученный от стороны B
   Endpoint: `<WAN_IP_B>`
   Endpoint Port: `<PORT_B>`
   Allowed Address: все сети стороны B + подсеть туннеля, через запятую, например: `<LAN_B_1>,<LAN_B_2>,10.255.255.0/30`
   Persistent Keepalive: `25`

    ```routeros
    /interface wireguard peers add interface=wg-<remote> public-key="<PUBLIC_KEY_B>" endpoint-address=<WAN_IP_B> endpoint-port=<PORT_B> allowed-address=<LAN_B_1>,<LAN_B_2>,10.255.255.0/30 persistent-keepalive=25
    ```

6. **Добавить маршруты до сетей стороны B.**
   GUI: `IP → Routes → плюс` (по одному на каждую сеть B)
   Dst. Address: `<LAN_B_x>`
   Gateway: имя wg-интерфейса (текстом, без IP)
   `OK`

    ```routeros
    /ip route add dst-address=<LAN_B_1> gateway=wg-<remote>
    /ip route add dst-address=<LAN_B_2> gateway=wg-<remote>
    ```

    (по одной команде на каждую сеть)

7. **Проверить связь.**
   GUI: `New Terminal → ping 10.255.255.2` (адрес стороны B на туннеле), затем `ping` любого хоста из сети B.
   В `WireGuard → Peers` должны появиться ненулевые Rx/Tx и заполненный **Last Handshake**.

    ```routeros
    /ping 10.255.255.2 count=5
    /interface wireguard peers print stats
    ```

    (смотреть на `last-handshake`, `rx`, `tx`)

8. **Отключить старый IPsec (только после успешной проверки).**
   GUI: `IPsec → Peers` → выбрать нужный peer → Disable; `IPsec → Policies` → отключить соответствующие policy тем же способом.

    ```routeros
    /ip ipsec peer disable [find name=<peer_name>]
    /ip ipsec policy disable [find peer=<peer_name>]
    ```

---

## Шаги на стороне B (зеркально)

1. **Создать интерфейс.**
   GUI: WireGuard-интерфейс, Listen Port: `<PORT_B>`.

    ```routeros
    /interface wireguard add name=wg-<remote-a> listen-port=<PORT_B>
    ```

2. **Скопировать Public Key**, передать стороне A.

    ```routeros
    /interface wireguard print
    ```

3. **Назначить IP на интерфейс: `10.255.255.2/30`.**

    ```routeros
    /ip address add address=10.255.255.2/30 interface=wg-<remote-a>
    ```

4. **Разрешить `<PORT_B>/udp` в firewall (chain input).**

    ```routeros
    /ip firewall filter add chain=input protocol=udp dst-port=<PORT_B> action=accept place-before=0
    ```

5. **Добавить peer:**
   Public Key — от стороны A; Endpoint: `<WAN_IP_A>`, Endpoint Port: `<PORT_A>`; Allowed Address: все сети стороны A + `10.255.255.0/30`; Persistent Keepalive: `25`.

    ```routeros
    /interface wireguard peers add interface=wg-<remote-a> public-key="<PUBLIC_KEY_A>" endpoint-address=<WAN_IP_A> endpoint-port=<PORT_A> allowed-address=<LAN_A_1>,<LAN_A_2>,10.255.255.0/30 persistent-keepalive=25
    ```

6. **Добавить маршруты до всех сетей стороны A (Gateway = wg-интерфейс).**

    ```routeros
    /ip route add dst-address=<LAN_A_1> gateway=wg-<remote-a>
    /ip route add dst-address=<LAN_A_2> gateway=wg-<remote-a>
    ```

7. **Проверить `ping 10.255.255.1` и пинг вглубь сети A, свериться по Last Handshake.**

    ```routeros
    /ping 10.255.255.1 count=5
    /interface wireguard peers print stats
    ```

8. **Отключить старый IPsec после проверки.**

    ```routeros
    /ip ipsec peer disable [find name=<peer_name>]
    /ip ipsec policy disable [find peer=<peer_name>]
    ```

---

## Частые ошибки

- **Allowed Address перепутаны** — на каждой стороне указываются сети *противоположной* стороны, а не свои.
- **Порты не совпадают** — Endpoint Port на одной стороне должен быть равен Listen Port на другой.
- **Firewall блокирует UDP-порт** — если Last Handshake не появляется, первым делом проверить input-правила и порядок правил (accept должен быть выше drop).
- **Gateway в routes указан как IP, а не как интерфейс** — для WireGuard point-to-point без выделенного адреса шлюза правильно указывать имя интерфейса.
- **Старый IPsec выключен раньше времени** — сначала полная проверка WireGuard (handshake + реальный пинг вглубь сети), потом отключение IPsec, и не сразу удаление, а Disable на несколько дней.

## Проверочный чек-лист перед отключением IPsec

- [ ] Интерфейс WireGuard создан и активен на обеих сторонах
- [ ] Публичные ключи обменены и вписаны корректно (без опечаток/пробелов)
- [ ] Порты совпадают на обеих сторонах
- [ ] Firewall пропускает UDP-порт на обеих сторонах
- [ ] Last Handshake отображается и обновляется
- [ ] Rx/Tx растут при пинге
- [ ] Пинг проходит вглубь удалённой сети (не только до точки на туннеле)
- [ ] Маршруты до всех нужных подсетей добавлены с обеих сторон
- [ ] Старый IPsec переведён в Disable (не удалён)

---

## Смежные заметки

- [Debug IPsec MikroTik](debugIpsec.md) — если на время миграции старый туннель ещё нужно чинить.
- [IPsec-туннель host-to-host с NAT netmap на MikroTik](mikrotikIpsecNatNetmap.md) — схема, которую не всегда получится перевести на WireGuard «в лоб»: там адреса согласованы с внешним партнёром.
- [Различия DH Group: MikroTik vs Juniper ScreenOS](dh.md) — актуально для IPsec-стороны, у WireGuard набор криптографии фиксирован и не согласуется.
