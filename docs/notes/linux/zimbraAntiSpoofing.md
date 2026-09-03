---
title: Анти-спуфинг собственного домена на Zimbra MTA (Postfix)
tags:
  - Linux
  - Zimbra
  - Postfix
  - Почта
  - Безопасность
summary: "Внешние письма приходят с From: на вашем собственном домене без авторизации. Разбор, почему это спуфинг, а не взлом, и пошаговое закрытие через smtpd_restriction_classes в Postfix на Zimbra: какие файлы править, чем применять, как тестировать снаружи и как откатить."
---

# Анти-спуфинг собственного домена на Zimbra MTA (Postfix)

Инструкция описывает, как запретить приём писем с адресом отправителя на собственном домене, если такие письма приходят из интернета без SMTP-авторизации. Реализация — условный reject через `smtpd_restriction_classes` в Postfix (MTA Zimbra), с сохранением работы легитимной почты.

Все команды, кроме явно помеченных, выполняются от пользователя `zimbra`:

```bash
su - zimbra
```

!!! warning "Про правку main.cf напрямую"
    В Zimbra `/opt/zimbra/conf/main.cf` — **генерируемый** файл. Его перезаписывает `zmconfigd` при каждом применении конфигурации. Менять нужно источник: атрибут в LDAP (`zmprov`) или шаблон `zmconfigd.cf`. Правка `main.cf` руками откатится сама и молча.

## Проблема

Мониторинг обнаруживает письма вида:

```text
From: user@example.com
```

которые приходят из внешнего интернета, с IP отправителя из разных стран.

Первое впечатление — компрометация учётных записей. Но проверка учёток показывает, что они не взломаны. Реальная причина — **spoofing**: злоумышленник просто указывает в SMTP-диалоге

```text
MAIL FROM:<user@example.com>
```

и отправляет письмо напрямую на почтовый сервер по `25/tcp`, не проходя никакой авторизации.

## Шаг 0. Диагностика: спуфинг или всё-таки взлом

Найдите подозрительные письма в логе MTA:

```bash
grep "from=<user@example.com>" /var/log/zimbra.log | grep postfix/smtpd
```

Если основной лог пуст — события `postfix/smtpd` могут писаться в отдельный syslog-файл:

```bash
ls -la /var/log/maillog /var/log/mail.log /var/log/zimbra.log 2>/dev/null
grep -l "postfix/smtpd" /var/log/*log 2>/dev/null
```

Проверьте, были ли вообще успешные входы этой учётки (веб / IMAP / SMTP-auth):

```bash
grep "user@example.com" /var/log/zimbra.log | grep -iE "oip=|sasl_username=" | tail -50
```

Отделить спуфинг от взлома — по наличию SASL-авторизации:

```bash
# письма, принятые БЕЗ авторизации, но с отправителем на вашем домене
grep postfix/smtpd /var/log/zimbra.log \
  | grep "from=<[^>]*@example.com>" \
  | grep -v "sasl_username=" \
  | tail -50
```

Характерный результат:

```text
client=unknown[external-ip]
from=<user@sub.example.com>
to=<user@sub.example.com>
```

Письмо якобы отправлено пользователем самому себе, с внешнего IP, без авторизации.

!!! tip "Быстрый критерий"
    Нет `sasl_username=` в строке `postfix/smtpd`, а `from=` — на вашем домене → это подделка отправителя, а не скомпрометированный ящик. Смена паролей проблему не решит.

## Почему SPF/DMARC не решают проблему полностью

SPF и DMARC говорят **чужим** почтовым серверам, что делать с письмами от вашего домена. Собственный входящий сервер эти записи, как правило, сам себе не проверяет. Поэтому цепочка

```text
злоумышленник → ваш MTA → From: user@example.com
```

может пройти, если спам-фильтр не сочтёт письмо достаточно подозрительным.

## Архитектура проблемы

```text
             Интернет
                │
                │ SMTP :25
                ▼
        ┌───────────────┐
        │  MTA (Postfix) │
        └───────┬───────┘
                │
         From: user@example.com
                │
                ▼
          Спам-фильтр
                │
        spam score недостаточен
                │
                ▼
          Ящик пользователя
```

MTA не говорит на SMTP-уровне: «если внешний сервер пытается отправить письмо от имени моего собственного домена — отклонить его». Поэтому часть spoof-писем доходит до пользователей.

## Ключевая сложность решения

Наивное решение — добавить домен в карту с жёстким `REJECT` — **ломает легитимную почту**: авторизованные пользователи и внутренняя сеть тоже отправляют письма с `From:` на собственном домене, и такое правило отклонит и их.

Правильный подход — **условный reject**: разрешить, если отправитель авторизован (SASL) или находится во внутренней доверенной сети, и только в остальных случаях отклонять.

---

## Шаг 1. Бэкап и снятие текущего состояния

```bash
mkdir -p ~/backup-antispoof-$(date +%F)
cd ~/backup-antispoof-$(date +%F)

cp /opt/zimbra/conf/zmconfigd.cf .
cp /opt/zimbra/conf/main.cf .
cp /opt/zimbra/conf/postfix_reject_sender . 2>/dev/null

# текущие значения — понадобятся при откате
postconf -n > postconf-n.before
zmprov gs $(zmhostname) zimbraMtaSmtpdSenderRestrictions > ldap-attrs.before 2>/dev/null
zmprov gcf zimbraMtaSmtpdSenderRestrictions >> ldap-attrs.before 2>/dev/null
```

Определите тип карт, который использует ваша сборка Postfix (`lmdb` в 8.7+, `hash` в старых):

```bash
postconf default_database_type
```

Дальше в примерах — `lmdb`. Если у вас `hash`, подставляйте `hash:` во всех местах, где написано `lmdb:`.

## Шаг 2. Определить restriction class

Найдите, где в шаблоне описаны restriction classes:

```bash
grep -n "smtpd_restriction_classes\|restriction_class" /opt/zimbra/conf/zmconfigd.cf
```

Добавьте в `/opt/zimbra/conf/zmconfigd.cf` (от `root`, редактором — `vi`, `nano`) в секцию, генерирующую `POSTCONF`-директивы:

```text
POSTCONF smtpd_restriction_classes             spoof_own_domain
POSTCONF spoof_own_domain                      permit_mynetworks, permit_sasl_authenticated, reject
```

Смысл: отправитель из доверенной сети (`mynetworks`) или прошедший SMTP-авторизацию (`sasl_authenticated`) — пропускается. Все остальные — `reject`.

!!! note "Если в `smtpd_restriction_classes` уже что-то есть"
    Значение — список через запятую, его нельзя затирать. Сначала посмотрите текущее:
    ```bash
    postconf smtpd_restriction_classes
    ```
    и допишите свой класс к существующим, а не вместо них.

## Шаг 3. Подключить проверку в smtpd_sender_restrictions

Посмотрите текущую цепочку:

```bash
postconf smtpd_sender_restrictions
```

Предпочтительный способ (Zimbra 8.7+, через LDAP — переживает апгрейды):

```bash
# убедиться, что атрибут поддерживается вашей версией
zmprov desc -a zimbraMtaSmtpdSenderRestrictions

# добавить проверку, СОХРАНИВ то, что уже было в цепочке
zmprov ms $(zmhostname) zimbraMtaSmtpdSenderRestrictions \
  "<текущее значение>, check_sender_access lmdb:/opt/zimbra/conf/postfix_reject_sender"
```

Если атрибута в вашей версии нет — правьте ту же строку в `/opt/zimbra/conf/zmconfigd.cf`:

```text
POSTCONF smtpd_sender_restrictions  ... check_sender_access lmdb:/opt/zimbra/conf/postfix_reject_sender
```

!!! danger "Порядок в цепочке имеет значение"
    `check_sender_access` должен стоять **до** финального `permit`. Если он окажется после разрешающего правила — проверка никогда не сработает, а вы будете думать, что настройка не применилась.

## Шаг 4. Карта доменов → restriction class

В карте домен указывается **не** с жёстким `REJECT`, а со ссылкой на restriction class. Сначала — тестовый, заведомо безопасный домен:

```bash
echo "spooftest.example.net spoof_own_domain" >> /opt/zimbra/conf/postfix_reject_sender
postmap lmdb:/opt/zimbra/conf/postfix_reject_sender
```

Проверьте, что ключ действительно читается из скомпилированной карты:

```bash
postmap -q spooftest.example.net lmdb:/opt/zimbra/conf/postfix_reject_sender
# ожидается: spoof_own_domain
```

!!! note "Поддомены наследуются автоматически"
    При доменном поиске Postfix ищет ключ прогрессивно — от специфичного к общему (`sub.example.com` → `example.com` → `com`). Одна запись корневого домена покрывает все поддомены. Проверяется тем же `postmap -q`:
    ```bash
    postmap -q sub.spooftest.example.net lmdb:/opt/zimbra/conf/postfix_reject_sender
    ```

## Шаг 5. Применить конфигурацию

```bash
zmmtactl stop && zmmtactl start
zmconfigdctl restart
```

Мягкий вариант, без разрыва текущих сессий (если правился только шаблон/атрибут):

```bash
zmmtactl reload
```

## Шаг 6. Проверить, что конфигурация реально подхватилась

Это отдельный шаг: правка шаблона ещё не означает, что она попала в рабочий `main.cf`.

```bash
postconf -n | grep -E "smtpd_restriction_classes|spoof_own_domain|smtpd_sender_restrictions"
```

Ожидаемый вывод:

```text
smtpd_restriction_classes = spoof_own_domain
spoof_own_domain = permit_mynetworks, permit_sasl_authenticated, reject
smtpd_sender_restrictions = ... check_sender_access lmdb:/opt/zimbra/conf/postfix_reject_sender
```

Синтаксис Postfix — без ошибок:

```bash
postfix check
```

Диффом относительно бэкапа удобно увидеть ровно то, что изменилось:

```bash
postconf -n > /tmp/postconf-n.after
diff ~/backup-antispoof-*/postconf-n.before /tmp/postconf-n.after
```

## Шаг 7. Тест на фиктивном домене

!!! danger "Условия теста"
    Тест делается **строго снаружи доверенной сети и без авторизации**. Изнутри `mynetworks` или с SASL сработает `permit_*`, вы получите `250 Ok` и решите, что правило не работает.

Со стороннего хоста (не из `mynetworks`), от обычного пользователя:

```bash
swaks --server mail.example.com --port 25 \
      --helo test.example.net \
      --from spoofed@spooftest.example.net \
      --to realuser@example.com
```

Без `swaks` — вручную:

```bash
nc -C mail.example.com 25
```

Диалог (вводите строки после подключения):

```text
EHLO test.example.net
MAIL FROM:<spoofed@spooftest.example.net>
RCPT TO:<realuser@example.com>
```

Ожидаемый ответ на `RCPT TO`:

```text
554 5.7.1 <spoofed@spooftest.example.net>: Sender address rejected: Access denied
```

!!! warning "Не останавливайтесь на MAIL FROM"
    По умолчанию `smtpd_delay_reject = yes`, поэтому на `MAIL FROM` придёт `250 Ok`, даже если транзакция уже помечена на отклонение. Reject приходит только на `RCPT TO`. Проверить настройку:
    ```bash
    postconf smtpd_delay_reject
    ```

Параллельно смотрите лог на сервере:

```bash
tail -f /var/log/zimbra.log | grep -i "Sender address rejected"
```

## Шаг 8. Перенос на боевой домен

Только после успешного теста на фиктивном домене:

```bash
# заменить тестовую запись на боевую
sed -i 's/^spooftest\.example\.net spoof_own_domain$/example.com spoof_own_domain/' \
  /opt/zimbra/conf/postfix_reject_sender

postmap lmdb:/opt/zimbra/conf/postfix_reject_sender
postmap -q example.com lmdb:/opt/zimbra/conf/postfix_reject_sender
zmmtactl reload
```

### Проверка трёх сценариев

**1. Спуфинг извне отклоняется** (снаружи, без авторизации):

```bash
swaks --server mail.example.com --port 25 \
      --from user@example.com --to user@example.com
# ожидается 554 5.7.1 ... Sender address rejected на RCPT TO
```

**2. Легитимная авторизованная отправка проходит** (снаружи, с SASL, порт submission):

```bash
swaks --server mail.example.com --port 587 -tls \
      --auth-user user@example.com --auth-password '<пароль>' \
      --from user@example.com --to user@example.com
# ожидается 250 Ok: queued as ...
```

**3. Поддомены защищены той же одной записью** (снаружи, без авторизации):

```bash
swaks --server mail.example.com --port 25 \
      --from user@sub.example.com --to user@example.com
# ожидается 554 5.7.1 ... Sender address rejected
```

Отправка из внутренней сети (`mynetworks`) проверяется просто письмом с любого внутреннего хоста/сканера/1С — оно должно уходить как раньше.

### Наблюдение после внедрения

Сколько спуфа режется и не задело ли своих:

```bash
grep -c "Sender address rejected" /var/log/zimbra.log
grep "Sender address rejected" /var/log/zimbra.log | awk '{print $7}' | sort | uniq -c | sort -rn | head
```

## Откат

```bash
cp ~/backup-antispoof-*/zmconfigd.cf /opt/zimbra/conf/zmconfigd.cf

# убрать домен из карты
sed -i '/spoof_own_domain$/d' /opt/zimbra/conf/postfix_reject_sender
postmap lmdb:/opt/zimbra/conf/postfix_reject_sender

# вернуть цепочку, если правилась через LDAP
zmprov ms $(zmhostname) zimbraMtaSmtpdSenderRestrictions "<значение из ldap-attrs.before>"

zmmtactl stop && zmmtactl start
zmconfigdctl restart
postconf -n | grep -E "spoof_own_domain|smtpd_sender_restrictions"
```

## Проверочный чек-лист

- [ ] Сделан бэкап `zmconfigd.cf`, карты и вывода `postconf -n`
- [ ] Определён тип карт (`postconf default_database_type`)
- [ ] `smtpd_restriction_classes` содержит `spoof_own_domain` (существующие классы не затёрты)
- [ ] `spoof_own_domain` = `permit_mynetworks, permit_sasl_authenticated, reject`
- [ ] `check_sender_access` добавлен в `smtpd_sender_restrictions` до финального `permit`
- [ ] `postmap` выполнен, `postmap -q` возвращает `spoof_own_domain`
- [ ] `postconf -n` показывает изменения, `postfix check` без ошибок
- [ ] Тест на фиктивном домене: снаружи, без авторизации, доведён до `RCPT TO` → `554`
- [ ] Правило перенесено на боевой домен
- [ ] Спуфинг извне отклоняется
- [ ] Авторизованная отправка (587/SASL) проходит
- [ ] Отправка из `mynetworks` проходит
- [ ] Поддомен отклоняется одной записью корневого домена
- [ ] Найден и проверен нужный лог-файл `postfix/smtpd`

## Частые ошибки

- **Правка `main.cf` напрямую** — `zmconfigd` перезапишет файл, изменения исчезнут.
- **Жёсткий `REJECT` вместо restriction class** — отклоняет и собственных авторизованных пользователей.
- **Забыт `postmap`** — текстовый файл изменён, а Postfix читает старую скомпилированную карту.
- **Затёрт список `smtpd_restriction_classes`** — вместе с чужими классами ломаются другие проверки.
- **`check_sender_access` после `permit`** — до проверки дело не доходит.
- **Тест изнутри сети или с авторизацией** — срабатывает `permit_*`, кажется, что правило не работает.
- **Остановка на `MAIL FROM`** — из-за `smtpd_delay_reject = yes` там будет `250 Ok`.
- **Правка сразу боевого домена** — ошибка в синтаксисе карты бьёт по всей почте домена.
- **Проверка не того лог-файла** — события есть, но ищутся не там, где пишутся.
- **Расчёт только на SPF/DMARC** — они управляют поведением чужих серверов, а не вашего входящего MTA.

## Итог

- Анти-спуфинг реализован через **условный** restriction class, а не через жёсткий `REJECT` — это критично для сохранения легитимной почты.
- Одна запись домена в карте покрывает все поддомены.
- Пошаговая проверка (тестовый домен → боевой домен, `MAIL FROM` → `RCPT TO`, `postconf -n` после каждого применения) позволяет внедрить изменение без риска сломать доставку.

---

## Смежные заметки

- [Назначение прав глобального администратора в Zimbra](zimbraAdmin.md) — базовые операции с `zmprov` на том же сервере.
