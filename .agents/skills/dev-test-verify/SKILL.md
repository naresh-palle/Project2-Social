---
name: dev-test-verify
description: >-
  Development and testing verification for flugr/CR8. Use when implementing
  features, fixing bugs, or before marking any coding task complete. Covers
  frontend build, backend syntax/API smoke tests, and regression checks.
---

# Development & Testing Verification

## Before COMPLETED

### Frontend
1. `cd frontend && npm run build` must succeed
2. Touch affected routes on https://flugr.in (HashRouter) after Pages deploy
3. Cream brand consistency: `#F6F0E6` / `#2A201A` / `#A9824A` when UI work

### Backend
1. `python3 -m py_compile backend/server.py` (and changed modules)
2. Smoke critical APIs on https://project2-social.onrender.com:
   - `GET /api/oauth/providers`
   - `GET /api/auth/me` (with token when auth changed)
   - Feature-specific POST/GET that the task touched
3. Unit tests when present: `backend/tests/test_onboarding_gate.py` etc.

### Feature flags (do not regress silently)
- `PUBLIC_AGENT_ENABLED` — Agent signup hidden unless true
- `META_SOCIAL_BUTTONS_ENABLED` — Instagram/Facebook buttons hidden unless true

### Ship path
Follow `post-change-workflow` + `deploy-render-gh-pages` when user expects live updates.

## Test matrix (pick what applies)

| Area | Minimum check |
|---|---|
| Auth/login | Login page loads; Google button present if intended |
| Signup | Category doors only (unless social re-enabled) |
| Onboarding | Incomplete user → restricted_mode / campaigns path |
| Campaigns apply | Incomplete → 403 ONBOARDING_INCOMPLETE |
| Admin | Users list still loads for admin token |
| Landing | Brand/Influencer CTAs; no public Agent door |

## Output

After verification, update the task-queue overview (**Completed** / **Not completed**).
