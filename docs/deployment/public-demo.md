# Открыть демонстрацию по HTTPS

Публичный синтетический стенд работает отдельно от локальных проверок. Текущий адрес для защиты: https://sandwich-benjamin-mai-limited.trycloudflare.com. Это временный Cloudflare Quick Tunnel. Адрес изменится после нового запуска туннеля. Доступ зависит от работающего компьютера, Docker и процесса `cloudflared`.

Учётные записи `employee.demo`, `manager.demo` и `hr.demo` представляют разные роли. Пароль хранится только в закрытом локальном файле. Чтобы получить его на компьютере владельца, выполните:

```bash
python3 scripts/dev.py credentials --env-file .artifacts/public-demo/.env
```

Не помещайте вывод в Git, слайды, запись экрана или публичный журнал. Все люди, учебные кейсы и регламенты вымышлены. Публичный стенд использует поиск выдержек из опубликованных материалов. 1C и Documentolog работают через mock-адаптеры. Квитанция подтверждает получение документа адаптером.

## Запустить отдельный стенд

Используйте установленный `cloudflared` из [официального выпуска Cloudflare](https://github.com/cloudflare/cloudflared/releases). Сверьте файл с опубликованной контрольной суммой. На этом компьютере проверен выпуск `2026.10.1`. Не загружайте личную конфигурацию Cloudflare в демонстрационный процесс.

```bash
install -d -m 700 .artifacts/public-demo
python3 scripts/dev.py prepare --env-file .artifacts/public-demo/.env
printf '{}\n' > .artifacts/public-demo/cloudflared-empty.yaml
chmod 600 .artifacts/public-demo/cloudflared-empty.yaml
cloudflared tunnel --config .artifacts/public-demo/cloudflared-empty.yaml \
  --no-autoupdate --url http://127.0.0.1:8095
```

Оставьте процесс работающим. В другом терминале добавьте в созданный `.artifacts/public-demo/.env` значения `PUBLIC_HOST`, `API_PORT=8015` и `FRONTEND_PORT=8095`. `PUBLIC_HOST` содержит только имя нового сервера без `https://` и пути. Сохраните права файла `0600`. Не меняйте ключи существующей базы при повторном запуске.

```bash
COMPOSE_PROJECT_NAME=janamen-public COMPOSE_FILE=compose.yaml:compose.public.yaml \
  python3 scripts/dev.py up --env-file .artifacts/public-demo/.env
```

Проверьте `db`, `api` и `frontend` через `docker compose ps` с теми же параметрами проекта и файла. Worker должен работать, а release должен завершиться с кодом 0. Запрос к `https://<PUBLIC_HOST>/api/v1/ready/` должен вернуть 200. Само сообщение `Started` не подтверждает готовность приложения.

Файл `compose.public.yaml` задаёт `DEBUG=false`, точное имя сервера, доверенные HTTPS origins, защищённые cookies и обычный лимит входа `10/min`. Отдельные тома и имена Docker-образов принадлежат `janamen-public`. Все порты origin привязаны к `127.0.0.1`. Не публикуйте API напрямую в сеть.

Cloudflare [перезаписывает `X-Forwarded-Proto`](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#x-forwarded-proto) протоколом посетителя. Nginx отклоняет посторонние имена, перенаправляет HTTP и передаёт Django собственный заголовок HTTPS. `DJANGO_TRUST_PROXY_SSL_HEADER` включён только в этом профиле. Nginx также задаёт HSTS на один час и заголовки защиты. Для API он убирает повторяющиеся копии трёх заголовков Django.

`manage.py check --deploy` сохраняет предупреждения `security.W004` и `security.W008`. HSTS и перенаправление принадлежат nginx. Проверка фактических ответов и перенаправления обязательна. Эти предупреждения не скрыты.

## Проверить публичный путь

Запускайте только на собственном синтетическом Quick Tunnel. Тест отклоняет другой проект или имя сервера до бизнес-записей.

```bash
env -u DEMO_PASSWORD \
  JANAMEN_ENV_FILE=.artifacts/public-demo/.env \
  JANAMEN_PUBLIC_PROJECT=janamen-public \
  JANAMEN_WEB_URL=https://<PUBLIC_HOST> \
  npx e2e run --config e2e.public.config.ts --trace on \
  --output .artifacts/browser/public-https-<unique-run>
```

Сценарий создаёт настоящий аванс, получает решения руководителя и HR, затем проверяет квитанцию под сотрудником. Он также проверяет cookies, отклонение записи без CSRF и с посторонним Origin, перенаправление HTTP и подменённый заголовок протокола. Не запускайте многократные полные наборы входов на публичном лимите. Полная регрессия использует отдельный закрытый профиль.

## Остановить и сохранить данные

После защиты остановите только процесс туннеля, принадлежащий этому стенду. На текущем компьютере его идентификатор и команда записаны в `.artifacts/public-demo/tunnel-owner.json`. Сначала проверьте соответствие процесса. Не останавливайте процессы по общему имени.

```bash
COMPOSE_PROJECT_NAME=janamen-public COMPOSE_FILE=compose.yaml:compose.public.yaml \
  python3 scripts/dev.py down --env-file .artifacts/public-demo/.env
```

Команда сохраняет тома с заявлениями и историей. Пароли и закрытые отчёты остаются в `.artifacts/`. Это демонстрационный запуск без обязательства постоянной доступности.
