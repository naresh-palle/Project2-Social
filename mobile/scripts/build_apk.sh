#!/usr/bin/env bash
# Build a release APK for sideload / testing (no Play Store fee), then share it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/env.sh"
cd "$ROOT"
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE="${API_BASE:-https://project2-social.onrender.com/api}" \
  ${GOOGLE_CLIENT_ID:+--dart-define=GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID}
OUT="$ROOT/build/app/outputs/flutter-apk/app-release.apk"
echo
echo "APK ready: $OUT"
ls -lh "$OUT"
# Copy to dist / Cursor artifacts / frontend/public for local download.
bash "$ROOT/scripts/share_apk.sh"
