# Назначение прав глобального администратора в Zimbra 8.8.12 (CLI)

## Версия

Инструкция проверена для:

- **Zimbra Collaboration Open Source Edition**
- **Release 8.8.12.GA.3794.UBUNTU18.64**
- **Patch 8.8.12_P6**
- **Ubuntu 18.04**

---

# Назначение существующего пользователя глобальным администратором

Переключитесь на пользователя **zimbra**:

```bash
su - zimbra
```

Выдайте пользователю права глобального администратора:

```bash
zmprov ma user@example.com zimbraIsAdminAccount TRUE
```

где:

- `user@example.com` — существующий почтовый ящик.

После выполнения команды пользователь становится **Global Administrator** и получает полный доступ к административной консоли Zimbra. citeturn0search0turn0search1

---

# Проверка

Проверьте, что атрибут установлен:

```bash
zmprov ga user@example.com zimbraIsAdminAccount
```

Ожидаемый результат:

```text
# name user@example.com
zimbraIsAdminAccount: TRUE
```

Можно также посмотреть список всех администраторов:

```bash
zmprov gaaa
```

Команда выводит все учетные записи, имеющие права администратора. citeturn0search2turn0search1

---

# Вход в административную панель

После выдачи прав пользователь может войти в административную консоль:

```
https://mail.example.com:7071
```

или

```
https://IP_сервера:7071
```

Используйте полный адрес электронной почты в качестве логина.

Например:

```
admin@example.com
```

---

# Создание нового администратора

Если администратора еще нет, можно создать его сразу с административными правами:

```bash
su - zimbra

zmprov ca admin2@example.com StrongPassword123 \
    zimbraIsAdminAccount TRUE
```

После создания учетная запись сразу станет глобальным администратором. citeturn0search0

---

# Сброс пароля администратора

При необходимости пароль можно изменить из CLI:

```bash
su - zimbra

zmprov sp admin@example.com NewStrongPassword
```

---

# Отзыв прав администратора

Чтобы снять права глобального администратора:

```bash
su - zimbra

zmprov ma user@example.com zimbraIsAdminAccount FALSE
```

Проверка:

```bash
zmprov ga user@example.com zimbraIsAdminAccount
```

Результат:

```text
zimbraIsAdminAccount: FALSE
```

---

# Полезные команды

Показать информацию об учетной записи:

```bash
zmprov ga user@example.com
```

Показать только административный атрибут:

```bash
zmprov ga user@example.com zimbraIsAdminAccount
```

Список всех администраторов:

```bash
zmprov gaaa
```

Проверить статус сервисов Zimbra:

```bash
zmcontrol status
```

Показать версию Zimbra:

```bash
zmcontrol -v
```

---

# Возможные ошибки

### Нет прав

```
ERROR: account.NO_SUCH_ACCOUNT
```

Пользователь не существует.

Проверьте адрес:

```bash
zmprov ga user@example.com
```

---

### Команда не найдена

```
zmprov: command not found
```

Не выполнен вход под пользователем **zimbra**.

Используйте:

```bash
su - zimbra
```

---

### Не открывается консоль администратора

Проверьте работу сервисов:

```bash
zmcontrol status
```

Проверьте доступность порта **7071**:

```bash
ss -ltnp | grep 7071
```

---

# Итог

Для назначения существующего пользователя глобальным администратором достаточно одной команды:

```bash
su - zimbra
zmprov ma user@example.com zimbraIsAdminAccount TRUE
```

После этого пользователь сможет авторизоваться в административной консоли Zimbra по адресу:

```
https://<server>:7071
```

с полными административными правами. 