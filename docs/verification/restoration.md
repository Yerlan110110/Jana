# Восстановление исходной поставки

17 октября 2026 года `git ls-remote https://github.com/Yerlan110110/Jana.git` вернул пустой список ссылок. Рабочая папка `/home/yqecea/coding-projects/jana` была пуста.

История восстановлена из приложенного `janamen-history.bundle`. Проверка `git bundle verify` подтвердила полную историю. Сохранены `main` и четыре исходные ветки реализации. Новый starter не создавался.

| Проверка | Результат |
| --- | --- |
| HEAD | `f4a2be1dc35045b7d319c9ceeaf615e56a642178` |
| Git tree | `1cf5ff031aa30c4df53da3e2ae30473696f3fda1` |
| Основная история | 22 исходных коммита |
| PostgreSQL suite внутри Docker | 191 passed, 153 warnings, 120.72 s |
| `node scripts/tooling/verify-skills.mjs` | 297 закреплённых файлов, 4 источника, 94 имени навыков |
| `python3 -m unittest discover -s scripts/verification/tests -v` | 2 passed |
| GitHub API `permissions.push` | `true` для `Yerlan110110/Jana` |

PostgreSQL запускался в отдельном Compose project `janamen-runtime-baseline`. Посторонние контейнеры не менялись. Исходный архив, checkpoint и полный журнал прогона сохранены локально в `.artifacts/handoff-source/` и `.artifacts/baseline/`.

Это проверка восстановленного backend. Она не подтверждает готовность будущего frontend, публикацию в GitHub, браузерные сценарии или подключение настоящих 1С, Documentolog и модели. Следующие проверки фиксируются в текущем [HANDOFF](../../HANDOFF.md).
