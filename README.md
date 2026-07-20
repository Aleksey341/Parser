# FireCrawl Parser

HTML-интерфейс для **поиска в интернете** и **парсинга страниц** через [FireCrawl API](https://www.firecrawl.dev/).

- Поиск по запросу + markdown найденных страниц
- Парсинг одного URL
- Локальный Python-прокси (обход CORS браузера)

## Быстрый старт

```bash
pip install -r requirements.txt
python server.py
```

Откройте: **http://127.0.0.1:8765/**

API-ключ FireCrawl:
- введите в поле на странице (сохраняется в браузере), или
- задайте переменную окружения:

```bash
# Windows PowerShell
$env:FIRECRAWL_API_KEY="fc-ваш-ключ"
python server.py
```

Ключ: https://www.firecrawl.dev/app/api-keys

## Структура

| Файл | Назначение |
|------|------------|
| `firecrawl_parser.html` | UI |
| `server.py` | Flask-прокси к FireCrawl |
| `requirements.txt` | Зависимости |

## API (локально)

- `GET /api/health` — проверка сервера
- `POST /api/firecrawl/search` — поиск `{ "query": "...", "limit": 5, "scrape": true }`
- `POST /api/firecrawl/scrape` — парсинг `{ "url": "https://...", "formats": ["markdown"] }`

Ключ можно передать в теле: `"apiKey": "fc-..."` или через `FIRECRAWL_API_KEY`.

## GitHub Pages

Статический HTML **без сервера работать не будет** — нужен прокси. Для публикации UI используйте GitHub Pages только как витрину, а сервер — локально или на VPS/Heroku/Railway.

## Лицензия

MIT
