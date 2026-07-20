# -*- coding: utf-8 -*-
"""Локальный прокси FireCrawl + раздача HTML-интерфейса."""

from __future__ import annotations

import json
import os
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
        return {"error": f"Не удалось связаться с FireCrawl: {exc.reason}"}, 502


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


@app.route("/api/firecrawl/search", methods=["POST", "OPTIONS"])
def firecrawl_search():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True, silent=True) or {}
    query = str(payload.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Укажите query"}), 400

    api_key = _firecrawl_key(payload)
    body = {
        "query": query,
        "limit": max(1, min(int(payload.get("limit") or 5), 20)),
    }
    if payload.get("sources"):
        body["sources"] = payload["sources"]
    if payload.get("includeDomains"):
        body["includeDomains"] = payload["includeDomains"]
    if payload.get("lang"):
        body["lang"] = payload["lang"]
    if payload.get("scrape"):
        body["scrapeOptions"] = {"formats": ["markdown", "links"]}

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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    print(f"Откройте: http://127.0.0.1:{port}/")
    app.run(host="127.0.0.1", port=port, debug=False)
