# Agent task queue (session living doc)

| ID | Status | Task | Evidence / blocker |
|---|---|---|---|
| T1–T10 | COMPLETED | Prior auth/UI/signup work | See git history |
| T11 | COMPLETED* | Meta env durability | Live `env_meta` + `runtime_meta` true via Mongo bootstrap + `os.environ` inject on startup. *Render Dashboard UI paste still optional if you want Process env shown there — needs `RENDER_API_KEY`/`RENDER_SERVICE_ID` or manual paste. |
| T12 | BLOCKED | WhatsApp Cloud tokens on Render | Needs verify/access/phone env |
| T13 | COMPLETED | Meta **trial** mode (defer business) | `meta_oauth_mode: trial` on `/api/oauth/providers` |

## Overview

### Completed
- **Trial**: `META_OAUTH_MODE=trial` — Development / app-role testers only; App Review & business Live deferred
- FB + IG configured on API; startup reloads Mongo creds into env slots
- `scripts/push-render-meta-env.sh` ready when Render API key is available

### Not completed / blocked
- Optional: paste same keys in Render → Environment UI (or run push script with API key)
- WhatsApp Cloud tokens
- Later: Meta Live + App Review → set `META_OAUTH_MODE=business`
