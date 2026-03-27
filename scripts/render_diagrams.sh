#!/usr/bin/env bash
# Render docs/diagrams/sources/*.mmd to PNGs in docs/diagrams/png/ (2x scale, white background).
# Requires Node.js + npx (downloads @mermaid-js/mermaid-cli and Chromium on first run).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIAG="$ROOT/docs/diagrams"
cd "$DIAG"
mkdir -p png
for f in sources/*.mmd; do
  [[ -f "$f" ]] || continue
  base=$(basename "$f" .mmd)
  outname="${base#??-}"
  echo "Rendering $f -> png/${outname}.png"
  # -p installs the package; `mmdc` is the CLI binary (see docs/diagrams/README.md)
  npx --yes -p @mermaid-js/mermaid-cli mmdc \
    -i "$f" \
    -o "png/${outname}.png" \
    -c mermaid-config.json \
    -b white \
    -s 2 \
    -w 2000 \
    -H 1400
done
echo "Done. PNGs are in docs/diagrams/png/"
