# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from app.config import BASE_DIR, STATIC_DIR, cors_origins
from app.routes.firecrawl import bp as firecrawl_bp
from app.routes.openai import bp as openai_bp

logging.basicConfig(level=logging.INFO)


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=str(STATIC_DIR),
        static_url_path="/static",
        template_folder=str(BASE_DIR / "templates"),
    )

    allowed_origins = cors_origins()

    @app.after_request
    def apply_cors(resp):
        origin = request.headers.get("Origin")
        if origin and origin in allowed_origins:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return resp

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/health")
    def health():
        return jsonify({
            "ok": True,
            "service": "firecrawl-proxy",
            "firecrawl_key": bool(os.environ.get("FIRECRAWL_API_KEY")),
        })

    app.register_blueprint(firecrawl_bp)
    app.register_blueprint(openai_bp)
    return app
