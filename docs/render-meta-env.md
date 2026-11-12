# Render env vars for Meta (FLUGR app)

## Mode: public login (business)

| Mode | Meta console | Our flag | Who can sign in with IG/FB |
|---|---|---|---|
| **business** (current) | App must be **Live** | `META_OAUTH_MODE=business` | Any Facebook user; Instagram Professional accounts |
| **trial** | App in **Development** | `META_OAUTH_MODE=trial` | App roles only (Admin / Developer / Tester) |

See `docs/meta-public-login.md` — toggle Meta **Development → Live** so regular users are not blocked.

## Paste on Render (recommended)

Render → **project2-social** → **Environment** → add/update (do **not** commit secrets to git):

```text
FACEBOOK_APP_ID=<from Meta App settings → Basic>
FACEBOOK_APP_SECRET=<Show>
META_APP_ID=<same as Facebook App ID unless separate>
META_APP_SECRET=<same as Facebook App Secret unless separate>
INSTAGRAM_APP_ID=<same unless Instagram product shows a different App ID>
INSTAGRAM_APP_SECRET=<same unless Instagram App Secret differs>
META_OAUTH_MODE=trial
FRONTEND_URL=https://flugr.in
API_PUBLIC_URL=https://project2-social.onrender.com
```

Save → **Manual Deploy** / restart so all instances reload env.

### Optional API push

If you have a Render API key:

```bash
RENDER_API_KEY=rnd_… RENDER_SERVICE_ID=srv-… bash scripts/push-render-meta-env.sh
```

## Runtime / Mongo bootstrap (already live)

Until Render env is pasted, the API loads Meta credentials from Mongo `app_config` on startup and injects empty `os.environ` slots:

- `POST /api/integrations/meta/bootstrap` `{ "app_id", "app_secret", "mode": "trial" }`
- Admin: `POST /api/admin/integrations/meta`

Shared Mongo = durable across API instances on the same database. Render env is still preferred as the source of truth.

## Meta console redirect URIs

- Facebook: `https://project2-social.onrender.com/api/oauth/facebook/callback`
- Instagram: `https://project2-social.onrender.com/api/oauth/instagram/callback`

Validated Graph check for app `1662702218853274` returns name **FLUGR**.

## Trial checklist

1. Meta app **Development** mode (not Live)
2. Add yourself + testers under **App roles**
3. Instagram testers use a **Professional** IG account
4. Keep `DISABLE_MOCK_SOCIAL` unset so mock login remains available
5. When ready for public: Live mode + App Review → set `META_OAUTH_MODE=business`

## Status

`GET /api/oauth/providers` → `meta_oauth_mode`, `runtime_meta`, `env_meta` (booleans only, no secrets).
