# Deploy OpenRAG (backend only) on Render

This guide assumes you deploy **only the FastAPI API** from this repository. Your frontend (if any) stays elsewhere; you point it at the Render service URL and configure CORS.

## What Render runs

- **Build**: `pip install --upgrade pip && pip install -r requirements.txt`
- **Start**: `bash scripts/render_start.sh`  
  That runs `alembic upgrade head` (migrations, including `pgvector`) then `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Render sets **`PORT`**; do not hardcode it.

## Prerequisites

1. A [Render](https://render.com) account.
2. This repo pushed to **GitHub** or **GitLab** (Render connects to git for deploys).
3. For real embeddings/chat: **OpenAI** (or compatible) API keys. For smoke tests only, you can set `EMBEDDING_PROVIDER=mock` and `LLM_PROVIDER=mock` (no keys; not for production).

## Option A — Blueprint (Infrastructure as Code)

1. In the Render Dashboard: **New** → **Blueprint**.
2. Connect the repository and select the branch.
3. Render reads [`render.yaml`](render.yaml) at the repo root and provisions:
   - A **PostgreSQL** instance (`openrag-db`).
   - A **Web Service** (`openrag-api`) with `DATABASE_URL` wired from the database.

4. After the first deploy, open the **Web Service** → **Environment** and set any variable marked `sync: false` in the blueprint (at minimum **`CORS_ORIGINS`**, **`EMBEDDING_API_KEY`**, **`LLM_API_KEY`** if you use OpenAI).

5. Copy **`SERVICE_API_KEY`** from the dashboard if you enabled it (blueprint uses `generateValue: true`). Your clients must send header **`X-Api-Key`** with that value on `/api/v1/*` routes when the key is set.

**Note:** The blueprint uses **`plan: free`** for demo cost. Free web services **spin down** after inactivity; free Postgres may also have limits. Upgrade plans for production.

## Option B — Manual Dashboard setup

### 1. Create PostgreSQL

1. **New** → **PostgreSQL**.
2. Name it (e.g. `openrag-db`), pick region/plan.
3. After creation, open the database → **Connect** (or **Info**).
4. Copy the **Internal Database URL** (recommended for the API service in the same region/account). It looks like `postgres://...` or `postgresql://...`.

Render documents PostgreSQL extensions (including **`vector`**) in their [PostgreSQL extensions](https://render.com/docs/postgresql-extensions) doc. The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`.

### 2. Create Web Service

1. **New** → **Web Service**.
2. Connect the same repo/branch.
3. Configure:
   - **Runtime**: Python 3
   - **Root directory**: leave default (repo root) unless you moved the app.
   - **Build command**:  
     `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start command**:  
     `bash scripts/render_start.sh`
   - **Health check path**: `/healthz`  
     This path is **unauthenticated** and does **not** hit the database (unlike `/api/v1/health`).

4. **Environment variables** (minimum sensible production set):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Paste **Internal Database URL** from Render Postgres. The app normalizes `postgres://` / `postgresql://` to SQLAlchemy + asyncpg / psycopg2. |
| `DEBUG` | No | `false` in production. |
| `LOG_JSON` | No | `true` on Render for structured logs. |
| `PYTHON_VERSION` | No | e.g. `3.12.8` — should match [`runtime.txt`](runtime.txt). |
| `UPLOAD_DIR` | No | Default `./data/uploads` is under the repo on disk (**ephemeral** on Render: uploads are lost on redeploy unless you use a [persistent disk](https://render.com/docs/disks)). |
| `CORS_ORIGINS` | If browser clients | Comma-separated origins, e.g. `https://app.example.com,https://www.example.com`. Empty = CORS middleware not added. |
| `SERVICE_API_KEY` | Recommended | If set, clients must send `X-Api-Key`. Does **not** apply to `GET /healthz`. |
| `EMBEDDING_PROVIDER` | For real search | `openai` or `mock`. |
| `EMBEDDING_API_KEY` | If `openai` | OpenAI API key. |
| `EMBEDDING_API_BASE` | No | Default `https://api.openai.com/v1`. |
| `LLM_PROVIDER` | For chat | `openai` or `mock`. |
| `LLM_API_KEY` | If `openai` | OpenAI API key. |
| `LLM_API_BASE` | No | Default `https://api.openai.com/v1`. |
| `PDF_OCR_ENABLED` | No | `true` only if Tesseract is available (see **OCR** below). Default `false` on Render unless you use Docker with Tesseract. |

5. **Save** and deploy. Watch **Logs**: you should see Alembic upgrade, then Uvicorn listening on `0.0.0.0:$PORT`.

### 3. Verify

- Open `https://<your-service>.onrender.com/healthz` → JSON `{"status":"live"}`.
- Open `https://<your-service>.onrender.com/api/v1/health`  
  - If `SERVICE_API_KEY` is unset: should report DB status.  
  - If set: send header `X-Api-Key: <your-key>`.

API base for your frontend: `https://<your-service>.onrender.com/api/v1` (see `API_PREFIX` in config; default `/api/v1`).

## Ephemeral disk vs persistent uploads

Render’s filesystem for a normal web service is **ephemeral**. Redeploys replace the instance; **uploaded PDFs are lost** unless you:

- Attach a **[Render Disk](https://render.com/docs/disks)** (paid instance types), mount it (e.g. `/var/data`), and set `UPLOAD_DIR` to a directory under that mount (e.g. `/var/data/uploads`), **or**
- Store PDFs in object storage (S3, R2, etc.) and point the app there (would require code changes not included in this doc).

## CORS

`CORS_ORIGINS` must include the **exact** browser origin (scheme + host + port), comma-separated, no trailing slashes on origins. Example: `https://myapp.vercel.app`.

## Database URL and SSL

Use the **Internal** URL from Render’s Postgres dashboard for the API in the same account/region. If you ever use an **external** URL from a local machine, Render typically requires TLS; their UI shows the right string. If async connections fail with SSL errors, consult Render’s DB docs and SQLAlchemy/asyncpg SSL options for your URL shape.

## OCR (Tesseract)

Scanned-PDF OCR needs **Tesseract** on the server. Render’s **native Python** runtime does **not** include Tesseract. Options:

- Keep **`PDF_OCR_ENABLED=false`** (simplest on native Python), or  
- Deploy with **Docker** on Render, using an image where `tesseract-ocr` is installed, and set `PDF_OCR_ENABLED=true` plus any `PDF_OCR_*` vars from [`.env.example`](.env.example).

## Connection pooling

If you use [Render Postgres connection pooling](https://render.com/docs/postgresql-connection-pooling), use the **pooling URL** they provide as `DATABASE_URL` if you hit connection limits. Ensure the pooler supports what you need for pgvector workloads.

## Migrations

Migrations run **on every start** via `scripts/render_start.sh`. That avoids running Alembic during **build** (when `DATABASE_URL` may be unavailable). If a migration fails, the web process exits and Render will show a failed deploy — fix the DB or migration, then redeploy.

## Files added for Render

| File | Role |
|------|------|
| [`runtime.txt`](runtime.txt) | Python version for Render. |
| [`scripts/render_start.sh`](scripts/render_start.sh) | Migrate + start Uvicorn. |
| [`render.yaml`](render.yaml) | Optional Blueprint (Postgres + web). |
| [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md) | This document. |

`GET /healthz` is defined in [`app/main.py`](app/main.py) for load balancer / Render health checks without API key or DB.

## Local parity

See [`.env.example`](.env.example) for all variables. For local Docker Postgres, use `POSTGRES_*` or set `DATABASE_URL` to match your setup.
