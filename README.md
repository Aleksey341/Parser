# Firecrawl Parser

Инструмент для **поиска в интернете**, **пакетного исследования**, **обхода каталогов** и **AI-анализа** собранных материалов.

## Онлайн (GitHub Pages)

**https://aleksey341.github.io/Parser/**

1. Введите полученный API-ключ.
2. Вкладка **«Исследование»** → сформируйте запросы → запустите сбор.
3. Экспорт в **Excel** / **Markdown**, затем **AI-анализ**.

> Python не нужен — работает в браузере. Ключи по умолчанию **не сохраняются** в `localStorage`.

---

## Локальный запуск

```bash
pip install -r requirements.txt
python server.py
```

Откройте: http://127.0.0.1:8765/

Переменные окружения — см. `.env.example`.

---

## Сборка GitHub Pages

```bash
python scripts/build_static.py
```

Публикуется содержимое папки `docs/` (генерируется из `templates/` + `static/`).

---

## Структура проекта

```
Parser/
├── app/                 # Flask-приложение, валидация, клиенты API
├── static/              # CSS и JS-модули
├── templates/           # Единый HTML-шаблон
├── tests/               # pytest
├── scripts/build_static.py
├── docs/                # GitHub Pages (генерируется)
├── server.py
└── README.md
```

---

## Безопасность

См. [SECURITY.md](SECURITY.md).

---

## Лицензия

MIT
