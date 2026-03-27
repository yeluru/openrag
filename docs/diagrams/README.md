# OpenRAG README diagrams

Pixel-crisp **PNG** assets for the main [README](../README.md) are generated from **Mermaid** sources in `sources/`.

## Regenerate (after editing a `.mmd` file)

From the repository root:

```bash
bash scripts/render_diagrams.sh
```

Requirements: **Node.js 18+** and **network** on first run (npx fetches `@mermaid-js/mermaid-cli` and a headless Chromium).

### Sharper PNGs (optional)

Defaults are **scale 3.5**, **2600×1700** viewport. Override for one run:

```bash
MERMAID_SCALE=4 MERMAID_WIDTH=3200 MERMAID_HEIGHT=2000 bash scripts/render_diagrams.sh
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `MERMAID_SCALE` | `3.5` | Puppeteer device scale (higher = sharper, larger files) |
| `MERMAID_WIDTH` | `2600` | Viewport width (px) |
| `MERMAID_HEIGHT` | `1700` | Viewport height (px) |
| `MERMAID_BG` | `#ffffff` | PNG background |
| `MERMAID_CLI_PKG` | `@mermaid-js/mermaid-cli` | Pin e.g. `@mermaid-js/mermaid-cli@11.4.0` for reproducible builds |

### CI on GitHub

When you push to **`main`** and change anything under `docs/diagrams/sources/`, `docs/diagrams/mermaid-config.json`, or `scripts/render_diagrams.sh`, [`.github/workflows/render-diagrams.yml`](../../.github/workflows/render-diagrams.yml) re-runs the script and **commits updated `png/`** if bytes differ. Use **Actions → Render Mermaid diagrams → Run workflow** to regenerate manually.

## Files

| Source | Output PNG | Used in README |
|--------|------------|----------------|
| `sources/01-rag-two-phases.mmd` | `png/rag-two-phases.png` | RAG in two phases |
| `sources/02-system-architecture.mmd` | `png/system-architecture.png` | System architecture |
| `sources/03-api-routes.mmd` | `png/api-routes.png` | API and route surface |
| `sources/04-ingestion-pipeline.mmd` | `png/ingestion-pipeline.png` | Ingestion pipeline |
| `sources/05-ingestion-sequence.mmd` | `png/ingestion-sequence.png` | Ingestion sequence |
| `sources/06-rag-query-path.mmd` | `png/rag-query-path.png` | RAG query path |
| `sources/07-core-erd.mmd` | `png/core-erd.png` | Core data model |
| `sources/08-developer-journey.mmd` | `png/developer-journey.png` | Developer journey |

Styling is controlled by `mermaid-config.json`. Resolution is controlled by the script defaults or `MERMAID_*` env vars above.
