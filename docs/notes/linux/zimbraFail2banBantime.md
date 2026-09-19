---
title: "Fail2ban на почтовом сервере Zimbra: увеличение времени блокировки"
tags:
  - Linux
  - Zimbra
  - Fail2ban
  - Почта
  - Безопасность
summary: "Увеличение bantime в тюрьмах fail2ban для Zimbra с суток до 30 дней: где задан параметр, в каком порядке читаются конфиги, как через dbpurgeage сохранить баны после рестарта, проверка, разбан своих адресов и ignoreip."
---

# Fail2ban на почтовом сервере Zimbra: увеличение времени блокировки

Инструкция описывает, как увеличить срок бана в тюрьмах fail2ban, защищающих Zimbra, с суток до 30 дней и сделать так, чтобы баны переживали рестарт службы. Тюрьма SSH остаётся как есть (600 секунд).

Все команды выполняются от `root`.

## Исходная ситуация

Изначально `bantime = 86400` (сутки) был задан в двух файлах:

| Файл | Тюрьма | Лог |
|---|---|---|
| `/etc/fail2ban/jail.d/zimbra.conf` | zimbra-auth | `/var/log/mail.log` |
| `/etc/fail2ban/jail.d/zimbra-web.conf` | zimbra-web | `/opt/zimbra/log/audit.log` |

Найти, где задан параметр:

```bash
ls -l /etc/fail2ban/jail.local /etc/fail2ban/jail.d/
grep -rn "bantime" /etc/fail2ban/jail.local /etc/fail2ban/jail.d/
```

Fail2ban читает конфиги в этом порядке, последний прочитанный побеждает:

```text
jail.conf → jail.d/*.conf → jail.local → jail.d/*.local
```

!!! warning "Не править jail.conf и fail2ban.conf"
    Обновление пакета их затрёт. Свои настройки — только в `jail.local`, `fail2ban.local` и файлах в `jail.d/`.

## Шаг 1. Время блокировки 30 дней

Меняем `bantime` на 2592000 секунд в обеих тюрьмах Zimbra. Команда заменяет любое текущее значение:

```bash
sed -i 's/^bantime = .*/bantime = 2592000/' /etc/fail2ban/jail.d/zimbra.conf /etc/fail2ban/jail.d/zimbra-web.conf
grep -n "bantime" /etc/fail2ban/jail.d/zimbra*.conf
fail2ban-client -t && fail2ban-client reload
```

Другие сроки:

| Срок | bantime, сек |
|---|---|
| 1 сутки | 86400 |
| 1 неделя | 604800 |
| 30 дней | 2592000 |
| Навсегда | -1 |

Вечный бан (`-1`) не используем: ошибка пароля за офисным NAT блокирует весь офис, а список правил iptables растёт бесконечно.

Уже забаненные IP досиживают старый срок, новый действует для новых банов.

## Шаг 2. Хранение банов после рестарта

`dbpurgeage` должен быть не меньше `bantime`. По умолчанию он равен `1d`, и после рестарта fail2ban баны старше суток из базы не восстанавливаются.

```bash
cat > /etc/fail2ban/fail2ban.local << 'EOF'
[Definition]
dbpurgeage = 30d
EOF
fail2ban-client -t && systemctl restart fail2ban
sleep 2
fail2ban-client get dbpurgeage
```

Ожидаемый результат: `2592000seconds`.

!!! warning "Секция обязательно [Definition]"
    С `[DEFAULT]` fail2ban принимает конфиг без ошибок, но игнорирует значение и оставляет 86400.

## Шаг 3. Проверка

Значение `bantime` по всем тюрьмам:

```bash
for j in $(fail2ban-client status | grep "Jail list" | sed 's/.*://;s/,//g'); do echo -n "$j: "; fail2ban-client get $j bantime; done
```

Ожидаемый вывод:

```text
sshd: 600
zimbra-auth: 2592000
zimbra-web: 2592000
```

Кто сейчас в бане:

```bash
fail2ban-client status zimbra-auth
fail2ban-client status zimbra-web
```

После рестарта `Total failed` обнуляется, а `Currently banned` восстанавливается из базы, это норма. В `zimbra-web` особенно смотри на адреса своей страны: чаще всего это свои пользователи, ошибшиеся с паролем.

## Шаг 4. Разбан своих IP и ignoreip

В `zimbra-web` оказались забанены два наших адреса — в примерах ниже это `203.0.113.10` и `198.51.100.20`.

1. Проверить, чей адрес и какие учётки с него ломились:

    ```bash
    whois 203.0.113.10 | grep -iE "country|netname|descr"
    grep -E "203.0.113.10|198.51.100.20" /opt/zimbra/log/audit.log | tail -20
    ```

2. Разбанить:

    ```bash
    fail2ban-client set zimbra-web unbanip 203.0.113.10
    fail2ban-client set zimbra-web unbanip 198.51.100.20
    ```

3. Если адреса статические (офисы), добавить в `ignoreip` в `/etc/fail2ban/jail.local`:

    ```bash
    sed -i 's/^ignoreip = .*/& 203.0.113.10 198.51.100.20/' /etc/fail2ban/jail.local
    grep ignoreip /etc/fail2ban/jail.local
    fail2ban-client -t && fail2ban-client reload
    fail2ban-client get zimbra-web ignoreip
    ```

Динамические домашние IP пользователей в `ignoreip` не добавляем: завтра этот адрес может достаться кому угодно. Для них достаточно разбана.

## Шпаргалка

| Задача | Команда |
|---|---|
| Проверить конфиг | `fail2ban-client -t` |
| Перечитать тюрьмы | `fail2ban-client reload` |
| Список тюрем | `fail2ban-client status` |
| Забаненные в тюрьме | `fail2ban-client status zimbra-auth` |
| Текущий bantime | `fail2ban-client get zimbra-auth bantime` |
| Разбанить IP | `fail2ban-client set zimbra-web unbanip <IP>` |
| Забанить IP вручную | `fail2ban-client set zimbra-auth banip <IP>` |
| Срок хранения базы | `fail2ban-client get dbpurgeage` |

Частые ошибки:

- `<имя_тюрьмы>` из примеров нужно заменять реальным именем, иначе bash принимает угловые скобки за перенаправление.
- `dbpurgeage` в секции `[DEFAULT]` молча игнорируется, нужна `[Definition]`.
- `cat >` вместо `cat >>` для `jail.local` затирает `ignoreip`.
- Правка `jail.conf` или `fail2ban.conf` теряется при обновлении пакета.
