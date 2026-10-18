# Текущий статус JanaMen

18 октября 2026, 18:00 Алматы. Этот файл заменяет прошлые промежуточные статусы. История сохранена в docs/archive/checkpoint-history-2026-10-18-1650.md.

## V3, проверенный релиз

V3 опубликован из коммита `1a183b7`. Production deployment `dpl_9gFTUemfRVZhamQijsjuhZCwo3uZ` имеет READY и назначен на https://jmhr.vercel.app. Новые композиции применены к заявлениям, назначениям обучения, каталогу курсов, AI Jana и библиотеке регламентов. Мятно-персиковый внешний фон появляется плавно в течение пяти секунд; reduced motion отключает движение. Длинная повторяющаяся подпись о демоданных удалена. Общая отметка в футере и короткая метка учебного регламента сохранены.

Локальный браузер проверил пять страниц на ширине 320px без горизонтального переполнения и их вид на 1440px. Переход к заявлению на аванс открывает нужную форму. Проверки типов, API-контракта и сборки прошли. Повторный PostgreSQL-прогон дал 255 passed. Браузерный прогон дал 22 passed и одну устаревшую проверку удалённой подписи; обновлённая проверка отдельно прошла. Независимый рецензент codex/gpt-6.1-sol не нашёл блокеров в коде и на пяти страницах шириной 375px. Клавиатурный прогон дал 10 passed. Замена API без перезапуска nginx прошла. Семь тестов безопасности отчёта, ruff и проверка миграций прошли. Журналы находятся в `.artifacts/verification/interior-preview/`.

После деплоя пять обновлённых разделов открыты на публичном сайте при ширине 375px. Во всех ширина документа равна 375px, аварийного экрана и длинной подписи нет. Это проверка отображения с существующей сессией, не повтор всех публичных команд.

Страницы деталей и HR-редакторы сохраняют прежнюю композицию. V3 не означает новый backend. Случайная ошибка пользователя не воспроизведена, её исправление не заявляется.

## Опубликовано и проверено

Сайт https://jmhr.vercel.app. Вход HR в один клик, помощник и репетиция проверены на публичной версии. Зелёный интерфейс Crextio и 10-секундное видео подключены. Видео играет без звука, пропускается и не повторяется в той же сессии.

На локальном стенде: 255 тестов PostgreSQL, 22 сценария ролей, 10 клавиатурных проверок. Типы, сборка, контракт, миграции и nginx replacement прошли. История редакций регламента проверена в Docker и получила независимое ревью. Облачная миграция 0004 применена после резервной копии.

Подготовленный синтетический пример /hr/policies/5adf82de-9cbc-4c2d-9fd8-90de77117814: нажать «Сравнить ответы» с пустым полем. Проверено в публичном браузере: аудитория 29 → 3, 26 изменений доступа, три вопроса потеряют источник. Черновик не опубликован.

## Последняя проверка

Полный процесс обновления правила прошёл девять браузерных проверок локально и на https://jmhr.vercel.app. HR опубликовал две редакции, сотрудник увидел сравнение, неверный ответ сохранил открытое задание, верный завершил его. После перезагрузки сотрудник и руководитель видят один сохранённый результат. Публичный документ: 4b80173d-cf90-4ac7-81c4-96b8c48e2c2b. Отчёт: `.artifacts/verification/c2-public/policy-flow-report.json`.

Мобильная оболочка исправлена на полную ширину. Тест до изменения падал на отступе 12px. После исправления проходит на 320, 390 и 768px для списка и создания заявления на Docker-стенде 8098. Независимое ревью исходников без замечаний. Исправление опубликовано: deployment dpl_C8a8nzkGyRpnxXVdi7csUp6uDfZv имеет READY. На публичной странице заявлений при viewport 320px ширина оболочки и документа равна 320px, левый отступ равен 0. Физический телефон не проверен.

[Памятка команде](defense/team-brief.md) объясняет основной акцент, дополнительные функции и ограничения. Презентацию готовит другой участник.

Повторный PostgreSQL-прогон: 255 passed in 228.52s. Общий браузерный прогон выявил конфликт старой проверки отсутствия правила с новым синтетическим документом и ожидание формы до завершения заставки. Первый прогон дал 20 успешных и три неуспешных проверки. Все три исправленные проверки прошли повторно. Клавиатурная проверка: 10 из 10 прошли. Дополнительное меню скрывает на широком экране ссылки, уже доступные в верхней панели. На телефоне все ссылки остаются. Проверено на 1440 и 320px, включая Escape, локально и на публичном сайте. Последняя публикация меню dpl_46XEswm2qDVAKwWPwhMrTozZD5Uu имеет READY. Код отправлен в GitHub коммитом 1c3bcbb.

## Комплект сдачи

Репозиторий, README, архитектурная схема будущих 1С и Documentolog, трёхстраничный PDF и сценарий 60+120 секунд присутствуют. Независимая проверка обоих PDF задания не нашла отсутствующих обязательных артефактов. Новая презентация и исправление ширины кнопки меню опубликованы из 8dc703d. Deployment dpl_8D4aJ8coAT4v9bhaPkFkj24KwHC8 имеет READY. Публичный PDF совпал с исходником (SHA256 6c301cdf0207a4e4e69d0910f786af616c38c677d2ae2eebca48e8df47bfe79b). Публичный HR-вход и меню 320px проверены. Все десять финальных рецензентов завершили работу на opencode/space-bunny-free. Часть проверок использовала устаревший порт 8080 и не считается приёмкой новой версии. Координатор отдельно проверил отсутствие горизонтального переполнения на шести маршрутах текущего стенда 8098.

## Ограничения

Настоящие 1С, Documentolog, ЭЦП и выплаты не подключены. Импорт кадровых фактов доступен через операторский API, без формы импорта. Календарь и некоторые списки используют элементы браузера. Полный пиксельный паритет, идеальная плавность и превосходство над другими командами не доказаны. Время речи не измерено.

План развития: docs/product/expansion-roadmap.md. Все будущие возможности обозначены как план. После отправки владельцем любые изменения кода, сайта и материалов запрещены.

## Local HR Academy and RAG extension, 18 October

Not pushed or deployed publicly. The pitch script is unchanged. Local preview is http://127.0.0.1:8098/hr/courses and /hr/policies, using the existing synthetic janamen-checkpoint stack.

Academy now uses the existing scoped enrollment summary for completion, overdue assignments, failed attempts and not-started assignments. Cards open the corresponding team filters. Counts include all accessible assignments, not only the current page. Failed attempts may belong to completed courses.

The publication rehearsal accepts up to ten newline-separated questions and exposes changed/lost-source filtering with an explicit verdict. Editing questions clears prior results. Existing source retrieval, role checks and publication semantics are unchanged; this is not a new semantic retrieval engine or legal correctness check.

Verified locally: frontend typecheck and build, git diff --check, HR summary with 196 assignments, failed-attempt drilldown with 52 assignments, two-question rehearsal against the synthetic advance policy, empty risk filter, short-question validation and result invalidation. RAG and Academy layouts had no horizontal overflow at 375px. Independent source/contract review by codex/gpt-6.1-sol passed. The full role regression suite was not repeated for this local extension.

The built assets were copied into the existing local frontend container for same-origin browser acceptance. Rebuilding that container replaces this temporary preview. Public V3 remains unchanged. The Vite port 5173 still has a pre-existing sign-in origin failure; use local 8098 for this preview.

The local extension also includes six Academy category summaries with category-plus-problem drilldowns. RAG now shows a question-by-question before/after evidence matrix and a filter for questions with no source after the change, including unchanged gaps. Restricted excerpts count as available evidence without exposing their content. Browser checks confirmed a two-question run with one uncovered question, missing-source filtering, and matrix navigation revealing a previously hidden result. Both extended screens fit a 375px viewport without horizontal overflow. These additions remain local and do not change the pitch script.

## HR extension release preparation

Owner authorized publication after local acceptance. The separate presenter note is docs/defense/hr-academy-rag-notes.md; docs/product/jury-demo-script.md is unchanged. Release checks passed: 255 PostgreSQL tests, 22 initial browser journeys plus the corrected publication journey, 10 keyboard checks, API replacement, contracts, TypeScript, frontend build, ruff, migration drift, and seven verification-runner tests. The initial publication test failed on the obsolete field label; the updated selector passed the entire journey.

A reported first-card alignment defect was reproduced on /team/learning: the first card had 0px top padding while peers had 22px. The old flat-list first-child reset now excludes Academy card layouts.
