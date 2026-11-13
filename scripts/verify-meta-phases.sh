#!/usr/bin/env bash
# Verify Phase 1–2 flugr/API readiness for Meta public login.
set -euo pipefail
API="${API_PUBLIC_URL:-https://project2-social.onrender.com}"
echo "== phase-status =="
curl -sS "$API/api/integrations/meta/phase-status" | python3 -m json.tool
echo
echo "== facebook start =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/oauth/facebook/start?mode=login&redirect=https://flugr.in/%23/oauth/callback")
echo "HTTP $code (expect 302)"
echo "== instagram start =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/oauth/instagram/start?mode=login&redirect=https://flugr.in/%23/oauth/callback")
echo "HTTP $code (expect 302)"
echo
echo "Privacy for Meta console: https://flugr.in/privacy-policy.html"
echo "Runbook: docs/meta-phase-1-2-runbook.md"
