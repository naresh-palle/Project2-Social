#!/usr/bin/env bash
# Push Meta OAuth env vars to a Render web service (trial mode by default).
# Never commit secrets. Reads values from backend/.env locally.
#
# Required:
#   RENDER_API_KEY     — Account Settings → API Keys
#   RENDER_SERVICE_ID  — service id (srv-…) from the dashboard URL
#
# Usage:
#   RENDER_API_KEY=rnd_… RENDER_SERVICE_ID=srv-… bash scripts/push-render-meta-env.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

if [[ -z "${RENDER_API_KEY:-}" || -z "${RENDER_SERVICE_ID:-}" ]]; then
  echo "Set RENDER_API_KEY and RENDER_SERVICE_ID first." >&2
  echo "Or paste manually: Render → project2-social → Environment (see docs/render-meta-env.md)." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

export FACEBOOK_APP_ID FACEBOOK_APP_SECRET META_APP_ID META_APP_SECRET
export INSTAGRAM_APP_ID INSTAGRAM_APP_SECRET META_OAUTH_MODE FRONTEND_URL API_PUBLIC_URL
export RENDER_API_KEY RENDER_SERVICE_ID

# Load only Meta-related keys from .env
while IFS='=' read -r key value; do
  case "$key" in
    FACEBOOK_APP_ID|FACEBOOK_APP_SECRET|META_APP_ID|META_APP_SECRET|INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|META_OAUTH_MODE|FRONTEND_URL|API_PUBLIC_URL)
      # strip optional surrounding quotes
      value="${value%\"}" ; value="${value#\"}"
      value="${value%\'}" ; value="${value#\'}"
      export "$key=$value"
      ;;
  esac
done < <(grep -E '^(FACEBOOK_APP_ID|FACEBOOK_APP_SECRET|META_APP_ID|META_APP_SECRET|INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|META_OAUTH_MODE|FRONTEND_URL|API_PUBLIC_URL)=' "$ENV_FILE" | sed 's/\r$//')

FACEBOOK_APP_ID="${FACEBOOK_APP_ID:-}"
FACEBOOK_APP_SECRET="${FACEBOOK_APP_SECRET:-}"
META_APP_ID="${META_APP_ID:-$FACEBOOK_APP_ID}"
META_APP_SECRET="${META_APP_SECRET:-$FACEBOOK_APP_SECRET}"
INSTAGRAM_APP_ID="${INSTAGRAM_APP_ID:-$FACEBOOK_APP_ID}"
INSTAGRAM_APP_SECRET="${INSTAGRAM_APP_SECRET:-$FACEBOOK_APP_SECRET}"
META_OAUTH_MODE="${META_OAUTH_MODE:-trial}"
FRONTEND_URL="${FRONTEND_URL:-https://flugr.in}"
API_PUBLIC_URL="${API_PUBLIC_URL:-https://project2-social.onrender.com}"

export FACEBOOK_APP_ID FACEBOOK_APP_SECRET META_APP_ID META_APP_SECRET
export INSTAGRAM_APP_ID INSTAGRAM_APP_SECRET META_OAUTH_MODE FRONTEND_URL API_PUBLIC_URL

if [[ -z "$FACEBOOK_APP_ID" || -z "$FACEBOOK_APP_SECRET" ]]; then
  echo "FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing in $ENV_FILE" >&2
  exit 1
fi

python3 - <<'PY'
import json, os, urllib.request, urllib.error

service = os.environ["RENDER_SERVICE_ID"]
token = os.environ["RENDER_API_KEY"]
pairs = [
    ("FACEBOOK_APP_ID", os.environ["FACEBOOK_APP_ID"]),
    ("FACEBOOK_APP_SECRET", os.environ["FACEBOOK_APP_SECRET"]),
    ("META_APP_ID", os.environ["META_APP_ID"]),
    ("META_APP_SECRET", os.environ["META_APP_SECRET"]),
    ("INSTAGRAM_APP_ID", os.environ["INSTAGRAM_APP_ID"]),
    ("INSTAGRAM_APP_SECRET", os.environ["INSTAGRAM_APP_SECRET"]),
    ("META_OAUTH_MODE", os.environ.get("META_OAUTH_MODE") or "trial"),
    ("FRONTEND_URL", os.environ.get("FRONTEND_URL") or "https://flugr.in"),
    ("API_PUBLIC_URL", os.environ.get("API_PUBLIC_URL") or "https://project2-social.onrender.com"),
]
body = json.dumps([{"key": k, "value": v} for k, v in pairs]).encode()
req = urllib.request.Request(
    f"https://api.render.com/v1/services/{service}/env-vars",
    data=body,
    method="PUT",
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("batch_status", resp.status)
        raw = resp.read().decode()
        print(raw[:800])
except urllib.error.HTTPError as e:
    print("batch_failed", e.code, e.read()[:500].decode())
    raise SystemExit(1)
PY

echo "Done. Trigger a Render deploy/restart so workers pick up env."
echo "Keep Meta app in Development (trial) until you switch META_OAUTH_MODE=business."
