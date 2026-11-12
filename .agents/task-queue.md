# Agent task queue (session living doc)

| ID | Status | Task | Evidence / blocker |
|---|---|---|---|
| T1 | COMPLETED | Cream auth UI / sign-in restyle | Deployed Pages earlier |
| T2 | COMPLETED | Social auth + onboarding system (code) | Shipped; mock user validated |
| T3 | COMPLETED | Hide public Agent signup | `PUBLIC_AGENT_ENABLED=false` |
| T4 | COMPLETED | Hide Instagram/Facebook on splash + login | `META_SOCIAL_BUTTONS_ENABLED=false`; splash categories-only |
| T5 | COMPLETED | Signup splash = categories only | RegisterSplash doors only |
| T6 | COMPLETED | Meta App ID/Secret validate + mock user | Graph FLUGR ok |
| T7 | COMPLETED | Facebook/Instagram OAuth server config | Runtime + Mongo bootstrap; FB/IG configured |
| T8 | COMPLETED | Task-queue + dev/test skills | `.agents/skills/*` added |
| T9 | COMPLETED | Category register = IG/FB/Google + username + mobile only | Live |
| T10 | COMPLETED | WhatsApp webhook stub | `GET/POST /api/webhooks/whatsapp` |
| T11 | IN_PROGRESS | Render dashboard Meta env paste | No Render API key in agent; Mongo inject + `scripts/push-render-meta-env.sh` ready; human paste or `RENDER_API_KEY`+`RENDER_SERVICE_ID` |
| T12 | BLOCKED | WhatsApp Cloud tokens on Render | Needs verify/access/phone env |
| T13 | COMPLETED | Meta stays **trial** (defer business/App Review) | `META_OAUTH_MODE=trial`; docs updated |

## Overview

### Completed
- Trial mode locked in (`META_OAUTH_MODE=trial`) — no App Review / business Live yet
- Meta creds durable via Mongo `app_config` + startup `os.environ` inject (shared DB)
- Push script for Render when API key available

### Not completed / blocked
- Human: paste Meta env on Render **or** provide `RENDER_API_KEY` + `RENDER_SERVICE_ID` and re-run `scripts/push-render-meta-env.sh`
- WhatsApp Cloud tokens
- Later: Meta Live + App Review → `META_OAUTH_MODE=business`
