# Доказательства продуктового исследования

Этот каталог содержит только метаданные и короткие авторские наблюдения. Полные статьи, DOM, accessibility text и фирменные изображения конкурентов в публичный репозиторий не включены.

[rea-summary.json](rea-summary.json) связывает исходный URL, контрольную сумму скачанного HTML, параметры сценария, результат REA и пределы вывода. Полный результат инструмента содержит статью и остаётся вне Git. Его digest позволяет проверить совпадение при наличии исходного исследовательского артефакта.

## Выполненный запуск

Проверенный инструмент: REA 6.5.0. Браузер: Chromium 155.0.8059.84. Режим: provider-owned headless browser. Дата: 17 октября 2026 года.

```text
Evidence ID
ev_33cc4b6721164f4b9ab1846a18011d38631ee9b080288aab3a491ed4db0c1fce

Source HTML SHA-256
7d07ed9f4ca49ec93d27d4b338c6dfc52ae3aad8a571ff4a3f60c4df491b4a0d

Raw tool output SHA-256
8a1a1aa59a7ee2cdb311b47071412023ead1476de95220886a6b23ad55941b8e
```

Сначала REA попытался открыть [живую страницу LearnUpon](https://support.learnupon.com/hc/en-us/articles/10014314018717-Learner-view-Home). Переход завершился ошибкой до начального состояния. Причина не раскрыта. Этот результат отмечен как неуспешный.

Затем оригинальные скачанные байты страницы были доступны через локальный HTTP-сервер. Сценарий ожидал видимого `h1`, после чего сохранил URL, DOM и accessibility tree. Итоговый capture имеет `ok: true`. Относительные CSS, JS и изображения не копировались и отвечали 404. Поэтому результат относится к структуре статьи, а не к виду и работе LMS.

Отдельно открыты три опубликованных изображения из справочных центров. Их URL, SHA-256 и границы наблюдения находятся в JSON. Их изучение не называется авторизованным browser scenario.

## Как повторить ограниченную проверку

1. Установите закреплённый REA по [инструкции проекта](../../tooling/codex-setup.md).
2. Скачайте указанную публичную статью в отдельный временный каталог. Не добавляйте полный HTML в Git.
3. Рассчитайте SHA-256 файла. Если digest отличается, это другая версия исходника. Сохраните новое значение и дату.
4. Поднимите локальный HTTP-сервер только для этого каталога. Пример использованной команды:

```bash
python3 -m http.server 8768 --bind 127.0.0.1 --directory /tmp/janamen-product-evidence
```

5. Создайте временный JSON сценария. Укажите фактический путь к доступному Chromium. Схему текущего закреплённого инструмента можно прочитать командой:

```bash
node scripts/tooling/rea.mjs capture-browser-scenario --schema
```

Использованный сценарий имеет такую структуру. Путь к браузеру является параметром локальной исследовательской среды.

```json
{
  "browser": {
    "mode": "launch",
    "executable_path": "/tmp/janamen-chrome/chrome-headless-shell-linux64/chrome-headless-shell",
    "headless": true
  },
  "start_url": {
    "url": "http://127.0.0.1:8768/learnupon-home-source.html"
  },
  "environment": {
    "viewport": { "width": 1440, "height": 1000, "device_scale_factor": 1 },
    "locale": "en-US",
    "timezone": "Asia/Almaty",
    "color_scheme": "light",
    "reduced_motion": "reduce",
    "service_workers": "block"
  },
  "actions": [
    {
      "step_id": "article_visible",
      "action": "wait_for",
      "locator": { "kind": "css", "selector": "h1" },
      "state": "visible",
      "timeout_ms": 20000
    }
  ],
  "capture": { "at_end": ["url", "dom", "accessibility"] }
}
```

6. Выполните команду из корня Jana. Полный результат сохраняется только во временный каталог:

```bash
node scripts/tooling/rea.mjs capture-browser-scenario /tmp/janamen-product-evidence/learnupon-mirror-scenario.json --format json --full-output > /tmp/janamen-product-evidence/learnupon-mirror-capture.json
```

7. Проверьте `ok`, `evidence_id`, этапы, completeness и limitations. Успешный exit code не заменяет чтение ограничений.
8. Сохраните новый evidence index без полного чужого текста. Не заменяйте прежний Evidence ID новым результатом без указания отдельного запуска.
9. Остановите только свой временный сервер. REA завершает принадлежащий ему браузер согласно полю cleanup.

MCP doctor и наличие инструментов в конкретном клиенте являются отдельными проверками. Успешный CLI capture не утверждает автоматическую активацию MCP в чужой сессии. Актуальный протокол установки находится в [tooling verification](../../tooling/verification.json).
