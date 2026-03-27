#!/usr/bin/env bash
# Render docs/diagrams/sources/*.mmd → docs/diagrams/png/*.png
# Defaults tuned for sharp README images (high scale + large viewport).
# Requires Node.js + npx (downloads @mermaid-js/mermaid-cli and Chromium on first run).
#
# Override for one-off experiments:
#   MERMAID_SCALE=4 MERMAID_WIDTH=3000 MERMAID_HEIGHT=2000 bash scripts/render_diagrams.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIAG="$ROOT/docs/diagrams"
cd "$DIAG"
mkdir -p png

: "${MERMAID_CLI_PKG:=@mermaid-js/mermaid-cli}"
: "${MERMAID_SCALE:=3.5}"
: "${MERMAID_WIDTH:=2600}"
: "${MERMAID_HEIGHT:=1700}"
: "${MERMAID_BG:=#ffffff}"

# GitHub Actions / many Linux CI images block Chromium’s sandbox (zygote/AppArmor).
puppeteer_cfg=()
if [[ "${CI:-}" == "true" ]] || [[ -n "${MERMAID_PUPPETEER_CI:-}" ]]; then
  puppeteer_cfg=(--puppeteerConfigFile puppeteer-ci.json)
fi

for f in sources/*.mmd; do
  [[ -f "$f" ]] || continue
  base=$(basename "$f" .mmd)
  outname="${base#??-}"
  echo "Rendering $f -> png/${outname}.png (scale=${MERMAID_SCALE}, ${MERMAID_WIDTH}x${MERMAID_HEIGHT})"
  # Bash 3.2 + set -u: empty "${arr[@]}" is an error; use + guard.
  npx --yes -p "${MERMAID_CLI_PKG}" mmdc \
    ${puppeteer_cfg[@]+"${puppeteer_cfg[@]}"} \
    -i "$f" \
    -o "png/${outname}.png" \
    -c mermaid-config.json \
    -b "${MERMAID_BG}" \
    -s "${MERMAID_SCALE}" \
    -w "${MERMAID_WIDTH}" \
    -H "${MERMAID_HEIGHT}"
done
echo "Done. PNGs are in docs/diagrams/png/"
