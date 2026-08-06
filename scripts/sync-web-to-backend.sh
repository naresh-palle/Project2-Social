#!/usr/bin/env bash
# Build the React SPA and copy it into backend/web for Render.
# Do NOT push to gh-pages — Pages is blocked by a stuck Actions run.
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
echo "Synced frontend/build → backend/web (Render serves this)."
echo "Skip GitHub Pages until scripts/unblock-github-pages.sh has cleared the queue."
