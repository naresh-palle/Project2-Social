#!/usr/bin/env bash
# Unblock the stuck GitHub Pages deploy queue.
#
# Why this exists:
# Cursor Cloud agents authenticate as cursor[bot] with a read-only Actions token
# (cancel returns HTTP 403). Antigravity / your own `gh` login can cancel runs.
#
# Usage (from a machine where `gh` is logged in as a repo admin, e.g. Antigravity):
#   bash scripts/unblock-github-pages.sh
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-naresh-palle/Project2-Social}"
# Ancient Pages run that has sat in "queued" since 2026-07-20 and blocks newer deploys.
ZOMBIE_RUN_ID="${PAGES_ZOMBIE_RUN_ID:-29747341200}"

echo "==> Repo: $REPO"
echo "==> Checking auth (needs Actions write — not cursor[bot] read-only)…"
if ! gh api "repos/$REPO" --jq .full_name >/dev/null; then
  echo "ERROR: gh cannot read $REPO. Run: gh auth login" >&2
  exit 1
fi

cancel_run() {
  local id="$1"
  local status
  status="$(gh api "repos/$REPO/actions/runs/$id" --jq .status 2>/dev/null || echo missing)"
  if [[ "$status" == "missing" ]]; then
    echo "  - run $id not found (ok)"
    return 0
  fi
  if [[ "$status" == "completed" ]]; then
    echo "  - run $id already completed"
    return 0
  fi
  echo "  - canceling run $id (status=$status)…"
  if gh run cancel "$id" -R "$REPO"; then
    echo "    canceled"
  else
    echo "    FAILED to cancel $id — open https://github.com/$REPO/actions/runs/$id and click Cancel" >&2
    return 1
  fi
}

echo "==> Cancel zombie Pages run $ZOMBIE_RUN_ID"
cancel_run "$ZOMBIE_RUN_ID" || true

echo "==> Cancel other queued/in-progress pages-build-deployment runs"
mapfile -t PAGE_RUNS < <(gh run list -R "$REPO" --workflow "pages-build-deployment" --limit 30 \
  --json databaseId,status,name \
  --jq '.[] | select(.status=="queued" or .status=="in_progress" or .status=="waiting") | .databaseId')
for id in "${PAGE_RUNS[@]:-}"; do
  [[ -n "$id" ]] || continue
  cancel_run "$id" || true
done

echo "==> Current Pages status"
gh api "repos/$REPO/pages" --jq '{status, html_url, build_type, source}' || true

echo
echo "Next:"
echo "  1. Confirm Actions queue is clear: https://github.com/$REPO/actions"
echo "  2. Prefer the live app: https://project2-social.onrender.com"
echo "  3. Optional: push a redirect-only gh-pages tip (see README) once the queue is clear"
echo "Done."
