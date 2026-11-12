# Social auth credentials — paste list

When you have the values, send them (or set on Render). The code already calls these APIs.

## 1. Google (already partially live via GIS)

| Env | Where | Example use |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Render + `REACT_APP_GOOGLE_CLIENT_ID` | GIS button + ID-token verify |
| `GOOGLE_CLIENT_SECRET` | Render only (never frontend) | Optional redirect OAuth |

**API used**
- Frontend: Google Identity Services → credential JWT
- `POST /api/auth/google-login` `{ credential, create_if_missing: true }`
- Optional: `GET /api/oauth/google/start` → Google → `GET /api/oauth/google/callback`

**Console**
- Authorized JS origins: `https://flugr.in`, `https://naresh-palle.github.io`, localhost
- Redirect (if using code flow): `https://project2-social.onrender.com/api/oauth/google/callback`

## 2. Facebook Login

| Env | Where |
|---|---|
| `FACEBOOK_APP_ID` | Render |
| `FACEBOOK_APP_SECRET` | Render only |

**API used**
- `GET /api/oauth/facebook/start?mode=login&redirect=https://flugr.in/#/oauth/callback`
- Meta dialog → `GET /api/oauth/facebook/callback?code&state`
- Token exchange + `graph.facebook.com/me?fields=id,name,email,...` (server-side)

**Meta console**
- Valid OAuth Redirect URI: `https://project2-social.onrender.com/api/oauth/facebook/callback`
- Permissions: `email`, `public_profile`

## 3. Instagram (Business Login for Instagram — not Facebook Login)

| Env | Where |
|---|---|
| `INSTAGRAM_APP_ID` | Render |
| `INSTAGRAM_APP_SECRET` | Render only |

**API used**
- `GET /api/oauth/instagram/start?...`
- `https://www.instagram.com/oauth/authorize` (scope `instagram_business_basic`)
- `POST https://api.instagram.com/oauth/access_token` (server)
- `GET https://graph.instagram.com/me?fields=id,username,account_type,name` (server)
- Callback → SPA `https://flugr.in/#/oauth/callback?token=...`

**Meta console**
- Add **Instagram API with Instagram Login** product
- Redirect URI: `https://project2-social.onrender.com/api/oauth/instagram/callback`
- Professional IG accounts; **trial/dev** = app-role testers only. Advanced Access / App Review only when moving to **business/live**

## 4. Shared

| Env | Value |
|---|---|
| `FRONTEND_URL` | `https://flugr.in` |
| `API_PUBLIC_URL` | `https://project2-social.onrender.com` |
| `OAUTH_ENCRYPTION_KEY` | Fernet key (generate once) |

## Status endpoint

`GET /api/oauth/providers` — returns which providers are configured (no secrets).
