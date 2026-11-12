# Agent task queue (session living doc)

| ID | Status | Task | Evidence / blocker |
|---|---|---|---|
| T1 | COMPLETED | Cream auth UI / sign-in restyle | Deployed Pages earlier |
| T2 | COMPLETED | Social auth + onboarding system (code) | Shipped; mock user validated |
| T3 | COMPLETED | Hide public Agent signup | `PUBLIC_AGENT_ENABLED=false` |
| T4 | COMPLETED | Hide Instagram/Facebook buttons | `META_SOCIAL_BUTTONS_ENABLED=false` |
| T5 | COMPLETED | Signup = categories only | RegisterSplash doors only; Pages deploy |
| T6 | COMPLETED | Meta App ID/Secret validate + mock user | Graph FLUGR ok; user `mock.fb.flugr001@gmail.com`; apply 403 |
| T7 | BLOCKED | Facebook/Instagram live OAuth buttons | Need Render env + Meta redirect URIs + UI flag on |
| T8 | COMPLETED | Task-queue + dev/test skills | `.agents/skills/*` added |
| T9 | QUEUED | (none) | — |

## Overview template

### Completed
- See COMPLETED rows above

### Not completed / blocked
- Facebook/Instagram production OAuth env on Render + App Review
- WhatsApp Cloud API (config shared only; not implemented)
