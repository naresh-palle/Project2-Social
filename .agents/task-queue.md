# Agent task queue (session living doc)

| ID | Status | Task | Evidence / blocker |
|---|---|---|---|
| T1 | COMPLETED | Cream auth UI / sign-in restyle | Deployed Pages earlier |
| T2 | COMPLETED | Social auth + onboarding system (code) | Shipped; mock user validated |
| T3 | COMPLETED | Hide public Agent signup | `PUBLIC_AGENT_ENABLED=false` |
| T4 | COMPLETED | Hide Instagram/Facebook on splash + login | `META_SOCIAL_BUTTONS_ENABLED=false`; splash categories-only |
| T5 | COMPLETED | Signup splash = categories only | RegisterSplash doors only |
| T6 | COMPLETED | Meta App ID/Secret validate + mock user | Graph FLUGR ok; user `mock.fb.flugr001@gmail.com` |
| T7 | IN_PROGRESS | Facebook/Instagram live OAuth | Category register restores IG/FB via `forceMeta`; runtime Meta bootstrap + Render env docs |
| T8 | COMPLETED | Task-queue + dev/test skills | `.agents/skills/*` added |
| T9 | COMPLETED | Category register = IG/FB/Google + username + mobile only | Register.jsx rewrite + `/auth/username-mobile-register` |
| T10 | COMPLETED | WhatsApp webhook stub | `GET/POST /api/webhooks/whatsapp` + docs |
| T11 | QUEUED | Render dashboard env paste (human) | Prefer `FACEBOOK_APP_*` on Render for multi-instance |

## Overview template

### Completed
- See COMPLETED rows above

### Not completed / blocked
- Human: paste Meta secrets into Render Environment (runtime bootstrap covers single-instance until then)
- WhatsApp outbound send / OTP via WhatsApp (webhook stub only)
- Meta App Review / Advanced Access for production Instagram Business Login traffic
