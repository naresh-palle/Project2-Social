# Google Sign-In (GIS) setup

flugr uses Google Identity Services (`@react-oauth/google`) with ID-token verification
against `POST /api/auth/google-login`.

## Client ID

Frontend (`frontend/src/index.js`):

```
REACT_APP_GOOGLE_CLIENT_ID=<oauth-web-client-id>
```

Backend (`GOOGLE_CLIENT_ID` env, same value):

```
GOOGLE_CLIENT_ID=<oauth-web-client-id>
```

Default shared client ID (must match on both sides):

`858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com`

## Required Google Cloud Console settings

Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
→ OAuth 2.0 Client ID (Web application) for the ID above.

### Authorized JavaScript origins (CRITICAL)

Add **exact** origins (no path, no trailing slash):

| Origin | Why |
|---|---|
| `https://flugr.in` | **Production site — missing this causes Error 400: origin_mismatch** |
| `https://www.flugr.in` | If www redirects or is used |
| `http://localhost:3000` | Local dev |
| `https://project2-social.onrender.com` | API host if GIS is ever served there |
| `https://naresh-palle.github.io` | Legacy Pages host |

### Authorized redirect URIs

For GIS popup these are usually not required. For backend redirect OAuth also add:

- `https://project2-social.onrender.com/api/oauth/google/callback`
- `http://localhost:3000`

## Symptom: Error 400 origin_mismatch

```
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy.
Error 400: origin_mismatch
```

**Cause:** you are on `https://flugr.in` but that origin is not listed on the OAuth Web client.

**Fix (developer only — Google Console):**

1. Open the Web client `858111971322-uf792cb63b4u97u1fu494kngaajuaibr…`
2. Under **Authorized JavaScript origins** → **Add URI** → `https://flugr.in`
3. Save
4. Wait 1–5 minutes, hard-refresh https://flugr.in/#/login

This agent cannot edit Google Cloud Console for you.

## Notes

- Frontend and backend client IDs **must** be identical or token verification fails.
- Support roles are unrelated; Google is for end-user accounts.
