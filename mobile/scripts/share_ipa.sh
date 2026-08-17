#!/usr/bin/env bash
# Copy the latest iOS IPA to dist / Cursor artifacts / frontend/public (Pages).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
OUT="$ROOT/build/ios/ipa/cr8-studio-release.ipa"
if [ ! -f "$OUT" ]; then
  echo "No IPA at $OUT — run bash mobile/scripts/build_ios.sh on macOS (or GitHub Actions)." >&2
  exit 1
fi
VERSION="$(awk '/^version:/{print $2; exit}' "$ROOT/pubspec.yaml" | cut -d+ -f1)"
NAME="cr8-studio-release.ipa"
VERSIONED="CR8-Studio-${VERSION}.ipa"

mkdir -p "$ROOT/dist"
cp -f "$OUT" "$ROOT/dist/$NAME"
cp -f "$OUT" "$ROOT/dist/$VERSIONED"

if [ -d /opt/cursor/artifacts ]; then
  cp -f "$OUT" "/opt/cursor/artifacts/$NAME"
  cp -f "$OUT" "/opt/cursor/artifacts/$VERSIONED"
  cp -f "$OUT" "/opt/cursor/artifacts/CR8-Studio.ipa"
fi

PUBLIC="$REPO/frontend/public"
if [ -d "$PUBLIC" ]; then
  cp -f "$OUT" "$PUBLIC/$NAME"
fi

BUILD_DIR="$REPO/frontend/build"
if [ -d "$BUILD_DIR" ]; then
  cp -f "$OUT" "$BUILD_DIR/$NAME"
fi

echo
echo "Shared IPA ($VERSION):"
ls -lh "$OUT" "$ROOT/dist/$NAME"
echo "Pages file (after deploy): https://naresh-palle.github.io/Project2-Social/$NAME"
echo "Local copy: $ROOT/dist/$NAME"
if [ -d /opt/cursor/artifacts ]; then
  echo "Cursor artifact: /opt/cursor/artifacts/$NAME"
fi
