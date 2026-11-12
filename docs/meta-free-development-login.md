# Free Development login (no Business / no paid licenses)

## What you want

- Stay on Meta **Development** (free)
- Not use only *your* Facebook / Instagram session
- Let other people try Sign In
- Go Live / Business later when product is ready

## Important Meta rule (cannot be bypassed in code)

| Meta app mode | Cost for basic Sign In | Who can finish Facebook login |
|---|---|---|
| **Development** | Free | Only people listed as **Admin / Developer / Tester** on the FLUGR app |
| **Live** | Still free for `email` + `public_profile` | Any Facebook user |

There is **no** free Development setting that opens Facebook Login to the entire public.  
“Normal public users” = Meta app **Live** (basic login permissions are free; that is **not** a premium license).

Instagram Login additionally needs a **Professional** IG account (Creator/Business). That is also a Meta rule.

## Why it always opens *your* Facebook / Instagram

The browser is already logged into **your** Meta session. OAuth reuses that cookie.

**To test as someone else (free):**

1. Open an **Incognito / Private** window, **or**
2. Log out of facebook.com and instagram.com, **or**
3. Use another browser / phone

Then open https://flugr.in/#/login → Facebook / Instagram.

## Free way to let other people sign in while staying in Development

1. Meta → [FLUGR app](https://developers.facebook.com/apps/1662702218853274/) → **App roles** → **Roles**
2. **Add Testers** (their Facebook email / name)
3. They accept: https://developers.facebook.com/requests/
4. They use **their** Facebook account (incognito if needed) on flugr Sign In

You do **not** need your personal account for every test. Add them as Testers.

## What “Business” meant in our docs (not a paid plan)

- `META_OAUTH_MODE=trial` → we treat Meta as Development / testers  
- `META_OAUTH_MODE=business` → we treat Meta as public/Live  

That flag is **not** a Meta invoice or premium license.  
Paid App Review / Advanced Access is only needed later for some Instagram/advanced permissions — not for basic free Facebook Sign In once Live.

## Recommended right now

1. Keep Meta app in **Development**
2. Keep Render: `META_OAUTH_MODE=trial`
3. Add Testers for anyone who should try login
4. Test others in Incognito
5. When product is ready: Meta **Live** (still free for basic FB login) + optional `META_OAUTH_MODE=business`

## Render env (free Development)

```text
META_OAUTH_MODE=trial
FACEBOOK_APP_ID=…
FACEBOOK_APP_SECRET=…
FACEBOOK_LOGIN_CONFIG_ID=…
INSTAGRAM_APP_ID=…
INSTAGRAM_APP_SECRET=…
```
