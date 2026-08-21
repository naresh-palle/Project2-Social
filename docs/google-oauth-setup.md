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

### Authorized JavaScript origins

Add **exact** origins (no path, no trailing slash):

- `http://localhost:3000`
- `https://project2-social.onrender.com`
- `https://naresh-palle.github.io`

### Authorized redirect URIs

For GIS popup / credential button these are usually not required, but if you enable
redirect UX also add:

- `http://localhost:3000`
- `https://project2-social.onrender.com`
- `https://naresh-palle.github.io/Project2-Social`

## Symptom: Error 400 origin_mismatch

Browser console:

```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

or Google page:

```
Access blocked: Authorization Error — Error 400: origin_mismatch
```

**Fix:** add the current site origin to Authorized JavaScript origins, wait 1–5 minutes, hard-refresh.

## Notes

- Sign-in only works for emails already registered (backend returns 404 otherwise and the
  app routes the user to registration with Google profile prefill).
- Support roles are unrelated; Google is for end-user accounts.
- Frontend and backend client IDs **must** be identical or token verification fails with
  `Invalid Google sign-in token`.
