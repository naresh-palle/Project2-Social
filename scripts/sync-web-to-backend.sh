#!/usr/bin/env bash
# Build the React SPA and copy it into backend/web for Render.
# After syncing, commit backend/web and push main. Then publish Pages separately
# with: cd frontend && npm run deploy:gh-pages
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
# Render serves from site root — use relative asset URLs, not the GH Pages prefix
PUBLIC_URL=. npm run build
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
if [[ -d build/brand ]]; then
  rm -rf "$ROOT/backend/web/brand"
  cp -a build/brand "$ROOT/backend/web/brand"
fi
# Root public assets used by landing / branding / chat
for f in flugr-logo.png favicon.ico apple-touch-icon.png hero_bg.png hero_bg.jpg hero_models_bg.jpg splash_bg.png splash_bg_2.png splash_bg_3.png splash_bg_4.png chat-panel-bg.png icon.jpg; do
  if [[ -f "build/$f" ]]; then
    cp -f "build/$f" "$ROOT/backend/web/$f"
  fi
done
echo "Synced frontend/build → backend/web (Render serves this)."
echo "Next: push main for Render, then npm run deploy:gh-pages for GitHub Pages."
