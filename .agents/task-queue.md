# Agent task queue (session living doc)

| ID | Status | Task | Evidence / blocker |
|---|---|---|---|
| T1 | COMPLETED | Cream auth UI / sign-in restyle | Deployed Pages earlier |
| T2 | COMPLETED | Social auth + onboarding system (code) | Shipped; mock user validated |
| T3 | COMPLETED | Hide public Agent signup | `PUBLIC_AGENT_ENABLED=false` |
| T4 | COMPLETED | Hide Instagram/Facebook on splash + login | `META_SOCIAL_BUTTONS_ENABLED=false`; splash categories-only |
| T5 | COMPLETED | Signup splash = categories only | RegisterSplash doors only |
| T6 | COMPLETED | Meta App ID/Secret validate + mock user | Graph FLUGR ok; user `mock.fb.flugr001@gmail.com` |
| T7 | COMPLETED | Facebook/Instagram OAuth server config | Runtime bootstrap → `/api/oauth/providers` facebook+instagram `configured:true` |
| T8 | COMPLETED | Task-queue + dev/test skills | `.agents/skills/*` added |
| T9 | COMPLETED | Category register = IG/FB/Google + username + mobile only | Live bundle `main.961e0f41.js`; `/auth/username-mobile-register` 422 on empty body |
| T10 | COMPLETED | WhatsApp webhook stub | `GET/POST /api/webhooks/whatsapp` (verify 403 without token) |
| T11 | BLOCKED | Render dashboard env paste (human) | Runtime Meta covers current instance; paste `FACEBOOK_APP_*` on Render for multi-instance |
| T12 | BLOCKED | WhatsApp Cloud tokens on Render | Webhook code live; needs `WHATSAPP_VERIFY_TOKEN` + access token / phone id |

## Overview

### Completed
- Splash stays categories-only (no social)
- Category register restores Instagram, Facebook, Google + username + mobile only
- Backend `POST /api/auth/username-mobile-register`
- Meta credentials bootstrapped on API (`runtime_meta: true`)
- WhatsApp webhook verify/receive stub + docs

### Not completed / blocked
- Human: paste Meta secrets into Render Environment (durability across restarts/instances — Mongo runtime reload helps on startup)
- Human: set WhatsApp verify/access/phone env vars in Meta + Render
- Meta App Review / Advanced Access for production Instagram Business Login traffic
- WhatsApp outbound messaging / OTP via WhatsApp
