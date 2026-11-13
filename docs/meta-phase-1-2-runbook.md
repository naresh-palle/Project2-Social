# Meta Phase 1 + Phase 2 — completion runbook

Goal from `docs/meta-what-to-buy-for-public-login.md`:

| Phase | Goal | flugr/API | Meta Developers (you) |
|---|---|---|---|
| **1** | Free Development testing with people other than you | Ready | Add Testers + test Incognito |
| **2** | Any Facebook user can Sign In | Ready (`META_OAUTH_MODE=business`, config id, redirects) | Advanced Access + **Live** |

Instagram public login = **Phase 3** (later): Business Verification + App Review.

---

## Already done on flugr / Render (do not redo)

- [x] Facebook + Instagram buttons on Sign In  
- [x] OAuth start/callback on API  
- [x] `FACEBOOK_APP_ID` / `SECRET` (+ Meta / Instagram twins) on Render  
- [x] `FACEBOOK_LOGIN_CONFIG_ID` on Render (fixes “supported permission”)  
- [x] `META_OAUTH_MODE=business` on Render (Phase 2 API posture)  
- [x] Redirect URIs used by code:  
  - Facebook: `https://project2-social.onrender.com/api/oauth/facebook/callback`  
  - Instagram: `https://project2-social.onrender.com/api/oauth/instagram/callback`  
- [x] Privacy Policy page live:  
  - SPA: `https://flugr.in/#/legal/privacy`  
  - **Use this for Meta (static, crawlable):** `https://flugr.in/privacy-policy.html`  
- [x] App website in Graph: `https://flugr.in/` (FLUGR)

Verify anytime:

```bash
curl -s https://project2-social.onrender.com/api/integrations/meta/phase-status | jq
```

---

## Phase 1 — Meta console (Development testers) — ~5 min

Open: https://developers.facebook.com/apps/2872938923087073/

1. Confirm top toggle can stay **Development** while you add testers (or leave Live if you already flipped for Phase 2).  
2. Left menu → **App roles** → **Roles** → **Add people** → role **Tester**.  
3. Add each person’s Facebook name/email.  
4. They must accept: https://developers.facebook.com/requests/  
5. Tester opens **Incognito** → https://flugr.in/#/login → **Facebook** (and Instagram if Professional IG).  

**Phase 1 done when:** a Tester who is not you can finish Facebook login in Incognito.

---

## Phase 2 — Meta console (public Facebook) — ~10 min

Same app: https://developers.facebook.com/apps/2872938923087073/

1. **App settings → Basic**  
   - Privacy Policy URL: `https://flugr.in/privacy-policy.html`  
   - User data deletion URL: same or `https://flugr.in/#/legal/privacy`  
   - App domains: `flugr.in`  
   - Save  
2. **Facebook Login → Settings**  
   - Client OAuth Login: Yes  
   - Web OAuth Login: Yes  
   - Valid OAuth Redirect URIs includes exactly:  
     `https://project2-social.onrender.com/api/oauth/facebook/callback`  
   - Save  
3. **Use cases** / **App Review → Permissions and features**  
   - For `email` and `public_profile` → **Request advanced access** / **Increase access** (wording varies)  
   - Do **not** add extra permissions for Sign In  
4. Top bar: switch **Development → Live**  
5. Confirm Login configuration (`FACEBOOK_LOGIN_CONFIG_ID`) still lists `email` + `public_profile`  

**Phase 2 done when:** Incognito + a Facebook account that is **not** an app role can complete Sign In on https://flugr.in/#/login.

---

## After you finish Meta clicks

1. Keep Render `META_OAUTH_MODE=business`  
2. Hard-refresh flugr Sign In  
3. Optional: tell the agent “Phase 2 Meta Live is on” so we can re-verify  

---

## Not in Phase 1–2

- Instagram public Advanced Access / App Review → **Phase 3**  
  See `docs/meta-phase-3-instagram-public-runbook.md`  
- WhatsApp paid messaging → not required for login  
