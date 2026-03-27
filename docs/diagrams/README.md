# OpenRAG README diagrams

**SVG** (vector) and **PNG** (raster) assets for the main [README](../README.md) are generated from **Mermaid** sources in `sources/`. The README embeds **SVG** so GitHub shows sharp diagrams at any zoom; PNGs remain useful for slides and places that prefer raster.

**Expectations:** Mermaid auto-layout will not match **Figma**-grade custom illustration (icons, grids, brand micro-spacing). For that, export from a design tool into `docs/diagrams/png/` (or SVG) and treat `.mmd` as optional. This pipeline optimizes for **maintainable, reproducible** diagrams.

## Regenerate (after editing a `.mmd` file)

From the repository root:

```bash
bash scripts/render_diagrams.sh
```

Requirements: **Node.js 18+** and **network** on first run (npx fetches `@mermaid-js/mermaid-cli` and a headless Chromium).

### Sharper PNGs (optional)

PNG defaults are **scale 4**, **2800×1800** viewport. SVG ignores device scale but uses the same width/height for layout. Override for one run:

```bash
MERMAID_SCALE=4.5 MERMAID_WIDTH=3200 MERMAID_HEIGHT=2000 bash scripts/render_diagrams.sh
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `MERMAID_SCALE` | `4` | Puppeteer device scale for **PNG** only (higher = sharper, larger files) |
| `MERMAID_WIDTH` | `2800` | Viewport width (px) |
| `MERMAID_HEIGHT` | `1800` | Viewport height (px) |
| `MERMAID_BG` | `#ffffff` | Background (PNG + SVG) |
| `MERMAID_CLI_PKG` | `@mermaid-js/mermaid-cli` | Pin e.g. `@mermaid-js/mermaid-cli@11.4.0` for reproducible builds |

### CI on GitHub

When you push to **`main`** and change anything under `docs/diagrams/sources/`, `docs/diagrams/mermaid-config.json`, or `scripts/render_diagrams.sh`, [`.github/workflows/render-diagrams.yml`](../../.github/workflows/render-diagrams.yml) re-runs the script and **commits updated `png/` and `svg/`** if bytes differ. Use **Actions → Render Mermaid diagrams → Run workflow** to regenerate manually.

## Files

| Source | Output | Used in README |
|--------|--------|------------------|
| `sources/01-rag-two-phases.mmd` | `svg/rag-two-phases.svg`, `png/rag-two-phases.png` | RAG in two phases |
| `sources/02-system-architecture.mmd` | `svg/system-architecture.svg`, `png/system-architecture.png` | System architecture |
| `sources/03-api-routes.mmd` | `svg/api-routes.svg`, `png/api-routes.png` | API and route surface |
| `sources/04-ingestion-pipeline.mmd` | `svg/ingestion-pipeline.svg`, `png/ingestion-pipeline.png` | Ingestion pipeline |
| `sources/05-ingestion-sequence.mmd` | `svg/ingestion-sequence.svg`, `png/ingestion-sequence.png` | Ingestion sequence |
| `sources/06-rag-query-path.mmd` | `svg/rag-query-path.svg`, `png/rag-query-path.png` | RAG query path |
| `sources/07-core-erd.mmd` | `svg/core-erd.svg`, `png/core-erd.png` | Core data model |
| `sources/08-developer-journey.mmd` | `svg/developer-journey.svg`, `png/developer-journey.png` | Developer journey |

Styling is controlled by `mermaid-config.json`. Resolution is controlled by the script defaults or `MERMAID_*` env vars above.
