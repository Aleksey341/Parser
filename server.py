# -*- coding: utf-8 -*-
"""Локальный прокси FireCrawl + раздача HTML-интерфейса."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

from flask import Flask, jsonify, request

BASE = Path(__file__).resolve().parent
FIRECRAWL_API = "https://api.firecrawl.dev/v2"
app = Flask(__name__, static_folder=str(BASE), static_url_path="")


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def _firecrawl_key(payload: dict | None = None) -> str:
    key = ""
    if payload:
        key = str(payload.get("apiKey") or payload.get("api_key") or "").strip()
    return key or os.environ.get("FIRECRAWL_API_KEY", "").strip()


def _firecrawl_post(path: str, body: dict, api_key: str) -> tuple[dict, int]:
    payload = {k: v for k, v in body.items() if k not in ("apiKey", "api_key") and v is not None}
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(
        f"{FIRECRAWL_API}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(raw)
        except json.JSONDecodeError:
            err = {"error": raw or exc.reason}
        return err, exc.code
    except urllib.error.URLError as exc:
        return {"error": f"Не удалось связаться с API: {exc.reason}"}, 502


def _firecrawl_get(url: str, api_key: str) -> tuple[dict, int]:
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(raw)
        except json.JSONDecodeError:
            err = {"error": raw or exc.reason}
        return err, exc.code
    except urllib.error.URLError as exc:
        return {"error": f"Не удалось связаться с API: {exc.reason}"}, 502


def _build_crawl_body(payload: dict) -> dict:
    body = {
        "url": str(payload.get("url") or "").strip(),
        "limit": max(1, min(int(payload.get("limit") or 50), 500)),
        "maxDiscoveryDepth": max(1, int(payload.get("maxDiscoveryDepth") or 3)),
        "crawlEntireDomain": bool(payload.get("crawlEntireDomain")),
    }
    if payload.get("includePaths"):
        body["includePaths"] = payload["includePaths"]
    if payload.get("excludePaths"):
        body["excludePaths"] = payload["excludePaths"]
    if payload.get("scrape"):
        body["scrapeOptions"] = {"formats": ["markdown"]}
    return body


@app.route("/")
def index():
    return app.send_static_file("firecrawl_parser.html")


@app.route("/api/health")
def health():
    return jsonify({
        "ok": True,
        "service": "firecrawl-proxy",
        "firecrawl_key": bool(os.environ.get("FIRECRAWL_API_KEY")),
    })


def _normalize_domain(value: str) -> str:
    domain = value.strip()
    if domain.lower().startswith("http://"):
        domain = domain[7:]
    elif domain.lower().startswith("https://"):
        domain = domain[8:]
    return domain.split("/")[0].split(":")[0]


def _build_search_body(payload: dict) -> dict:
    query = str(payload.get("query") or "").strip()
    body = {
        "query": query,
        "limit": max(1, min(int(payload.get("limit") or 5), 100)),
    }

    domains = []
    raw_domains = payload.get("includeDomains")
    if isinstance(raw_domains, list):
        domains = [_normalize_domain(str(item)) for item in raw_domains if str(item).strip()]
    elif raw_domains:
        domains = [_normalize_domain(part) for part in re.split(r"[\s,;]+", str(raw_domains)) if part.strip()]
    if domains:
        body["includeDomains"] = domains

    sources = payload.get("sources") or ["web"]
    lang = str(payload.get("lang") or "").strip()
    needs_sources = bool(lang) or len(sources) != 1 or sources[0] != "web"
    if needs_sources:
        built_sources = []
        for source_type in sources:
            src = {"type": source_type}
            if lang and source_type in ("web", "news"):
                src["lang"] = lang
                if lang == "ru":
                    src["country"] = "RU"
                elif lang == "en":
                    src["country"] = "US"
            built_sources.append(src)
        body["sources"] = built_sources

    if payload.get("scrape"):
        body["scrapeOptions"] = {"formats": ["markdown"]}
    if payload.get("tbs"):
        body["tbs"] = str(payload["tbs"])
    return body


@app.route("/api/firecrawl/search", methods=["POST", "OPTIONS"])
def firecrawl_search():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True, silent=True) or {}
    query = str(payload.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Укажите query"}), 400

    api_key = _firecrawl_key(payload)
    body = _build_search_body(payload)

    data, status = _firecrawl_post("/search", body, api_key)
    return jsonify(data), status


@app.route("/api/firecrawl/scrape", methods=["POST", "OPTIONS"])
def firecrawl_scrape():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True, silent=True) or {}
    url = str(payload.get("url") or "").strip()
    if not url:
        return jsonify({"error": "Укажите url"}), 400

    api_key = _firecrawl_key(payload)
    formats = payload.get("formats") or ["markdown"]
    body = {"url": url, "formats": formats}
    data, status = _firecrawl_post("/scrape", body, api_key)
    return jsonify(data), status


@app.route("/api/firecrawl/crawl", methods=["POST", "OPTIONS"])
def firecrawl_crawl():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True, silent=True) or {}
    url = str(payload.get("url") or "").strip()
    if not url:
        return jsonify({"error": "Укажите url"}), 400

    api_key = _firecrawl_key(payload)
    body = _build_crawl_body(payload)
    data, status = _firecrawl_post("/crawl", body, api_key)
    return jsonify(data), status


@app.route("/api/firecrawl/get", methods=["GET", "OPTIONS"])
def firecrawl_get_proxy():
    if request.method == "OPTIONS":
        return ("", 204)
    api_key = _firecrawl_key(request.args)
    next_url = str(request.args.get("next") or "").strip()
    path = str(request.args.get("path") or "").strip()
    if next_url:
        target = next_url
    elif path:
        target = f"{FIRECRAWL_API}{path if path.startswith('/') else '/' + path}"
    else:
        return jsonify({"error": "Укажите path или next"}), 400

    data, status = _firecrawl_get(target, api_key)
    return jsonify(data), status


@app.route("/api/ai/analyze", methods=["POST", "OPTIONS"])
def ai_analyze():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True, silent=True) or {}
    api_key = str(payload.get("openaiKey") or payload.get("api_key") or "").strip()
    api_key = api_key or os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return jsonify({"error": "Укажите ключ OpenAI (sk-…) или OPENAI_API_KEY"}), 400

    messages = payload.get("messages") or []
    if not messages:
        return jsonify({"error": "Нет messages для анализа"}), 400

    model = str(payload.get("model") or "gpt-4o-mini")
    body = {"model": model, "messages": messages, "temperature": 0.3}
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            return jsonify({"content": content, "success": True})
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(raw)
            msg = err.get("error", {}).get("message") or raw
        except json.JSONDecodeError:
            msg = raw or exc.reason
        return jsonify({"error": msg}), exc.code
    except urllib.error.URLError as exc:
        return jsonify({"error": f"Не удалось связаться с OpenAI: {exc.reason}"}), 502


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    print(f"Откройте: http://127.0.0.1:{port}/")
    app.run(host="127.0.0.1", port=port, debug=False)
