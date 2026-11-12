# Detailed Meta setup — Facebook Login + Instagram Login for flugr

Use this checklist while you click through [developers.facebook.com](https://developers.facebook.com/apps/).  
When finished, paste **App ID / App Secret** (and Instagram App ID/Secret if separate) back in chat.

**Our callback URLs (copy exactly, no trailing slash):**

| Provider | Redirect URI |
|---|---|
| Facebook | `https://project2-social.onrender.com/api/oauth/facebook/callback` |
| Instagram | `https://project2-social.onrender.com/api/oauth/instagram/callback` |

**Site URLs to use in settings:**

- Website: `https://flugr.in`
- Privacy Policy (required later for Live): `https://flugr.in/#/legal/privacy`  
  (or your real privacy URL if different)
- App Domains: `flugr.in` and `project2-social.onrender.com`

---

## PART 0 — Before you start

1. Use a **personal Facebook account** that can create apps.
2. Prefer a **Meta Business Portfolio** (Business Manager). You can create/connect one during app creation; for Development mode you can often continue without full Business Verification.
3. Have a **Professional Instagram account** ready for Instagram Login testing (Creator or Business). Personal IG accounts usually cannot complete Instagram Business Login.
4. Stay in **Development mode (trial)** until everything works with you as Tester/Admin.  
   Product decision: **trial now → business/Live later** when signup + onboarding are solid.  
   Do **not** submit App Review / Advanced Access / Business verification yet.  
   Only switch to **Live** + set `META_OAUTH_MODE=business` after App Review (if Meta requires it).

---

## PART 1 — Create the Meta app

1. Open: https://developers.facebook.com/apps/
2. Click **Create App** (green/blue button).
3. Meta’s wizard varies slightly. Choose one of these paths:

### Path A (newer “Use cases” UI)

1. When asked for a use case, pick something like:
   - **Authenticate and request data from users with Facebook Login**, **or**
   - **Other** (if you plan to add Instagram + Facebook Login as products yourself)
2. Click **Next**.
3. If asked for app type, choose **Business** (required for Instagram product).
4. Enter:
   - **App name:** `flugr` (or `flugr Auth`)
   - **App contact email:** your email
5. Optionally connect a Business portfolio → **Next** / **Create app**.

### Path B (classic “Add products” UI)

1. Choose app type **Business** → **Next**.
2. Enter app name + contact email → **Create app**.

You should land on the **App Dashboard**.

---

## PART 2 — Basic app settings (do this first)

Left menu → **App settings** → **Basic**

Fill:

| Field | Value |
|---|---|
| Display name | flugr |
| App domains | `flugr.in` |
| | also add `project2-social.onrender.com` if the field accepts multiple |
| Privacy Policy URL | `https://flugr.in/#/legal/privacy` |
| User data deletion | can use same privacy URL for now |
| Category | Business and pages / Entertainment (any reasonable) |

Click **Add Platform** → **Website** → Site URL:

`https://flugr.in`

**Save Changes.**

### Copy Facebook credentials (you’ll paste these to me)

Still on **App settings → Basic**:

1. Copy **App ID**
2. Click **Show** next to **App Secret** → copy **App Secret**

```text
FACEBOOK_APP_ID=...........
FACEBOOK_APP_SECRET=...........
```

> Keep the secret private. Do not commit it to GitHub.

---

## PART 3 — Add Facebook Login (for the Facebook button)

### 3.1 Add the product

1. Left menu → **Add products** / Dashboard **Add product**
2. Find **Facebook Login**
3. Click **Set up**
4. If asked platform, choose **Web**
5. Quickstart Site URL: `https://flugr.in` → you can skip deep Quickstart code (our backend does OAuth)

### 3.2 Facebook Login settings (critical)

Left menu → **Facebook Login** → **Settings**

Set:

| Setting | Value |
|---|---|
| Client OAuth Login | **Yes** |
| Web OAuth Login | **Yes** |
| Enforce HTTPS | **Yes** |
| Embedded Browser OAuth Login | Yes (optional) |
| Use Strict Mode for Redirect URIs | **Yes** |
| Valid OAuth Redirect URIs | `https://project2-social.onrender.com/api/oauth/facebook/callback` |
| Allowed Domains for JavaScript SDK (if shown) | `https://flugr.in` |

Click **Save Changes**.

### 3.3 Permissions + Login configuration (CRITICAL)

We only need:

- `public_profile` (required)
- `email` (required for flugr account email)

**If you see “This app needs at least one supported permission”:**

Newer Meta apps need a **Login configuration**:

1. **Facebook Login for Business → Configurations → Create**
2. Add permissions `email` + `public_profile`
3. Copy **Configuration ID**
4. Set on API: `FACEBOOK_LOGIN_CONFIG_ID=<id>` (Render) or pass `facebook_login_config_id` to `/api/integrations/meta/bootstrap`

Full steps: `docs/fix-facebook-supported-permission.md`

Also:

- **Use cases** → Facebook Login use case → customize → add `email`, **or**
- **App Review** → **Permissions and features** → ensure `email` is available for testing

In **Development mode (trial)**, Admin/Developer/Tester accounts can log in without full App Review.

### 3.4 Add yourself as a tester (Development mode)

1. Left menu → **App roles** → **Roles**
2. Ensure your Facebook user is **Administrator** or **Developer**
3. Optionally add Testers
4. Testers must accept the invite at https://developers.facebook.com/requests/

---

## PART 4 — Add Instagram Login (separate from Facebook Login)

Instagram login for flugr uses **Instagram credentials** via **Business Login for Instagram**.  
Do **not** assume Facebook Login alone covers Instagram sign-in.

### 4.1 Add Instagram product

1. Dashboard → **Add products**
2. Find **Instagram**
3. Click **Set up**

You should see something like:

**Instagram → API setup with Instagram login**

(If you only see “Instagram API with Facebook Login”, that is the *other* product. Prefer **API setup with Instagram login**.)

### 4.2 Business type requirement

If Meta blocks adding Instagram:

- App type must be **Business**
- You may need to connect a **Business portfolio** under App settings → Basic

### 4.3 Set up Instagram business login + redirect URI

1. Open **Instagram → API setup with Instagram login**
2. Find section like **3. Set up Instagram business login** (numbering may differ)
3. Click **Set up** or **Business login settings**
4. Add **OAuth redirect URI** exactly:

`https://project2-social.onrender.com/api/oauth/instagram/callback`

5. Save
6. Re-open settings and **verify the URI is still listed** (Meta sometimes adds/removes a trailing slash — if Meta saved with `/` at the end, tell me and we’ll match it in code)

### 4.4 Copy Instagram App ID / Secret

In **Business login settings** you should see:

- **Instagram App ID**
- **Instagram App Secret** (or “Show”)

These are often **different** from the Facebook App ID/Secret.

```text
INSTAGRAM_APP_ID=...........
INSTAGRAM_APP_SECRET=...........
```

If the console only shows one App ID/Secret pair, paste the same values into both Facebook and Instagram fields and note that.

### 4.5 Permissions / scopes we use

flugr requests:

- `instagram_business_basic`

In the Instagram setup / permissions UI, add at least **instagram_business_basic** for testing.

### 4.6 Link a test Instagram professional account

1. In Instagram API setup, **Add Instagram account** / generate tokens section
2. Log in with a **Professional** Instagram account
3. Grant permissions
4. That account (and app Admin/Dev users) can test while the app is in Development mode

---

## PART 5 — Common screens that confuse people

### “I don’t see Valid OAuth Redirect URIs”

- For Facebook: must be under **Facebook Login → Settings** (not App settings → Basic)
- For Instagram: under **Instagram → API setup with Instagram login → Business login settings**

### “Create App asks for Business verification”

- You can often **skip / continue in Development**
- Full Business Verification is needed before broad Live access / some Advanced permissions

### “Instagram product missing”

- App type must be **Business**
- Use **Other** use case during creation if Facebook Login-only use case hides Instagram

### “Login works only for me”

- Expected in **Development mode**
- Add Testers, or later submit **App Review** and switch app to **Live**

### “URL Blocked: redirect_uri is not allow-listed”

- Redirect URI mismatch (http vs https, trailing slash, wrong host)
- Must be the **Render API** callback, not `https://flugr.in/...`
- Our SPA receives the session afterwards at `https://flugr.in/#/oauth/callback` automatically

### Privacy Policy URL required

- Add any public privacy page before going Live
- `https://flugr.in/#/legal/privacy` is fine if that route exists

---

## PART 6 — What to send me when done

Paste this block:

```text
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# optional notes:
# App mode: Development / Live
# Instagram redirect saved with trailing slash? yes/no
# Business portfolio connected? yes/no
```

Also confirm Google if you want it refreshed:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

I will then set these on the Render API environment and verify:

- `GET https://project2-social.onrender.com/api/oauth/providers`
- Sign-in buttons for Facebook / Instagram on https://flugr.in/#/login

---

## PART 7 — What you do NOT need to build

You do **not** need Meta’s JS SDK quickstart code, sample PHP, or mobile SDKs.  
flugr already implements:

- `GET /api/oauth/facebook/start` → Meta → `/api/oauth/facebook/callback`
- `GET /api/oauth/instagram/start` → Instagram → `/api/oauth/instagram/callback`
- Frontend landing: `/#/oauth/callback`
