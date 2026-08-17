#!/usr/bin/env bash
# Build an iOS IPA. Requires macOS + Xcode (or GitHub Actions macos-latest).
# Unsigned IPA is produced when no signing team is configured.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/env.sh"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS compilation needs macOS + Xcode."
  echo "This script packages an IPA on macOS; on Linux/Windows use GitHub Actions:"
  echo "  .github/workflows/flutter-ios.yml  (runs on macos-latest)"
  echo "Or on a Mac:"
  echo "  cd mobile && bash scripts/build_ios.sh"
  exit 2
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found. Install Xcode from the Mac App Store, then:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 2
fi

API_BASE="${API_BASE:-https://project2-social.onrender.com/api}"
flutter pub get
flutter build ios --release --no-codesign \
  --dart-define="API_BASE=${API_BASE}" \
  ${GOOGLE_CLIENT_ID:+--dart-define=GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID}

APP="$(find "$ROOT/build/ios/iphoneos" -maxdepth 1 -name '*.app' | head -1)"
if [[ -z "$APP" ]]; then
  echo "No Runner.app under build/ios/iphoneos" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/Payload"
cp -R "$APP" "$STAGE/Payload/"
IPA="$ROOT/build/ios/ipa/cr8-studio-release.ipa"
mkdir -p "$(dirname "$IPA")"
(cd "$STAGE" && zip -qry "$IPA" Payload)
rm -rf "$STAGE"

echo
echo "IPA ready: $IPA"
ls -lh "$IPA"
bash "$ROOT/scripts/share_ipa.sh"
