# Архитектура независимого frontend

Статус: выбранная основа для следующего агента. Компоненты и визуальная система ещё не реализованы. Рабочий frontend-пакет сейчас содержит типизированный API-клиент.

Дополнение по последнему решению владельца: исследован [Pace с адаптацией под Jana](../research/pace-jana-design-system.md). Это предпочтительный кандидат на повторное использование компонента и его правил после проверки конкретной версии, экспортируемого набора и лицензий. Обнаружено расхождение public deployment и доступного `main`. Первоначальное предложение Base UI ниже остаётся обоснованным резервным вариантом. Codex вправе пересмотреть библиотеку primitives после этой проверки; нельзя устанавливать две реализации одной роли или повторно создавать готовые компоненты ради прежнего текста спецификации.

## Основа приложения и исходный выбор primitives

Основа приложения — **React + TypeScript, React Router Framework Mode с SPA rendering и TanStack Query**. Исходный выбор primitives — Base UI; окончательный набор компонентов определяется проверкой Pace выше. Сервером предметных правил остаётся Django. UI связывает действия человека с существующими командами API.

Это сокращает собственный инфраструктурный код: готовые маршруты, загрузка по маршруту, обработка ошибок, кеш серверных данных, доступные primitives и генерируемый транспорт. Решение можно пересмотреть при конкретном преимуществе альтернативы для наших сценариев с сохранением одного источника правды.

Framework Mode предоставляет типизированные route modules, разделение кода и стратегии SPA/SSR. SPA mode генерирует корневой HTML при сборке, хотя runtime SSR выключен. Корневой render должен работать без `window`, а кадровые данные не должны попадать в build-time loader. Источники: [режимы React Router](https://reactrouter.com/start/modes), [SPA mode](https://reactrouter.com/how-to/spa).

## Владельцы состояния

| Область | Выбранный владелец | Что не нужно повторять |
| --- | --- | --- |
| URL, route params, layout nesting, ошибки маршрута | React Router | Собственный router и ручной глобальный switch страниц |
| Серверные данные, инвалидирование, загрузка | TanStack Query | Копии заявок и результатов в глобальном store |
| HTTP и response types | `@janamen/api-client` | Рукописные DTO по памяти или снимкам |
| Session identity и права | Django API | Свою JWT-систему и выдачу прав по localStorage |
| Dirty form, поля, подсказки | React Hook Form; Zod для локальной формы | Серверный расчёт дней, баланса, оценок и согласования |
| Dialog, popover, select, focus/dismissal | Base UI | Механику доступности из div и document listeners |
| Короткое сообщение о результате | Sonner | Самодельный toast manager |
| Язык и format resources | react-i18next/i18next и `Intl` | Изменение API enums и ручное склонение в каждом компоненте |
| Визуальные tokens и composition | Следующий design agent | Копирование чужого HR-dashboard |

React Hook Form, Zod и выбор router/query находятся вне тематического списка `pick-ui-library`: они выбраны по задаче и официальным источникам. Base UI, Sonner, Motion, clsx/cva и условный Virtuoso соответствуют прочитанному оригинальному списку Emil. [Base UI](https://base-ui.com/react/overview/quick-start), [React Hook Form source](https://github.com/react-hook-form/react-hook-form), [Zod](https://zod.dev/), [react-i18next](https://react.i18next.com/).

CSS tokens и слои компонентов фиксируются централизованно. Допустим Tailwind через официальный Vite plugin, если design agent выбирает его как единый способ styling. Base UI не диктует внешний вид. Для реальных вариантов использовать типизированные props и clsx/cva по необходимости. Библиотеки из skills устанавливаются при наличии соответствующего компонента. [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).

## Почему отдельный сервер frontend пока не нужен

У портала уже есть контрактная серверная граница. Next.js или server-rendered React Router могут быть хорошим выбором при доказанной потребности в серверной композиции, но добавляют второй request lifecycle, передачу cookie и риск общего кеша между пользователями. Сейчас такой слой не нужен для индексации частных страниц.

Framework Mode сохраняет готовые route conventions и возможность сменить rendering strategy. React отдельно объясняет стоимость самостоятельного соединения bundler, routing и data fetching: [React app architecture](https://react.dev/learn/build-a-react-app-from-scratch). Мы выбираем готовые части по их ответственности; причиной выбора не является предполагаемая нехватка времени.

## Предлагаемая структура

| Путь | Содержание |
| --- | --- |
| `frontend/app/root.tsx` | Публичная оболочка, providers и общий error boundary |
| `frontend/app/routes.ts` | Явная карта URL |
| `frontend/app/routes/` | Небольшие route modules, соединяющие feature views |
| `frontend/app/features/requests/` | Реестр, форма, detail, history, команды и query keys |
| `frontend/app/features/academy/` | Каталог, назначения, player, попытка, результат, HR authoring |
| `frontend/app/features/knowledge/` | Вопрос, ответ, источники, история и HR gap queue |
| `frontend/app/features/people/` | Read-only профиль и разрешённая команда |
| `frontend/app/features/workbench/` | Домашние задачи и объяснимые следующие действия |
| `frontend/app/components/ui/` | Тонкие compositions поверх Base UI |
| `frontend/app/lib/` | API, session boundary, query client, formatting |
| `frontend/app/locales/ru/`, `frontend/app/locales/kk/` | Навигация, сообщения, названия стабильных кодов |
| `frontend/tests/` | Проверки конкретных пользовательских сценариев и состояний |
| `packages/api-client/` | Созданный общий клиент и генерируемая схема |

Это карта ответственности, не требование заранее создавать пустые файлы. Один feature хранит связанные views, формы, queries и команды рядом. Общими становятся компоненты с общей семантикой.

## Один кеш серверных данных

QueryClient владеет серверным кешем. `clientLoader` вызывает `ensureQueryData` или prefetch для тех же query options, которые использует view. Он не создаёт независимую копию ресурса.

Ключ содержит пользователя, resource, фильтры и страницу. Документы знаний и кадровые сведения не сохраняются в постоянном browser storage. После выхода кеш очищается до входа другой персоны. Прерванные запросы старой сессии не должны заполнять новый кеш.

После согласования обновляются detail, реестр, notifications и домашние задачи. После урока — enrollment, summary и профиль обучения. После публикации политики обновляются документы; старый AI-ответ проверяет доступ по серверному контракту.

Mutation retry по умолчанию не автоматический. При неизвестном результате из-за обрыва связи повторяется тот же intent с тем же Idempotency-Key и payload. Новое действие получает новый ключ. Stale version требует текущую запись и нового осознанного действия. [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview).

## Session и deployment

Браузер обращается к `/api/v1/...` на своём origin. Dev proxy пересылает `/api` на Django; production reverse proxy разделяет frontend и API. `/api/` обрабатывается раньше SPA fallback: отсутствующий API не должен возвращать `index.html` со статусом 200.

Не смешивать `localhost` и `127.0.0.1` как два browser origin. Использовать относительный API URL и proxy. После login сохраняется свежий CSRF из ответа; unsafe commands передают его в заголовке. Session cookie остаётся `HttpOnly` и не копируется в JS-store.

При размещении включить HTTPS, `DJANGO_DEBUG=false`, явные allowed hosts и trusted origins. Публичная статика кешируется по content hash. Кадровые ответы не допускаются в общем CDN-кеше. Proxy и cookie проверяются реальным browser journey.

## Предметная state machine формы

Форма различает editing, submitting, accepted, conflict, validation error и unknown network result. Названия в коде могут отличаться; переходы остаются явными. Сохранение выбора в незавершённом тесте не равно записи серверной попытки.

Frontend не создаёт скрытую бизнес-логику для отсутствующих серверных полей. Сейчас draft заявки требует корректных обязательных полей типа. Частичный ввод хранится как несданная форма и не выдаётся за серверный draft.

## Масштаб и доступность

Каталог проектируется на 30 курсов, реестр — на несколько страниц. Поиск, категории, обязательность, due state и пагинация имеют самостоятельный смысл. Virtuoso добавляется при измеренном длинном списке; 30 карточек не требуют виртуализации автоматически. Keyboard navigation и контекст чтения сохраняются.

Base UI уменьшает собственную механику, но не гарантирует доступность итоговой композиции. Обязательны [quality gates](../design/quality-gates.md): клавиатура, focus return, ошибки, 200% zoom, narrow viewport, контраст, reduced motion и несколько языков. Motion используется для объяснения перехода; простой hover/fade выполняется CSS.

## Версии и приёмка

17 октября 2026 года официальная документация показывает React 19.3, React Router 8.4.0 и Base UI 1.9.0. Это наблюдение документации, не совместимый lock уже установленного frontend. Следующий агент проверяет peer dependencies и фиксирует стабильный совместимый набор. TypeScript и generated client уже имеют проверенный контракт в текущем репозитории.

Порядок интеграции: cookie login → профиль → существующая заявка → решение другой ролью → история, затем Academy, AI с источником и HR gap. Это порядок проверки, не сокращение объёма. Все 31 представление и их существенные состояния остаются в [screen inventory](../design/screen-inventory.md).


## Принятое продолжение, 17 октября 2026

Фактический frontend использует standalone Vite, React Router в declarative mode и TanStack Query. Это уточняет раннее предложение Framework Mode. У закрытого same-origin приложения нет server loaders или второго серверного request lifecycle. `frontend/src/app.tsx` владеет маршрутизацией, feature modules содержат предметные views. QueryClient остаётся единственным кешем данных сервера. Доступ и решения принадлежат Django.

Установлены React 19.3.1, React Router 8.4.0, TanStack Query 5.104.3, Tailwind 4.3.3 и Base UI 1.8.0. Lockfile фиксирует зависимости. Native forms и типизированные локальные черновики сохраняют version и значения команды вместе. Рукописных копий DTO нет. `ActionLink` сохраняет семантику ссылки и использует MIT `buttonVariants`. `ActionButton` исполняет команды через настоящий button.

Pace установлен только в проверенном составе. Источники, лицензии и отклонённые зависимости описаны в [решении о повторном использовании](../research/continuation-reuse.md). Consumer theme компилируется из `frontend/jana.json`; upstream-файлы не правятся. Публичный исходник frontend и тексты лицензий доступны из footer. Текущий интерфейс светлый. Полный казахский перевод и dark mode не заявлены. Язык материала регламента и казахские символы сохраняются отдельно от языка интерфейса.

Браузерная приёмка следует [.agents/skills/verify-janamen](../../.agents/skills/verify-janamen/SKILL.md). Текущий объём и незакрытые проверки находятся в [C2](../continuation-status.md). Сборка не означает прохождения всех 31 представления.

## Feature source boundaries

The connected features retain their named route exports through small entry modules. Request lists, forms, commands and detail live in separate files. Academy separates enrollment lists, catalogue, learning, assessment, author fields and assignment. Knowledge separates answers, reading, cases and publication. No new state owner or framework is added.

The coordinator compared keeping large multi-page files with a mechanical split along existing component dependencies. The split keeps the current route and API contracts while reducing the largest resulting feature file to 572 lines. A generic form engine and a router rewrite were rejected because neither is needed to separate these existing responsibilities. The dependency tool rejected cycles and TypeScript removed unused imports. Build and five real-browser tests pass on the rebuilt Docker image. Raw evidence is `.artifacts/build-split-feature-modules.log` and `.artifacts/browser/split-modules-20261018-1/`. This is owner verification, not independent review.
