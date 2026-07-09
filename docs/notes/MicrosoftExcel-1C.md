# Настройка DCOM для Microsoft Excel Application (1С)

Данная инструкция позволяет настроить права DCOM для компонента **Microsoft Excel Application**, который используется при работе 1С с Microsoft Excel.

> **Важно:** Все действия необходимо выполнять от имени администратора.

---

## 1. Открыть службы компонентов

Нажмите **Win + R** и выполните:

```cmd
dcomcnfg
```

Или откройте 32-битную оснастку (если Excel не отображается):

```cmd
mmc comexp.msc /32
```

Перейдите:

```
Component Services
└── Computers
    └── My Computer
        └── DCOM Config
```

Найдите:

```
Microsoft Excel Application
```

---

## 2. Если отсутствует Microsoft Excel Application

Проверьте наличие раздела реестра:

```
HKEY_CLASSES_ROOT\AppID\EXCEL.EXE
```

Если раздел отсутствует:

1. Создайте ключ:

```
EXCEL.EXE
```

2. Установите значение **(По умолчанию)** типа **REG_SZ**:

```
{00020812-0000-0000-C000-000000000046}
```

После этого снова выполните:

```cmd
mmc comexp.msc /32
```

Компонент **Microsoft Excel Application** должен появиться в списке DCOM.

Или скачайте 
[Скачать MicrosoftExcelApplication.reg](../files/MicrosoftExcelApplication.reg)
---

# Настройка разрешений

Откройте свойства:

```
Microsoft Excel Application
```

## 3. Launch and Activation Permissions

Перейдите на вкладку:

```
Security
```

В разделе:

```
Launch and Activation Permissions
```

Выберите:

```
Customize → Edit
```

Добавьте учетную запись, от имени которой запускается служба **1С**.

Назначьте разрешения:

- ✅ Local Launch
- ✅ Local Activation

---

## 4. Access Permissions

В том же окне откройте раздел:

```
Access Permissions
```

Выберите:

```
Customize → Edit
```

Добавьте ту же учетную запись службы 1С.

Выдайте право:

- ✅ Local Access

Нажмите **OK** для сохранения изменений.

---

# Настройка папок Desktop

Проверьте наличие каталогов:

```
C:\Windows\System32\config\systemprofile\Desktop
```

и

```
C:\Windows\SysWOW64\config\systemprofile\Desktop
```

Если какой-либо каталог отсутствует — создайте его.

---

## 5. Настройка прав на папки

Для обеих папок предоставьте учетной записи, от имени которой работает служба **1С**, следующие права:

- ✅ Полный доступ (Full Control)

---

# Проверка

После выполнения всех настроек рекомендуется:

1. Перезапустить службу 1С.
2. При необходимости перезапустить сервер.
3. Проверить выполнение операций, использующих Microsoft Excel (печать, экспорт, обработка Excel-файлов).

---

# Возможные проблемы

### Microsoft Excel Application отсутствует

Запустите:

```cmd
mmc comexp.msc /32
```

и убедитесь, что существует раздел:

```
HKEY_CLASSES_ROOT\AppID\EXCEL.EXE
```

---

### Ошибка доступа при работе с Excel

Проверьте:

- права DCOM;
- права на папки `Desktop`;
- под какой учетной записью работает служба 1С.

---

# Итог

После корректной настройки:

- Microsoft Excel сможет запускаться из службы 1С;
- исчезнут ошибки DCOM при автоматизации Excel;
- экспорт и обработка Excel-файлов из 1С будут выполняться корректно.