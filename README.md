# JanaMen

Личный кабинет сотрудника для трека **Digital HR** хакатона Jana Post × Terricon Valley.
Сотрудник подаёт заявление, проходит назначенное обучение, получает ответ по доступному регламенту и видит, что именно изменилось в его новой редакции.
Руководитель рассматривает заявки своей команды. HR работает со своим юрлицом, содержимым и вопросами сотрудников.

Репозиторий содержит Django API, React-интерфейс, PostgreSQL, Docker-запуск и синтетические данные. В интерфейсе подключены заявки, Academy, регламенты, обращения к HR и передача документов. Текущие проверки и оставшиеся этапы приёмки указаны в [статусе продолжения](docs/continuation-status.md).

**Открыть продукт: https://jmhr.vercel.app**.

Выбранное продуктовое отличие — полный маршрут обновления правила: HR публикует изменённую редакцию, целевые сотрудники сравнивают «раньше/теперь» и отвечают на практический вопрос, а руководитель видит статус команды. Текущую реализацию и ограничения проверки фиксирует [статус продолжения](docs/continuation-status.md). Команде для защиты откройте [сценарий демо](docs/product/jury-demo-script.md) и [визуальную памятку](docs/defense/team-map.html).

## Проверить решение по ТЗ

| Требование | Реализация | Поведенческая проверка |
| --- | --- | --- |
| Сотрудник видит свой профиль | `backend/apps/identity/`, `frontend/src/app.tsx` | `tests/web/scope.e2e.ts` |
| Заявка проходит между ролями | `backend/apps/hr_requests/` | `tests/web/requests.e2e.ts` |
| Чужие команды недоступны | `backend/apps/identity/selectors.py` | `tests/web/scope.e2e.ts` |
| Курс сохраняет прогресс | `backend/apps/academy/` | `tests/web/academy.e2e.ts` |
| Ответ содержит доступный источник | `backend/apps/knowledge/` | `tests/web/knowledge.e2e.ts` |
| Неизвестный вопрос доходит до HR | `backend/apps/knowledge/services.py` | `tests/web/knowledge-loop.e2e.ts` |
| Изменённое правило доходит до целевых сотрудников и статуса руководителя | `backend/apps/knowledge/`, `frontend/src/features/knowledge/updates.tsx` | Сценарий и границы проверки: [статус продолжения](docs/continuation-status.md) |

Тесты описывают воспроизводимые проверки. Их наличие не заменяет результат запуска. Актуальные результаты и открытые ограничения находятся в [статусе](docs/continuation-status.md). [Комплект сдачи](docs/product/submission-checklist.md) связывает требования организаторов с материалами команды.

## С чего начать

| Нужно | Открыть |
| --- | --- |
| Открыть публичный HTTPS-стенд | [Vercel, база и обновление](docs/deployment/vercel.md) |
| Открыть материалы защиты | [Офлайн PDF и исходники](docs/defense/README.md) |
| Понять ТЗ простыми словами | [Краткое объяснение](docs/product/brief-in-russian.md) |
| Продолжить работу | [Handoff следующему агенту](HANDOFF.md), [готовый промпт Codex](CODEX_START.md) |
| Узнать требования | [Спецификация](docs/product/specification.md), [решения владельца](docs/product/project-rules.md) |
| Разобраться в backend | [Архитектура](docs/architecture/system.md), [контракт модулей](docs/architecture/backend-contract.md) |
| Выбрать готовые компоненты | [Сравнение архитектур](docs/architecture/reuse-decision.md), [frontend architecture](docs/architecture/frontend.md) |
| Спроектировать интерфейс | [Дизайн-brief](docs/design/README.md), [31 представление](docs/design/screen-inventory.md), [состояния](docs/design/state-and-data-contracts.md) |
| Изучить аналоги и компанию | [Продуктовое исследование](docs/research/product-rea.md), [backend research](docs/research/backend-rea.md), [Jana Post](docs/research/janapost-context.md) |
| Подготовить сильное отличие | [Стратегия](docs/product/differentiation-strategy.md), [3:00 демо](docs/product/jury-demo-script.md), [карта API gaps](docs/architecture/differentiation-gap-map.md) |
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

## Что реализовано полностью, что смоделировано, что дальше

| Статус | Что входит |
| --- | --- |
| **Реализовано полностью** | Вход и три роли: сотрудник, руководитель, HR. Права проверяются на сервере для списков, карточек, команд и поиска по знаниям |
| | Профиль: Ф.И.О., юрлицо, должность, подразделение, руководитель, дата приёма, остаток отпуска, обучение и уведомления |
| | Заявки на отпуск и аванс: подача, руководитель, HR, решение, возврат на исправление, история, неизменяемые версии, защита от повторной отправки |
| | «Мои заявки» с типом, датой, статусом и карточкой |
| | Jana Academy: 30 курсов, назначения, материал, тест с проверкой на сервере, прогресс, результат и история |
| | AI Jana: ответ только из опубликованных разрешённых документов, источник и редакция, честный отказ, обращение в HR, публикация нового правила HR |
| **Добавлено в код, поведенческая приёмка не подтверждена** | Обновление правила: сравнение редакций, назначение по аудитории, практический вопрос, прогресс сотрудника и команды, уведомления |
| | Центр уведомлений о статусе заявки и об обучении |
| **Смоделировано** | 1С:ЗУП — mock-источник кадровых фактов, данные только для чтения |
| | Documentolog — mock-адаптер передачи документа с квитанцией доставки. Квитанция не означает выплату или подпись |
| | AI Jana отвечает выдержками из документов без генерации текста моделью. Провайдер задаётся `KNOWLEDGE_GENERATION_PROVIDER` |
| | Люди, юрлица, правила компании и курсы вымышлены |
| **Дальнейшее развитие** | Реальные коннекторы 1С:ЗУП, Documentolog API с ЭЦП и eGov QR, регистрация договоров в ЕСУТД (enbek.kz) |
| | Переключатель интерфейса RU/KZ. База знаний уже хранит документы на русском и казахском |
| | Генерация ответа моделью поверх найденных цитат, мобильное приложение |

Схема архитектуры и места подключения 1С:ЗУП и Documentolog: [docs/architecture/system.md](docs/architecture/system.md).

Текущие результаты PostgreSQL, Docker и браузерных проверок, независимое ревью и незакрытая приёмка находятся в [статусе продолжения](docs/continuation-status.md). Датированные проверки сохраняются в [отчётах](docs/verification/).

Предусмотрены **116 сотрудников, четыре юрлица в Казахстане, Кыргызстане и Узбекистане, двенадцать отделов, 242 заявления и 30 содержательных курсов**. Основной сотрудник имеет разнообразные состояния заявок и обучения. Люди, юридические лица, правила и учебные кейсы вымышлены. Учебный материал не является официальным регламентом Jana Post.

## Запуск через Docker Compose

Нужны Git, Python 3 для подготовки и работающий Docker с Compose.

```bash
git clone https://github.com/Yerlan110110/Jana.git
cd Jana
python3 scripts/dev.py up
```

Команда создаёт локальный `.env` с отдельными случайными секретами, если его ещё нет, затем собирает и запускает сервисы. `release` применяет миграции, собирает статику админки и наполняет данные. API и worker запускаются после успешного `release`. Сервис `frontend` собирает Vite-приложение и запускает nginx после готовности API.

Эквивалентный явный запуск:

```bash
python3 scripts/dev.py prepare
docker compose up --build -d
```

| Адрес | Назначение |
| --- | --- |
| `http://127.0.0.1:8080/` | Frontend и `/api/` через один origin. Порт задаёт `FRONTEND_PORT` |
| `http://127.0.0.1:8000/api/v1/ready/` | Готовность API и соединения с БД |
| `http://127.0.0.1:8000/api/v1/docs/` | Интерактивная документация OpenAPI |
| `http://127.0.0.1:8000/api/v1/schema/` | Схема API |
| `http://127.0.0.1:8000/admin/` | Django admin для отдельно созданного технического администратора |

Порт 8000 остаётся прямым адресом API. Открывайте продукт на порту 8080: nginx отдаёт `frontend/dist` и передаёт `/api` в Django. Прямые ссылки frontend открывают тот же `index.html`. Неизвестный API-путь и отсутствующий файл в `/assets/` возвращают 404. Успешный `/ready/` не доказывает работу пользовательских сценариев. Swagger UI загружает публичные браузерные assets; JSON API и сохранённая схема от этого не зависят.

```bash
docker compose ps -a
docker compose logs --tail=100 frontend api worker release
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
| `employee.kg.demo` | Айбек Осмонов: сотрудник синтетического юрлица в Бишкеке (Кыргызстан) |
| `employee.uz.demo` | Дилноза Каримова: сотрудник синтетического юрлица в Ташкенте (Узбекистан) |
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


Контейнерный baseline и границы доказательств: [backend baseline](docs/verification/runtime-baseline.md), [same-origin serving](docs/verification/runtime-serving.md).
