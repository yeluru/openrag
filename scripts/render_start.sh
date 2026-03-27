#!/usr/bin/env bash
# Render.com: run DB migrations then start the API (PORT is set by Render).
set -euo pipefail
cd "$(dirname "$0")/.."
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
