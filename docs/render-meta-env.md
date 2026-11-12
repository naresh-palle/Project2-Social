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

## Runtime bootstrap (when Render env is still empty)

Until Render env is set, the API can load Meta credentials from Mongo:

- `POST /api/integrations/meta/bootstrap` with `{ "app_id", "app_secret" }` (Graph-validated)
- or admin `POST /api/admin/integrations/meta` (Bearer admin JWT)

Credentials are applied in-process and reloaded on API startup from `app_config`.
Prefer Render env for multi-instance durability.

Meta console redirect URIs:

- Facebook: `https://project2-social.onrender.com/api/oauth/facebook/callback`
- Instagram: `https://project2-social.onrender.com/api/oauth/instagram/callback`

Validated Graph check (client credentials) for app `1662702218853274` returns name **FLUGR**.

Mock user bootstrap (until full OAuth redirects are live):

`POST /api/auth/mock-social-login`

Disable later with `DISABLE_MOCK_SOCIAL=1`.

UI: category register (`/#/register/influencer` or `/#/register/owner`) shows Instagram + Facebook + Google via `forceMeta`. Sign-in keeps Meta hidden until `META_SOCIAL_BUTTONS_ENABLED` is flipped.
