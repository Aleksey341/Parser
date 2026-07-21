# FireCrawl Parser

HTML-интерфейс для **поиска в интернете** и **парсинга страниц** через [FireCrawl API](https://www.firecrawl.dev/).

## Использовать по ссылке (без скачивания)

1. Включите **GitHub Pages** в репозитории:
   - **Settings** → **Pages**
   - **Source:** Deploy from a branch
   - **Branch:** `main` → папка **`/docs`**
   - **Save**

2. Через 1–2 минуты откройте:

   **`https://ВАШ-ЛОГИН.github.io/firecrawl-parser/`**

   Пример: `https://github.com/Aleksey341/firecrawl-parser` →  
   `https://aleksey341.github.io/firecrawl-parser/`

3. Вставьте **API-ключ FireCrawl** (поле слева).

4. Выполните поиск или парсинг URL → кнопка **Excel** для сохранения.

> Скачивание и Python **не нужны** — всё работает в браузере по ссылке.

---

## Локальный запуск (опционально)

```bash
pip install -r requirements.txt
python server.py
```

Откройте: http://127.0.0.1:8765/

---

## API-ключ

Получить: https://www.firecrawl.dev/app/api-keys

- В онлайн-режиме — вводите в форму (хранится только в браузере)
- Локально — можно задать `FIRECRAWL_API_KEY` в окружении

**Не коммитьте ключ в git.**

---

## Экспорт в Excel

Кнопка **Excel** → файл с листами **Результаты** и **Сводка**.

---

## Структура

| Файл | Назначение |
|------|------------|
| `docs/index.html` | Версия для GitHub Pages |
| `firecrawl_parser.html` | Копия для локального сервера |
| `server.py` | Локальный прокси (search, scrape, crawl) |

---

## Лицензия

MIT
