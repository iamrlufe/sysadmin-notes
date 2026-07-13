---
tags:
  - Сети
  - VPN
  - MikroTik
summary: Таблица соответствия DH-групп между MikroTik RouterOS и Juniper SSG (ScreenOS) при настройке IPsec VPN.
section_label: Сети
date: 2026-07-13T13:10:41+08:00
---

# Сопоставление групп Diffie-Hellman в MikroTik и Juniper SSG

При настройке IPsec VPN между **MikroTik RouterOS** и **Juniper SSG (ScreenOS)** можно столкнуться с разными названиями групп Diffie-Hellman.

Например, в Juniper указывается:

```text
Group 14
```

А в MikroTik эта же группа называется:

```text
modp2048
```

Из-за различий в именовании легко ошибочно выбрать разные DH-группы на сторонах VPN.

## Таблица соответствия DH-групп

| DH Group | Размер | MikroTik RouterOS | Juniper SSG / ScreenOS |
|---|---:|---|---|
| Group 1 | 768 bit | `modp768` | `Group 1` |
| Group 2 | 1024 bit | `modp1024` | `Group 2` |
| Group 5 | 1536 bit | `modp1536` | `Group 5` |
| Group 14 | 2048 bit | `modp2048` | `Group 14` |
| Group 15 | 3072 bit | `modp3072` | `Group 15` |
| Group 16 | 4096 bit | `modp4096` | `Group 16` |
| Group 17 | 6144 bit | `modp6144` | `Group 17` |
| Group 18 | 8192 bit | `modp8192` | `Group 18` |
| Group 19 | ECP 256 bit | `ecp256` | `Group 19`* |
| Group 20 | ECP 384 bit | `ecp384` | `Group 20`* |

> Поддержка ECP-групп зависит от модели Juniper и версии ScreenOS. Для старых Juniper SSG необходимо проверять доступные группы непосредственно на устройстве.

## Быстрая шпаргалка

Наиболее часто встречающиеся соответствия:

```text
Juniper Group 1  = MikroTik modp768
Juniper Group 2  = MikroTik modp1024
Juniper Group 5  = MikroTik modp1536
Juniper Group 14 = MikroTik modp2048
```

То есть:

```text
Group 14 = modp2048
```

Это одна и та же группа Diffie-Hellman.

## Где настраивается DH Group в MikroTik

В MikroTik группа Diffie-Hellman для Phase 1 указывается в IPsec Profile:

```routeros
/ip ipsec profile
add name=juniper-profile \
    dh-group=modp2048 \
    enc-algorithm=aes-256 \
    hash-algorithm=sha256
```

В данном примере:

```text
dh-group=modp2048
```

соответствует:

```text
DH Group 14
```

на Juniper.

Проверить текущие IPsec Profile:

```routeros
/ip ipsec profile print detail
```

## PFS и Phase 2 в MikroTik

Для Phase 2 группа указывается отдельно в IPsec Proposal:

```routeros
/ip ipsec proposal
add name=juniper-proposal \
    auth-algorithms=sha256 \
    enc-algorithms=aes-256-cbc \
    pfs-group=modp2048
```

Параметр:

```text
pfs-group=modp2048
```

означает использование:

```text
PFS DH Group 14
```

Если на Juniper PFS отключён, на MikroTik необходимо указать:

```routeros
pfs-group=none
```

Проверить Proposal:

```routeros
/ip ipsec proposal print detail
```

## Где настраивается DH Group в Juniper SSG

В Juniper SSG / ScreenOS группа выбирается в настройках IKE Proposal.

Пример:

```text
Diffie-Hellman Group: Group 14
```

Для MikroTik этому соответствует:

```text
dh-group=modp2048
```

Пример соответствия параметров Phase 1:

| Juniper SSG | MikroTik |
|---|---|
| AES-256 | `aes-256` |
| SHA-256 | `sha256` |
| DH Group 14 | `modp2048` |

Таким образом:

```text
Juniper:
AES-256
SHA-256
Group 14
```

должен соответствовать:

```routeros
enc-algorithm=aes-256
hash-algorithm=sha256
dh-group=modp2048
```

## Важное различие: Phase 1 и Phase 2

DH Group может использоваться в двух разных местах.

### Phase 1 — IKE

На MikroTik:

```text
/ip ipsec profile
dh-group
```

На Juniper:

```text
IKE Proposal
Diffie-Hellman Group
```

Пример:

```text
Juniper Group 14
        ↓
MikroTik modp2048
```

### Phase 2 — IPsec / PFS

На MikroTik:

```text
/ip ipsec proposal
pfs-group
```

На Juniper:

```text
IPsec Proposal
Perfect Forward Secrecy
Key Group
```

Если используется:

```text
Juniper PFS Group 14
```

то на MikroTik необходимо указать:

```text
pfs-group=modp2048
```

Если PFS на Juniper отключён:

```text
pfs-group=none
```

## Пример настройки MikroTik для Juniper Group 14

Phase 1:

```routeros
/ip ipsec profile
add name=juniper \
    enc-algorithm=aes-256 \
    hash-algorithm=sha256 \
    dh-group=modp2048
```

Phase 2 с PFS Group 14:

```routeros
/ip ipsec proposal
add name=juniper \
    auth-algorithms=sha256 \
    enc-algorithms=aes-256-cbc \
    pfs-group=modp2048
```

Со стороны Juniper параметры должны соответствовать:

```text
Phase 1:
Encryption: AES-256
Hash: SHA-256
DH Group: Group 14

Phase 2:
Encryption: AES-256
Authentication: SHA-256
PFS: Enabled
Key Group: Group 14
```

## Что проверить, если VPN не поднимается

При ошибках согласования IKE необходимо проверить:

1. Encryption Algorithm.
2. Hash Algorithm.
3. Diffie-Hellman Group.
4. IKE Version.
5. Pre-Shared Key.
6. Lifetime Phase 1.
7. PFS Group.
8. Lifetime Phase 2.

Особое внимание необходимо обратить на DH Group.

В Juniper используется номер группы:

```text
Group 14
```

В MikroTik необходимо выбирать соответствующее название:

```text
modp2048
```

Правильное соответствие:

```text
Juniper Group 14 = MikroTik modp2048
```

## Итог

При настройке IPsec между MikroTik и Juniper SSG необходимо сопоставлять номер DH-группы Juniper с названием MODP/ECP в MikroTik.

Основные соответствия:

```text
Group 1  = modp768
Group 2  = modp1024
Group 5  = modp1536
Group 14 = modp2048
Group 15 = modp3072
Group 16 = modp4096
Group 17 = modp6144
Group 18 = modp8192
Group 19 = ecp256
Group 20 = ecp384
```

Для большинства современных конфигураций IPsec часто используется:

```text
DH Group 14 / modp2048
```

На MikroTik это:

```text
dh-group=modp2048
```

На Juniper:

```text
Diffie-Hellman Group 14
```