#!/usr/bin/env bash
# Generate an Android upload keystore for Play Store publishing.
# Run from repo: bash mobile/android/scripts/create_upload_keystore.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-upload-keystore.jks}"
ALIAS="${ALIAS:-cr8upload}"
VALIDITY_DAYS="${VALIDITY_DAYS:-10000}"

if [[ -f "$OUT" ]]; then
  echo "Refusing to overwrite existing $OUT"
  exit 1
fi

echo "Creating upload keystore at android/$OUT (alias=$ALIAS)"
keytool -genkey -v \
  -keystore "$OUT" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -alias "$ALIAS"

if [[ ! -f key.properties ]]; then
  cat > key.properties <<EOF
storePassword=PASTE_STORE_PASSWORD
keyPassword=PASTE_KEY_PASSWORD
keyAlias=$ALIAS
storeFile=$OUT
EOF
  echo "Wrote android/key.properties — edit passwords to match what you entered."
else
  echo "key.properties already exists; not overwritten."
fi

echo
echo "Fingerprints (add SHA-1 + SHA-256 to Google Cloud OAuth / Firebase):"
keytool -list -v -keystore "$OUT" -alias "$ALIAS" | grep -E 'SHA1:|SHA256:' || true
echo
echo "Next:"
echo "  1. Fill passwords in android/key.properties"
echo "  2. cd mobile && flutter build appbundle --release"
echo "  3. Upload build/app/outputs/bundle/release/app-release.aab in Play Console"
