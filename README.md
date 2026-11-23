# Фасоль

Запусти Docker с поддержкой Linux-контейнеров и выполни команду для своей системы из папки проекта.

| Система | Установщик | Команда |
| --- | --- | --- |
| Windows | [install-windows.ps1](install-windows.ps1) | `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1` |
| macOS | [install-macos.command](install-macos.command) | `bash ./install-macos.command` |
| Linux | [install-linux.sh](install-linux.sh) | `bash ./install-linux.sh` |

Установщик запустит приложение и подготовит базу с товарами и фотографиями. Открой [localhost:8080](http://localhost:8080). Для входа укажи сервер `db:1433`, базу `fasol`, логин `sa` и пароль из `.env`. Если база уже была установлена, используй её действующий пароль.

На Apple Silicon и других ARM-устройствах SQL Server запускается через эмуляцию `amd64`. Microsoft эту конфигурацию не поддерживает. [Документация SQL Server](https://learn.microsoft.com/en-us/sql/linux/containers/deploy?view=sql-server-ver16)
