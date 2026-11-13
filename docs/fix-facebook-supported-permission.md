# Fix: Facebook “This app needs at least one supported permission”

Screenshot error on FLUGR:

> It looks like this app isn't available  
> This app needs at least one **supported permission**.

## Cause

Newer Meta apps (especially **Facebook Login for Business** / use-case apps) no longer accept a bare `scope=email,public_profile` dialog. They require a **Login configuration** (`config_id`) that lists supported permissions.

Our API already supports this via `FACEBOOK_LOGIN_CONFIG_ID`.

## Fix in Meta Developers (5 minutes)

1. Open https://developers.facebook.com/apps/2872938923087073/
2. Left menu → **Facebook Login** or **Facebook Login for Business** → **Configurations**
3. **Create configuration** (or **Add configuration**)
   - Name: `flugr-web-login`
   - Permissions: at least **`email`** and **`public_profile`**  
     (if Meta forces an extra permission, add `pages_show_list` temporarily for trial)
4. Save → copy the **Configuration ID** (numeric string)
5. Confirm **Facebook Login → Settings → Valid OAuth Redirect URIs** includes exactly:
   `https://project2-social.onrender.com/api/oauth/facebook/callback`
6. **App roles**: your Facebook user must be Admin/Developer/Tester while in Development (trial)

## Give flugr the config id

### Option A — chat / bootstrap (fast)

Paste the Configuration ID in chat, or call:

```bash
curl -X POST https://project2-social.onrender.com/api/integrations/meta/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "2872938923087073",
    "app_secret": "<secret>",
    "facebook_login_config_id": "<CONFIG_ID>",
    "mode": "trial"
  }'
```

### Option B — Render Environment

```text
FACEBOOK_LOGIN_CONFIG_ID=<CONFIG_ID>
```

Then restart the API service.

## Verify

```bash
curl -s https://project2-social.onrender.com/api/oauth/providers | jq '.providers[] | select(.provider=="facebook")'
```

Expect `"login_config_id_set": true`.

Then Sign In → Facebook should open a normal permission dialog (not the “isn't available” screen).

## Still blocked?

- Wrong redirect URI (trailing slash mismatch)
- Logged in as a Facebook user who is **not** an app role (trial/dev mode)
- Configuration created but permissions list empty — edit config and add `email` + `public_profile`
