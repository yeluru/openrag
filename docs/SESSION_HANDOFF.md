# Session handoff — OpenRAG work log

Condensed notes from a long working session (diagrams, CI, Render, CORS, frontend Library). Safe to delete or archive when no longer needed.

## Diagrams & CI

- **GitHub Action** `Render Mermaid diagrams`: failures were **Chromium sandbox** on Linux (`No usable sandbox`) and missing system libs. Fixed with **`docs/diagrams/puppeteer-ci.json`** (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`); **`scripts/render_diagrams.sh`** applies it when `CI=true` or `MERMAID_PUPPETEER_CI`.
- **Runner**: `ubuntu-22.04`, apt Chromium deps, Node **22**, explicit **git push** with token; workflow commits **`docs/diagrams/png/`** and **`docs/diagrams/svg/`**.
- **Bash 3.2 + `set -u`**: use `${puppeteer_cfg[@]+"${puppeteer_cfg[@]}"}` so empty `puppeteer_cfg` does not error locally.
- **Diagram format**: **`docs/diagrams/sources/01-rag-two-phases.mmd`** and **`06-rag-query-path.mmd`** aligned with **`02-system-architecture.mmd`** (`client` / `domain` / `data` / `ext`, `T1`/`T2`, Postgres cylinder node, `direction TB`).
- **Quality**: README embeds **SVG** under **`docs/diagrams/svg/*.svg`**; script also emits **PNG** with defaults (scale **4**, **2800×1800**); **`docs/diagrams/mermaid-config.json`** tuned (font, spacing, `htmlLabels`).
- **Mermaid ≠ Figma** — expectations documented in **`docs/diagrams/README.md`**.

## Git

- **Divergent `main`**: `git pull --rebase origin main`; binary conflicts on **`docs/diagrams/png/*.png`** → during rebase, `git checkout --theirs` for the replayed commit’s version, then `GIT_EDITOR=true git rebase --continue`.

## Render deploy

- **Blueprint** **`render.yaml`**: **`openrag-db`** + **`openrag-api`**; blueprint path **`render.yaml`** at repo root.
- **URLs**: API e.g. `https://openrag-api.onrender.com`; **`GET /healthz`** — no API key; **`/api/v1/*`** — **`X-Api-Key`** when **`SERVICE_API_KEY`** is set.
- **Same OpenAI key** for **`EMBEDDING_API_KEY`** and **`LLM_API_KEY`** is normal (unless using restricted keys).
- **Static site** (second Render service): **Root directory** **`frontend`**, **Publish directory** **`dist`** (not `vite.config`). Build: `npm install && npm run build`.
- **CORS**: different `*.onrender.com` hosts = different origins → set **`CORS_ORIGINS`** on the API to the exact frontend origin (no trailing slash). Code: **`CORS_ORIGINS`** alias + origin normalization in **`app/core/config.py`**; **`CORSMiddleware` registered before routes** in **`app/main.py`**.
- **401 from browser**: static site needs **`VITE_API_KEY`** (matches **`SERVICE_API_KEY`**) and **`VITE_API_PREFIX=https://openrag-api.onrender.com/api/v1`** at **build time**; rebuild after changes. Anything **`VITE_*`** is public in the client bundle.
- **Large uploads / long indexing**: network + **Render free** timeouts and spin-down; not solved by UI alone. Production: **backend** `POST /documents` or future **object storage** ingestion for private policy docs.

## Frontend — Library / ingestion UX

- **`frontend/src/pages/LibraryPage.tsx`**: **“Refresh indexing status”**; shared **`mergeIngestionStatuses`**; **~12s auto-poll** while any doc is non-terminal (**`frontend/src/lib/ingestion.ts`** — `isNonTerminalIngestionStatus`); polling stops when all **`ready`** or **`failed`**.
- **`frontend/src/openrag-ui/context/OpenRAGContext.tsx`**: lighter post-upload check; toast may point users to Library for updates.

## Security

- **Rotate** **`SERVICE_API_KEY`** (and matching **`VITE_API_KEY`**) if ever pasted in chat, terminals, or screenshots.

## Related docs

- **`DEPLOY_RENDER.md`** — Render backend
- **`docs/diagrams/README.md`** — diagram regeneration
