# Render env vars for Meta (FLUGR app)

Set these on Render → project2-social → Environment (do **not** commit secrets to git):

```text
FACEBOOK_APP_ID=1662702218853274
FACEBOOK_APP_SECRET=<from Meta App settings → Basic → Show>
META_APP_ID=1662702218853274
META_APP_SECRET=<same as Facebook secret unless Instagram shows a separate one>
INSTAGRAM_APP_ID=1662702218853274
INSTAGRAM_APP_SECRET=<same unless Instagram App Secret differs>
FRONTEND_URL=https://flugr.in
API_PUBLIC_URL=https://project2-social.onrender.com
```

Meta console redirect URIs:

- Facebook: `https://project2-social.onrender.com/api/oauth/facebook/callback`
- Instagram: `https://project2-social.onrender.com/api/oauth/instagram/callback`

Validated Graph check (client credentials) for app `1662702218853274` returns name **FLUGR**.

Mock user bootstrap (until full OAuth redirects are live):

`POST /api/auth/mock-social-login`

Disable later with `DISABLE_MOCK_SOCIAL=1`.
