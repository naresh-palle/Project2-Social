# Why Facebook only works for FLUGR accounts (not regular users)

## What you are seeing

Clicking **Facebook** on Sign In opens Meta correctly, but **only Facebook users who are roles on the FLUGR app** can finish login (Admin / Developer / Tester). A normal public Facebook account is rejected or never gets a usable permission dialog.

This is **not** a flugr.in routing bug. Our button sends everyone to the same OAuth URL. **Meta Development (trial) mode** blocks the rest.

## Current flugr setting

- API: `META_OAUTH_MODE=trial`
- Meta console: keep app in **Development** until you intentionally go public

## Options

### A) Stay in trial (recommended until signup flow is solid)

1. Meta → **App roles** → **Roles**
2. Add each person who must test as **Tester** (or Developer)
3. They must accept the invite: https://developers.facebook.com/requests/
4. They sign in to Facebook with **that** account, then use flugr Sign In → Facebook

### B) Allow regular / public Facebook users

1. Meta app dashboard → switch app from **Development** to **Live**
2. Ensure Login configuration still has `email` + `public_profile`
3. Redirect URI still exactly:  
   `https://project2-social.onrender.com/api/oauth/facebook/callback`
4. On Render set `META_OAUTH_MODE=business` (updates our UI notice)
5. Privacy Policy URL must be set on the Meta app (required for Live)

`email` / `public_profile` usually have **Standard access** and do not need full App Review for basic Sign In. Instagram Business Login often still needs Advanced Access later.

## “Facebook Login for Business” vs regular users

We use a **Login configuration id** (`FACEBOOK_LOGIN_CONFIG_ID`) so Meta stops showing “supported permission”. That configuration can still authenticate normal users **once the app is Live**. While Development, Meta still limits who can complete the dialog to app roles.
