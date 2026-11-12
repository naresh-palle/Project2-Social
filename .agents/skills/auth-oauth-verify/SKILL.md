---
name: auth-oauth-verify
description: >-
  Validate Google / Facebook / Instagram auth setup for flugr. Use when the user
  provides Meta/Google credentials, asks for mock social users, OAuth redirects,
  or provider status. Never commit secrets to git.
---

# Auth & OAuth Verification

## Secrets handling
- Store in Render env / local `backend/.env` (gitignored) only
- Never commit App Secrets
- Prefer user paste → validate → document Render keys in `docs/render-meta-env.md` without secret values in git when possible

## Meta credential check
```bash
curl -sS "https://graph.facebook.com/oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&grant_type=client_credentials"
curl -sS "https://graph.facebook.com/v21.0/APP_ID?fields=id,name&access_token=APP_ID|TOKEN_PART"
```

## Mock social user (bootstrap)
`POST https://project2-social.onrender.com/api/auth/mock-social-login`  
Body: provider, app_id, app_secret, name, email (real domain e.g. gmail.com), role, provider_user_id

Expect:
- `meta_credentials: ok`
- `restricted_mode: true` for incomplete profiles
- Campaign apply → `403 ONBOARDING_INCOMPLETE`

## Live provider status
`GET /api/oauth/providers` — Facebook/Instagram `configured: true` only after Render env is set.

## Redirect URIs (Meta console)
- Facebook: `https://project2-social.onrender.com/api/oauth/facebook/callback`
- Instagram: `https://project2-social.onrender.com/api/oauth/instagram/callback`

## UI flags
Instagram/Facebook buttons require `META_SOCIAL_BUTTONS_ENABLED=true` in `frontend/src/lib/features.js`.
