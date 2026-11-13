# Meta (Facebook + Instagram) — clean setup from scratch

Use this if you deleted / reset apps in [Meta Developers](https://developers.facebook.com/apps/).  
**Google Sign-In is separate** (Google Cloud Console). This guide is **only Meta**.

flugr already expects these callbacks (do not invent new ones unless you tell us to change code):

| Provider | Redirect URI (exact) |
|---|---|
| Facebook | `https://project2-social.onrender.com/api/oauth/facebook/callback` |
| Instagram | `https://project2-social.onrender.com/api/oauth/instagram/callback` |

Privacy Policy for Meta forms:

`https://flugr.in/privacy-policy.html`

Website / domain:

- Website: `https://flugr.in`
- App domain: `flugr.in`

---

## Part A — Create a new Meta app

1. Open https://developers.facebook.com/apps/ → log in with your Facebook account  
2. **Create App**  
3. Use case: choose **Authenticate and request data from users with Facebook Login**  
   (or **Other** → then add Facebook Login + Instagram yourself)  
4. App type: **Business** (needed for Instagram Login)  
5. App name: `FLUGR` (or `flugr Auth`)  
6. Contact email: your email  
7. Connect a **Business portfolio** if asked (create one if you don’t have it)  
8. Create app → you land on the App Dashboard  

Copy the new **App ID** from **App settings → Basic** (you will paste it into Render later).

---

## Part B — Basic settings

**App settings → Basic**

| Field | Value |
|---|---|
| Display name | FLUGR |
| App domains | `flugr.in` |
| Privacy Policy URL | `https://flugr.in/privacy-policy.html` |
| User data deletion | `https://flugr.in/privacy-policy.html` |
| Category | Business / Entertainment (any reasonable) |

**Add platform → Website**

- Site URL: `https://flugr.in`

**Save Changes.**

Click **Show** next to **App Secret** → copy App Secret (keep private).

---

## Part C — Facebook Login (Sign In with Facebook)

### C1. Add product
1. **Add products** → **Facebook Login** → **Set up**  
2. Platform: **Web**  
3. Site URL: `https://flugr.in` (you can skip deep quickstart code)

### C2. Facebook Login settings
**Facebook Login → Settings**

| Setting | Value |
|---|---|
| Client OAuth Login | Yes |
| Web OAuth Login | Yes |
| Enforce HTTPS | Yes |
| Use Strict Mode for Redirect URIs | Yes |
| Valid OAuth Redirect URIs | `https://project2-social.onrender.com/api/oauth/facebook/callback` |

**Save Changes.**

### C3. Login configuration (required on many new apps)
If you see **Facebook Login for Business → Configurations**:

1. **Create configuration** (name: `flugr-web-login`)  
2. Permissions: **`email`** + **`public_profile`** only  
3. Save → copy **Configuration ID**  

This becomes Render `FACEBOOK_LOGIN_CONFIG_ID`.  
Without it, Meta often shows: *“This app needs at least one supported permission.”*

### C4. Development testers (Phase 1)
1. **App roles → Roles → Add people → Tester**  
2. They accept: https://developers.facebook.com/requests/  
3. Test in **Incognito**: https://flugr.in/#/login → **Facebook**

---

## Part D — Instagram Login (Sign In with Instagram)

### D1. Add product
1. **Add products** → **Instagram** → **Set up**  
2. Prefer **Instagram API with Instagram Login**  
   (not only “Instagram with Facebook Login”)

### D2. Business login + redirect
1. Instagram → API setup with Instagram login  
2. **Business login settings**  
3. OAuth redirect URI exactly:  
   `https://project2-social.onrender.com/api/oauth/instagram/callback`  
4. Save and reopen to confirm it stuck  

### D3. Instagram App ID / Secret
If the console shows a separate Instagram App ID/Secret, copy those.  
If not, use the same App ID/Secret as Facebook for both.

### D4. Permission
Add **`instagram_business_basic`** only (for Sign In).  
Do not add messaging/publishing yet.

### D5. Test account
Use a **Professional** Instagram account (Creator or Business).  
Personal IG cannot complete this login.

---

## Part E — Paste secrets into Render

Render → **project2-social** → **Environment** → Save → **Deploy**:

```text
FACEBOOK_APP_ID=<App ID from Part B>
FACEBOOK_APP_SECRET=<App Secret from Part B>
META_APP_ID=<same as FACEBOOK_APP_ID>
META_APP_SECRET=<same as FACEBOOK_APP_SECRET>
FACEBOOK_LOGIN_CONFIG_ID=<Configuration ID from Part C3>
INSTAGRAM_APP_ID=<Instagram App ID or same as Facebook>
INSTAGRAM_APP_SECRET=<Instagram App Secret or same as Facebook>
META_OAUTH_MODE=trial
FRONTEND_URL=https://flugr.in
API_PUBLIC_URL=https://project2-social.onrender.com
```

Use `META_OAUTH_MODE=trial` while testing with Testers.  
When Facebook is public/Live, set `META_OAUTH_MODE=business`.

After deploy, optional bootstrap (if env is slow to load):

```bash
curl -X POST https://project2-social.onrender.com/api/integrations/meta/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id":"<FACEBOOK_APP_ID>",
    "app_secret":"<FACEBOOK_APP_SECRET>",
    "facebook_login_config_id":"<CONFIG_ID>",
    "mode":"trial"
  }'
```

Check:

```bash
curl -s https://project2-social.onrender.com/api/integrations/meta/phase-status | jq
```

---

## Part F — Phase 2 (public Facebook later — still free)

When Testers work and you want **any** Facebook user:

1. Advanced Access for `email` + `public_profile`  
2. App toggle **Development → Live**  
3. Render: `META_OAUTH_MODE=business`  
4. Incognito test with a Facebook account that is **not** an app role  

Details: `docs/meta-phase-1-2-runbook.md`

---

## Part G — Phase 3 (public Instagram later — still free process)

1. Complete **Business Verification**  
2. **App Review** for Instagram Login / `instagram_business_basic`  
3. Advanced Access approved  
4. App **Live**  
5. Test with a non-role **Professional** IG account  

Details: `docs/meta-phase-3-instagram-public-runbook.md`

---

## Part H — Google (only if you also broke Google)

Meta reset does **not** fix Google `origin_mismatch`.  
If Google Sign-In fails, in [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

Authorized JavaScript origins must include:

- `https://flugr.in`
- `https://www.flugr.in`
- `http://localhost:3000`

Client ID flugr uses by default:

`858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com`

---

## Order checklist (clean start)

- [ ] A Create Business Meta app `FLUGR`  
- [ ] B Basic settings + Privacy Policy + Website  
- [ ] C Facebook Login + redirect + Login **Configuration ID**  
- [ ] C4 Add Testers + Incognito test  
- [ ] D Instagram Login + redirect + Professional test account  
- [ ] E Render env vars + deploy + phase-status OK  
- [ ] F (later) Live + Advanced Access for public Facebook  
- [ ] G (later) Business Verification + App Review for public Instagram  

When Part E is done, paste the new **App ID** + **Configuration ID** (not the secret in chat if possible) and we can verify the live API.
