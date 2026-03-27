# OpenRAG README diagrams

Pixel-crisp **PNG** assets for the main [README](../README.md) are generated from **Mermaid** sources in `sources/`.

## Regenerate (after editing a `.mmd` file)

From the repository root:

```bash
bash scripts/render_diagrams.sh
```

Requirements: **Node.js 18+** and **network** on first run (npx fetches `@mermaid-js/mermaid-cli` and a headless Chromium).

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

Styling is controlled by `mermaid-config.json`. Bump `-s` in `scripts/render_diagrams.sh` if you need higher resolution for print or Retina hero images.
