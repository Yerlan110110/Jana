# Account and home

## Sub-features

Sign-in and fresh CSRF; role navigation; session/cache isolation; personal action summary; owned notifications.

## How to get to it (user POV)

Open /login as employee.demo, manager.demo or hr.demo with named credentials.

## Driving it with e2e

tests/web/smoke.e2e.ts and auth.setup.e2e.ts. Labels Имя пользователя and Пароль, button Войти, signed-in heading Здравствуйте.

## Proof

One session belongs to the selected employee. Home counts match the scoped API. Logout clears the previous account cache. Notification reads leave business state unchanged.

## Charters

`account-isolation|chromium|default|Using --session employee alone, inspect account switching and long personal task lists for stale private content.`

## Gotchas

Synthetic credentials are local. No self-registration or password-reset API exists.
