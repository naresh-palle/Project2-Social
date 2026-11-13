# Phase 3 — Public Instagram Sign In (step-by-step)

**Goal:** Creators/brands who are **not** FLUGR app Testers can Sign In with Instagram on https://flugr.in/#/login.

**Cost:** No Meta “premium login” purchase. You need **Business Verification** + **App Review** (free process, paperwork/time).

**Prerequisite:** Phase 2 Facebook path should be done (app can be **Live**; Privacy Policy set).  
flugr API is already ready for Instagram OAuth.

---

## What Meta requires (read once)

| Requirement | Why |
|---|---|
| Instagram **Professional** account (Creator or Business) | Personal IG accounts cannot complete Instagram Business Login |
| App **Live** | Non-role users blocked in Development |
| Permission e.g. `instagram_business_basic` at **Advanced Access** | Needed for public (other people’s) IG accounts |
| **App Review** | Meta must approve Advanced Access |
| **Business Verification** | Usually required before Advanced Access is granted |
| Exact redirect URI | Must match flugr callback |

flugr redirect (do not change):

`https://project2-social.onrender.com/api/oauth/instagram/callback`

Privacy Policy (for Meta forms):

`https://flugr.in/privacy-policy.html`

---

## Step 0 — Confirm flugr side (already done)

```bash
curl -s https://project2-social.onrender.com/api/integrations/meta/phase-status | jq .phase_3_public_instagram,.redirects.instagram
```

Expect Instagram auth ready and redirect as above.  
Render should still have `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (or same as Facebook if Meta shows one pair).

---

## Step 1 — Instagram product on FLUGR app

Open: https://developers.facebook.com/apps/1662702218853274/

1. **Add products** → **Instagram** → Set up  
2. Prefer **Instagram API setup with Instagram Login**  
   (not only “Instagram API with Facebook Login”)  
3. If Meta asks for app type: **Business** + connect a **Business portfolio**

---

## Step 2 — Instagram Business Login settings

1. Instagram → **API setup with Instagram login**  
2. **Business login settings** / OAuth redirect URIs  
3. Add exactly:

   `https://project2-social.onrender.com/api/oauth/instagram/callback`

4. Save, reopen, confirm it stayed (watch trailing slash)  
5. Copy **Instagram App ID** / **Instagram App Secret** if shown separately → keep on Render as `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`

---

## Step 3 — Permission for Sign In only

1. In Instagram use case / permissions, ensure **`instagram_business_basic`** (or the Login permission Meta lists for Instagram Login)  
2. Do **not** add messaging, insights, content publishing, etc. unless you need them later (extra review)  
3. flugr only requests `instagram_business_basic` in code today

---

## Step 4 — Meta Business Verification

1. Go to **Meta Business Suite** / Business Settings for the portfolio linked to FLUGR  
2. **Business info** / **Security center** → **Start verification**  
3. Submit legal name, address, phone/website, and docs Meta asks for (varies by country)  
4. Wait until status is **Verified**

Without this, Advanced Access for Instagram often stays blocked.

---

## Step 5 — App Review for Instagram Login

1. FLUGR app → **App Review** → **Requests** (or Permissions and features → Request advanced access)  
2. Request **Advanced Access** for Instagram Login / `instagram_business_basic`  
3. Provide:
   - Clear explanation: “Users Sign In to flugr with Instagram to create/login their creator or brand account.”  
   - Screencast: open https://flugr.in/#/login → click **Instagram** → authorize → land back on flugr  
   - Test instructions + a **Tester** account reviewers can use if required  
   - Privacy Policy: `https://flugr.in/privacy-policy.html`  
4. Submit and wait for Meta decision (often days to a few weeks)

---

## Step 6 — After approval

1. Confirm permission shows **Advanced Access**  
2. Confirm app mode is **Live**  
3. Keep Render:
   ```text
   META_OAUTH_MODE=business
   INSTAGRAM_APP_ID=…
   INSTAGRAM_APP_SECRET=…
   ```
4. Test in **Incognito** with a **Professional** Instagram account that is **not** an app Admin

**Phase 3 done when:** that non-role Professional IG account finishes Sign In on flugr.

---

## Step 7 — Tell users (product copy)

On Instagram Sign In, users with a personal IG must:

**Profile → Settings → Account type and tools → Switch to Professional account**  
(Creator or Business), then try again.

---

## Common failures

| Symptom | Fix |
|---|---|
| Works only for you / Testers | Advanced Access not approved, or app still Development |
| “Unsupported” / login dies for personal IG | Account must be Professional |
| Redirect error | Redirect URI mismatch (slash / wrong host) |
| App Review rejected | Screencast unclear, asked for unused permissions, Privacy Policy missing |
| Stuck on Business Verification | Incomplete docs / name mismatch with legal entity |

---

## Out of scope for Phase 3

- WhatsApp messaging packs  
- Ads / premium Meta products  
- Extra IG permissions (comments, DMs, publishing) — separate reviews later  

---

## After you finish

Message: “Phase 3 App Review approved” — we can re-check  
`GET /api/integrations/meta/phase-status` and a live Instagram Sign In smoke test.
