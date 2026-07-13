# Отложенный запуск команды в Linux с помощью `at`

Утилита `at` позволяет выполнить команду один раз в указанное время или через заданный промежуток времени.

Например, необходимо перезагрузить конфигурацию Nginx в Docker-контейнере через 4 часа.

## Установка `at`

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install at -y
```

Включить и запустить службу:

```bash
sudo systemctl enable --now atd
```

Проверить состояние:

```bash
systemctl status atd
```

### RHEL / CentOS / Rocky Linux / AlmaLinux

```bash
sudo dnf install at -y
```

Для старых версий CentOS:

```bash
sudo yum install at -y
```

Запустить службу:

```bash
sudo systemctl enable --now atd
```

## Выполнение команды через 4 часа

Пример:

```bash
echo 'docker exec nginx-proxy nginx -s reload' | at now + 4 hours
```

Результат:

```text
warning: commands will be executed using /bin/sh
job 1 at Mon Jul 13 13:33:00 2026
```

Команда будет автоматически выполнена в указанное время.

## Просмотр запланированных заданий

```bash
atq
```

Пример:

```text
1    Mon Jul 13 13:33:00 2026 a rlufe
```

Где:

- `1` — ID задания
- `Mon Jul 13 13:33:00 2026` — время выполнения
- `rlufe` — пользователь, от имени которого будет запущена команда

## Просмотр команды задания

Узнать содержимое задания:

```bash
at -c 1
```

Где `1` — ID задания из `atq`.

## Удаление задания

Отменить запланированное выполнение:

```bash
atrm 1
```

После этого проверить:

```bash
atq
```

Если вывод пустой, активных заданий нет.

## Другие примеры

Выполнить команду через 30 минут:

```bash
echo '/path/to/script.sh' | at now + 30 minutes
```

Через 2 часа:

```bash
echo '/path/to/script.sh' | at now + 2 hours
```

Сегодня в 23:00:

```bash
echo '/path/to/script.sh' | at 23:00
```

Завтра в 03:00:

```bash
echo '/path/to/script.sh' | at 03:00 tomorrow
```

## Важно

Команда выполняется от имени пользователя, который создал задание.

Например, если задание создано пользователем `rlufe`, этот пользователь должен иметь необходимые права для выполнения команды.

Для Docker проверь:

```bash
docker ps
```

Если команда требует `sudo`, необходимо учитывать, что `at` выполняет задания без интерактивного ввода пароля.