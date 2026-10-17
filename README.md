# JanaMen

Личный кабинет сотрудника для трека **Digital HR** хакатона Jana Post × Terricon Valley.
Сотрудник подаёт заявление, проходит назначенное обучение и получает ответ по доступному регламенту.
Руководитель рассматривает заявки своей команды. HR работает со своим юрлицом, содержимым и вопросами сотрудников.

Репозиторий содержит backend, исследование профессиональных HR/LMS, архитектуру, продуктовые спецификации, синтетические данные и контракт для отдельного frontend. Визуальный интерфейс делает следующий агент по [HANDOFF.md](HANDOFF.md).

## С чего начать

| Нужно | Открыть |
| --- | --- |
| Понять ТЗ простыми словами | [Краткое объяснение](docs/product/brief-in-russian.md) |
| Продолжить работу | [Handoff следующему агенту](HANDOFF.md), [готовый промпт Codex](CODEX_START.md) |
| Узнать требования | [Спецификация](docs/product/specification.md), [решения владельца](docs/product/project-rules.md) |
| Разобраться в backend | [Архитектура](docs/architecture/system.md), [контракт модулей](docs/architecture/backend-contract.md) |
| Выбрать готовые компоненты | [Сравнение архитектур](docs/architecture/reuse-decision.md), [frontend architecture](docs/architecture/frontend.md) |
| Спроектировать интерфейс | [Дизайн-brief](docs/design/README.md), [31 представление](docs/design/screen-inventory.md), [состояния](docs/design/state-and-data-contracts.md) |
| Изучить аналоги и компанию | [Продуктовое исследование](docs/research/product-rea.md), [backend research](docs/research/backend-rea.md), [Jana Post](docs/research/janapost-context.md) |
| Подготовить сильное отличие | [Стратегия](docs/product/differentiation-strategy.md), [7:30 демо](docs/product/jury-demo-script.md), [карта API gaps](docs/architecture/differentiation-gap-map.md) |
| Выбрать дизайн-систему | [REA Pace/Jana, версии, tokens и reuse](docs/research/pace-jana-design-system.md) |
| Проверить готовность | [Фактические результаты](docs/verification/final.md), [матрица проверок](docs/verification/acceptance-plan.md) |
| Подключить Codex skills | [Codex setup](docs/tooling/codex-setup.md), [инвентарь](docs/tooling/skill-inventory.md) |

## Backend и данные

| Контур | Поведение |
| --- | --- |
| Identity | Django sessions, CSRF, сотрудник/руководитель/HR, серверная область доступа |
| Профиль | Импортированные кадровые факты и официальный остаток доступны для чтения |
| Заявки | Отпуск и зарплатный аванс: черновик, отправка, согласование, возврат, отказ, отмена |
| История | Неизменяемая отправленная версия, история решений, optimistic version и идемпотентность |
| Academy | Каталог, опубликованные версии, назначения, уроки, серверная проверка теста |
| AI Jana | Разрешённые документы, поиск фрагментов, проверяемые цитаты, разные режимы ответа и обращение к HR |
| Уведомления | Персональные сообщения о событиях; прочтение не меняет заявку или курс |
| Интеграции | Нормализованный mock 1С, отдельный экспорт в mock Documentolog и повторяемая доставка через outbox |
| Рабочая очередь | `/workbench/` собирает разрешённые следующие действия, персональные сводки и ограниченные previews |

Объединённый backend прошёл **191 тест на PostgreSQL 16.15**. Два сквозных HTTP-прогона прошли по 807 проверок, включая реальные cookie/CSRF и получение mock-квитанций worker. Это проверки API; визуальный интерфейс и живой AI-провайдер требуют следующего этапа. Подробности и статус контейнеров: [отчёт](docs/verification/final.md).

Предусмотрены **58 сотрудников, два юрлица, шесть отделов, 126 заявлений и 30 содержательных курсов**. Основной сотрудник имеет разнообразные состояния заявок и обучения. Люди, юридические лица, правила и учебные кейсы вымышлены. Учебный материал не является официальным регламентом Jana Post.

## Запуск через Docker Compose

Нужны Git, Python 3 для подготовки и работающий Docker с Compose.

```bash
git clone https://github.com/Yerlan110110/Jana.git
cd Jana
python3 scripts/dev.py up
```

Команда создаёт локальный `.env` с отдельными случайными секретами, если его ещё нет, затем собирает и запускает сервисы. `release` применяет миграции, собирает статику админки и наполняет данные. API и worker запускаются после успешного `release`.

Эквивалентный явный запуск:

```bash
python3 scripts/dev.py prepare
docker compose up --build -d
```

| Адрес | Назначение |
| --- | --- |
| `http://127.0.0.1:8000/api/v1/ready/` | Готовность API и соединения с БД |
| `http://127.0.0.1:8000/api/v1/docs/` | Интерактивная документация OpenAPI |
| `http://127.0.0.1:8000/api/v1/schema/` | Схема API |
| `http://127.0.0.1:8000/admin/` | Django admin для отдельно созданного технического администратора |

Корневой путь `/` пока не содержит frontend. Успешный `/ready/` не означает, что интерфейс создан. Swagger UI загружает публичные браузерные assets; JSON API и сохранённая схема от этого не зависят.

```bash
docker compose ps -a
docker compose logs --tail=100 api worker release
python3 scripts/dev.py down
```

`down` сохраняет тома с данными. Не удаляйте тома ради обычного перезапуска. Повторный seed сохраняет пароли и внесённые изменения.

## Демонстрационные аккаунты

Новые синтетические аккаунты получают пароль из локального `DEMO_PASSWORD`. Посмотреть его на своей машине:

```bash
python3 scripts/dev.py credentials
```

| Логин | Роль и сценарий |
| --- | --- |
| `employee.demo` | Дана Нұрланқызы Әбдірахманова: основной сотрудник |
| `manager.demo` | Аян Бекенов: прямой руководитель Даны |
| `hr.demo` | Алия Серікқызы: HR первого юрлица |
| `hr.alt.demo` | Второй HR для рассмотрения собственной заявки первого HR |
| `otherteam.demo` | Сотрудник другой команды |
| `foreign.demo` | Сотрудник второго юрлица |
| `new.demo` | Новичок без истории заявок и назначенного руководителя |

Seed создаёт файл credentials с правами `0600`, исключённый из Git. В контейнере это `/app/runtime/demo-credentials.json`; нативно — `runtime/demo-credentials.json` в корне репозитория.
Изменение `.env` не сбрасывает пароль существующего аккаунта. При сохранённом томе используется прежний пароль; сброс — явная административная операция.

HR-аккаунты не являются Django superuser. При необходимости создайте отдельного технического администратора:

```bash
docker compose exec api python manage.py createsuperuser
```

## Нативный запуск без Docker

Нужны Python 3.12, `uv` и PostgreSQL. Создайте отдельную БД JanaMen.

```bash
python3 scripts/dev.py prepare
cd backend
uv sync --frozen --group dev
```

Добавьте в корневой `.env` строку `DATABASE_URL` с адресом своей PostgreSQL. Формат: `postgresql://USER:PASSWORD@127.0.0.1:5432/janamen`; замените параметры фактическими значениями. Файл не добавляется в Git.

```bash
uv run --env-file ../.env --frozen python manage.py migrate
uv run --env-file ../.env --frozen python manage.py collectstatic --noinput
uv run --env-file ../.env --frozen python manage.py seed_demo
uv run --env-file ../.env --frozen python manage.py runserver 127.0.0.1:8000
```

Во втором терминале из `backend`:

```bash
uv run --env-file ../.env --frozen python manage.py process_outbox --watch
```

Без `DATABASE_URL` debug-конфигурация использует SQLite. Это позволяет быстрый запуск, но не доказывает корректность блокировок PostgreSQL. Для полноценной проверки параллельных действий используйте PostgreSQL.

## Подключение frontend

Создан `@janamen/api-client` на основе `openapi-fetch` и сгенерированные типы.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run contracts:generate
npm run contracts:check
```

Генератор проверяет Django OpenAPI без предупреждений, строит TypeScript и проверяет типы. `contracts:check` сравнивает результат с сохранёнными файлами. Меняйте сериализаторы и команды, затем запускайте генератор. `schema.d.ts` вручную не редактируется.

Используйте один браузерный origin для frontend и `/api/`: proxy в dev-сервере и reverse proxy при размещении. Перед login получите CSRF, отправьте `X-CSRFToken`, затем сохраните новый токен из ответа login. Предметные команды используют `Idempotency-Key`, а изменения версионированных записей — `expected_version`.

Подробности: [API-клиент](packages/api-client/README.md), [интеграционный guide](docs/architecture/api-contract-guide.md), [frontend architecture](docs/architecture/frontend.md).

## AI Jana

По умолчанию работает поиск и извлечение разрешённых фрагментов; режим обозначается `extractive`. Для генерации задайте `KNOWLEDGE_GENERATION_PROVIDER=openai`, `OPENAI_API_KEY` и явный `OPENAI_MODEL` в окружении backend или в корневом `.env` для Compose. После изменения перезапустите API. Ключ не передаётся браузеру.

Принята стратегия выбора моделью полных предложений источника с серверной проверкой соответствия. Она сохраняет числа и отрицания. Свободный пересказ требует отдельной проверки обоснованности. Наличие правильной ссылки само по себе не доказывает произвольное утверждение.

Отсутствие доказательств, недоступность провайдера и успешный ответ — разные результаты. Сотрудник сам создаёт обращение в HR; помощник не принимает кадровых решений. Проверки с имитацией транспорта не заменяют прогон с настоящей моделью: его статус указан в handoff.

## Проверка backend

Контейнерный прогон с PostgreSQL:

```bash
python3 scripts/dev.py test-postgres
```

Нативно из `backend` с PostgreSQL в `.env`:

```bash
uv run --env-file ../.env --frozen ruff check .
uv run --env-file ../.env --frozen python manage.py makemigrations --check --dry-run
uv run --env-file ../.env --frozen pytest -q
```

Тестовой роли PostgreSQL нужно право создавать тестовую БД. Используйте отдельное окружение с синтетическими данными. CI также проверяет skills, контракт и контейнеры. Файл workflow сам по себе не доказывает успешный CI.

Сквозная проверка запущенного API и worker:

```bash
python3 scripts/verification/smoke_workflows.py \
  --base-url http://127.0.0.1:8000 \
  --credentials-file runtime/demo-credentials.json \
  --output runtime/workflow-smoke.json \
  --wait-for-exports 60
```

Runner создаёт отдельные синтетические записи и сохраняет их как доказательства. Повторный запуск использует новые идентификаторы. [Покрытые сценарии и ограничения](scripts/verification/README.md).

## Pstack, Fstack и REA для Codex

Закреплены 94 skills: Pstack Codex port, оригинальные наборы Emil Kowalski и Jakub Krehel, REA и проектный Fstack router. Pstack port — community-адаптация. Fstack здесь — имя проектного маршрутизатора, не отдельный официальный пакет этих авторов.

```bash
node scripts/tooling/verify-skills.mjs
npm ci --prefix scripts/tooling/rea-runtime --ignore-scripts --no-audit --no-fund
node scripts/tooling/rea.mjs --version
```

Откройте Codex из корня доверенного проекта и выполните discovery из [codex-setup.md](docs/tooling/codex-setup.md). CLI и standalone MCP проверялись отдельно; их успех не означает подключение к уже открытой сессии другого клиента.
Правила обязательны в [AGENTS.md](AGENTS.md). Применения отражены в [skill-use.md](docs/tooling/skill-use.md) и дизайн-спецификации.

## Исследование и источники

Продуктовые решения опираются на официальные материалы Personio, LearnUpon, TalentLMS, 360Learning, HiBob и исходники доступных альтернатив. [Реестр REA](docs/design/evidence/README.md) различает ограниченный capture статьи и исследование авторизованной LMS.
Частный код MIS Pro не переносился. Сходство разобрано на уровне ролей, процесса, неизменяемых версий и истории.

Лицензии сторонних skills сохранены в [tooling/licenses](docs/tooling/licenses/). Платные материалы, полные статьи, чужие курсы и закрытые assets в продукт не скопированы.

