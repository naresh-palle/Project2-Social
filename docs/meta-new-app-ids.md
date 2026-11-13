# Current Meta App IDs (clean rebuild)

| App | App ID | Dashboard |
|---|---|---|
| Facebook Login (FLUGR) | `2872938923087073` | https://developers.facebook.com/apps/2872938923087073/ |
| Instagram Login | `2340240193463979` | https://developers.facebook.com/apps/2340240193463979/ |

Old app `1662702218853274` is retired — do not use it on Render anymore.

## Render Environment (paste + Deploy)

```text
FACEBOOK_APP_ID=2872938923087073
FACEBOOK_APP_SECRET=<from Facebook app → App settings → Basic → Show>
META_APP_ID=2872938923087073
META_APP_SECRET=<same as FACEBOOK_APP_SECRET>
FACEBOOK_LOGIN_CONFIG_ID=<from Facebook app → Login configurations>
INSTAGRAM_APP_ID=2340240193463979
INSTAGRAM_APP_SECRET=<from Instagram app → Instagram Business login settings / Basic>
META_OAUTH_MODE=trial
FRONTEND_URL=https://flugr.in
API_PUBLIC_URL=https://project2-social.onrender.com
```

## Redirect URIs (must be set in each Meta app)

**Facebook app** → Facebook Login → Settings → Valid OAuth Redirect URIs:

`https://project2-social.onrender.com/api/oauth/facebook/callback`

**Instagram app** → Instagram → Business login settings → OAuth redirect URI:

`https://project2-social.onrender.com/api/oauth/instagram/callback`

## After Deploy — verify

```bash
curl -s https://project2-social.onrender.com/api/oauth/facebook/start?mode=login | head
# Location should contain client_id=2872938923087073

curl -s https://project2-social.onrender.com/api/integrations/meta/phase-status | jq
```

Or send **App secrets** + **FACEBOOK_LOGIN_CONFIG_ID** privately / set on Render only, then ask the agent to re-check.
