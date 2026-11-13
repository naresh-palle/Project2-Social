# What to “buy” / enable so regular users can log in (Facebook + Instagram)

**Short answer: you do not need a Meta premium / paid login license for basic Sign In.**

What blocks regular users today is **Development mode**, not a missing paid plan.

---

## Facebook — regular users (recommended path)

| Item | Needed? | Paid? |
|---|---|---|
| Meta app **Live** mode | **Yes** | **No** (free) |
| Permissions `email` + `public_profile` | **Yes** | **No** |
| Switch those permissions to **Advanced Access** (Consumer apps) | **Yes** (manual toggle after Live) | **No** |
| Privacy Policy URL on the app | **Yes** | **No** |
| Extra Facebook permissions (friends, posts, pages, ads…) | **No** for Sign In | Would need App Review |
| Meta “premium” / paid developer tier | **No** | — |

### Do this in Meta Developers

1. App **FLUGR** → add Privacy Policy URL  
2. **App Review → Permissions and features** (or Use cases): set `email` and `public_profile` to **Advanced Access**  
3. Switch app **Development → Live**  
4. Keep redirect URI:  
   `https://project2-social.onrender.com/api/oauth/facebook/callback`  
5. Keep `FACEBOOK_LOGIN_CONFIG_ID` on Render  

Then any normal Facebook account can Sign In (use Incognito to test someone other than you).

---

## Instagram — regular users

Instagram Login is stricter:

| Item | Needed? | Paid? |
|---|---|---|
| User has an Instagram **Professional** account (Creator or Business) | **Yes** (Meta rule) | Free for the user to convert |
| Meta app **Live** | **Yes** for non-testers | **No** |
| **Advanced Access** for Instagram Login permissions (e.g. `instagram_business_basic`) | **Yes** if other creators/brands (not only you) will log in | **No fee** — submit **App Review** |
| **Meta Business Verification** | Usually **Yes** for Advanced Access | **No license fee** — verify your business (docs, domain, etc.) |
| Paid Meta ads / WhatsApp conversation packs | **No** for login | Only if you buy ads/messaging later |

Personal (non-Professional) Instagram accounts **cannot** complete Instagram Business Login. That is not fixed by buying a premium plan.

### Do this when ready for public Instagram Sign In

1. Complete **Business Verification** on your Meta Business portfolio  
2. Submit **App Review** for Instagram Login / `instagram_business_basic` (and only what you use)  
3. After approval → Advanced Access  
4. App **Live**  
5. Redirect: `https://project2-social.onrender.com/api/oauth/instagram/callback`

Until App Review is approved, Instagram Sign In stays tester-only even if Facebook is public.

---

## What you should **not** buy for login

- Meta “premium developer” packages (there isn’t one required for Sign In)  
- WhatsApp Business API conversation packs (messaging, not login)  
- Boosted ads / Meta Blueprint paid courses  
- Extra permissions you do not use (slows App Review)

---

## Practical recommendation for flugr

### Phase 1 — now (free, Development)
- Stay Development  
- Add **Testers** for people who must try FB/IG  
- Test in **Incognito** so you are not stuck on your own session  

**Status:** flugr/API **ready**. Meta Testers = your console clicks.  
Runbook: `docs/meta-phase-1-2-runbook.md` · Status API: `GET /api/integrations/meta/phase-status`

### Phase 2 — public Facebook (still free)
- Live + Advanced Access on `email` / `public_profile` only  
- Goal: **any Facebook user** can Sign In  

**Status:** flugr/API **ready** (`META_OAUTH_MODE=business`, login config id, redirects, privacy URL).  
Meta **Live + Advanced Access** = your console clicks (same runbook).

### Phase 3 — public Instagram (still free process, more paperwork)
- Business Verification + App Review + Advanced Access for Instagram Login  
- Users must use **Professional** IG accounts  

Only later buy paid Meta products if you need **WhatsApp messaging at scale**, **ads**, or other commercial APIs — not for login itself.
