#!/usr/bin/env bash
# Build the React SPA and copy it into backend/web for Render.
# After syncing, commit backend/web and push main. Then publish Pages separately
# with: cd frontend && npm run deploy:gh-pages
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
npm run build
# Preserve legal/static extras already on backend/web
cp -f build/index.html "$ROOT/backend/web/index.html"
cp -f build/asset-manifest.json "$ROOT/backend/web/asset-manifest.json"
cp -f build/manifest.json "$ROOT/backend/web/manifest.json"
[[ -f build/sw.js ]] && cp -f build/sw.js "$ROOT/backend/web/sw.js"
rm -rf "$ROOT/backend/web/static"
cp -a build/static "$ROOT/backend/web/static"
# Public assets (AI icons, etc.)
if [[ -d build/icons ]]; then
  rm -rf "$ROOT/backend/web/icons"
  cp -a build/icons "$ROOT/backend/web/icons"
fi
echo "Synced frontend/build → backend/web (Render serves this)."
echo "Next: push main for Render, then npm run deploy:gh-pages for GitHub Pages."
