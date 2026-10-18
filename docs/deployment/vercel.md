# Обновить облачный JanaMen

Основной адрес **https://jmhr.vercel.app**. Стенд содержит только вымышленных людей и демонстрационные правила. Вход использует Django sessions. Vercel Authentication отключена только для этого нового публичного проекта.

## Использовать существующие ресурсы

| Ресурс | Значение |
| --- | --- |
| Vercel project | `jmhr` |
| Scope | `yqecea-6175s-projects` |
| Project ID | `prj_fJ5rdrdYRJaIrLnmX8LDC5BhL64y` |
| Team ID | `team_iYFxsGAAURz4gtwV9sWOixCk` |
| Supabase project | `janamen`, `jgsccybmhmhtdkxmjmxg` |
| Регион API, worker и базы | Frankfurt, `fra1` |
| Конфигурация | `vercel.json`, `Dockerfile.worker` |

Frontend собирается через Vite. Django работает как Python service. Постоянный Daemon выполняет существующий `process_outbox --watch --poll-interval 10`. Он получает задания из PostgreSQL. Frontend и API используют один origin. Отдельный домен для API и CORS не нужны.

Supabase предоставляет PostgreSQL, без Supabase Auth. При переносе в пустую отдельную базу восстановлены 58 пользователей, 135 заявлений, 30 курсов, 9 обращений и 32 миграции. Последующие проверки добавляют свои синтетические записи. Это снимок прежнего стенда, а не его постоянно синхронизируемая копия.

Аккаунт Vercel использует Hobby. Новая база создана на Free через существующую Supabase Marketplace integration. Платная подписка и домен не покупались. Services и Daemons находятся в public beta. Бесплатные квоты, ограничения и возможная пауза базы остаются риском доступности. Это не обещание бессрочного SLA.

## Проверить доступ

Нужна авторизация владельца в Vercel. Следующие команды не содержат токенов:

```bash
npx --yes vercel@64.5.0 whoami
npx --yes vercel@64.5.0 link --project jmhr --scope yqecea-6175s-projects --yes
```

После link проверьте ID в локальном `.vercel/project.json` по таблице. Не создавайте новый проект по ошибке. Локальная папка `.vercel` исключена из Git.

Пароли не публикуются в репозитории. Логины `employee.demo`, `manager.demo`, `hr.demo` сохранены. Владелец получил демонстрационный пароль отдельно. `python3 scripts/dev.py credentials` показывает пароль своего локального стенда, который может отличаться от облачного.

## Сохранить настройки сервера

Секреты уже заданы в production environment существующего Vercel project. Не печатайте их в чат или отчёт. Основные имена переменных:

- `DATABASE_URL`, PostgreSQL transaction pool, порт 6543, TLS `sslmode=require`.
- `DJANGO_SECRET_KEY` и `DEMO_PASSWORD`.
- `DJANGO_DB_TRANSACTION_POOL=true`.
- `DJANGO_DEBUG=false` и `DEMO_SEED=false`.
- `DJANGO_ALLOWED_HOSTS=jmhr.vercel.app,jmhr-yqecea-6175s-projects.vercel.app`.
- `CSRF_TRUSTED_ORIGINS=https://jmhr.vercel.app,https://jmhr-yqecea-6175s-projects.vercel.app`.
- `DJANGO_TRUST_PROXY_SSL_HEADER=true`.
- `LOGIN_THROTTLE_RATE=10/min`.
- `INTEGRATIONS_ALLOW_MOCK_FAULTS=false`.
- `KNOWLEDGE_GENERATION_PROVIDER=extractive`.

Production и preview должны использовать разные базы. Не подключайте ветку с seed или тестами к существующей демонстрационной базе. В текущей поставке не настроена безопасная автоматическая миграция базы из каждой сборки. Если меняется схема, отдельно подготовьте и проверьте миграцию и резервную копию. Не запускайте pytest на облачной базе.

## Проверить и развернуть

1. Выполните fetch и сохраните чужие изменения.
2. Выполните команды `.github/workflows/ci.yml` на отдельной синтетической базе.
3. Проверьте затронутый путь через `scripts/verification/README.md`.
4. Сделайте содержательный коммит и push в `Yerlan110110/Jana`.
5. Из корня репозитория разверните существующий проект:

```bash
npx --yes vercel@64.5.0 deploy --prod --yes --scope yqecea-6175s-projects
```

6. Проверьте готовность и страницы без Vercel login:

```bash
curl --fail https://jmhr.vercel.app/api/v1/ready/
curl --fail --head https://jmhr.vercel.app/login
curl --fail --head https://jmhr.vercel.app/defense/JanaMen-defense.pdf
npx --yes vercel@64.5.0 daemons list --scope yqecea-6175s-projects
```

7. Пройдите вход, действие, смену роли и подтверждённый результат в браузере. Ready сам по себе этого не доказывает.

Публичный сценарий `tests/public/demo.e2e.ts` разрешает точный `https://jmhr.vercel.app` при `JANAMEN_PUBLIC_PROJECT=jmhr`, кроме отдельно разрешённого Quick Tunnel. Задайте `PUBLIC_HOST=jmhr.vercel.app`, `JANAMEN_WEB_URL=https://jmhr.vercel.app` и приватный `JANAMEN_ENV_FILE` с демонстрационными доступами. Запустите `npx e2e run --config e2e.public.config.ts --trace on --output .artifacts/browser/vercel-<unique-run>`. Не включайте пароль в команду или Git.

## Использовать материалы

- https://jmhr.vercel.app/defense/index.html
- https://jmhr.vercel.app/defense/team-map.html
- https://jmhr.vercel.app/defense/JanaMen-defense.pdf
- https://jmhr.vercel.app/defense/advance-rehearsal.mp4

Материалы доступны без входа. PDF и видео сохранены с прежним содержимым. Их тайминг ещё требует сокращения под последние три минуты.

## Источники платформы

Возможность запуска проверена на реальном проекте. Текущая конфигурация опирается на [Services](https://vercel.com/docs/services), [конфигурацию Services](https://vercel.com/docs/services/config-reference), [Django](https://vercel.com/docs/frameworks/full-stack/django) и [Daemons](https://vercel.com/docs/daemons). Режим базы следует [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) и [отключению prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL).
