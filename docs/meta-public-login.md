# Public Facebook + Instagram sign-in (every user)

flugr Sign In is built for **any** Facebook / Instagram account.  
Meta still has one console switch that only you can flip:

## Required in Meta Developers (FLUGR app)

1. Open https://developers.facebook.com/apps/1662702218853274/
2. Top bar: switch **Development → Live**
3. Confirm:
   - Privacy Policy URL set (e.g. `https://flugr.in/#/legal/privacy`)
   - Facebook Login redirect:  
     `https://project2-social.onrender.com/api/oauth/facebook/callback`
   - Login configuration includes `email` + `public_profile`
   - Instagram redirect:  
     `https://project2-social.onrender.com/api/oauth/instagram/callback`
4. You do **not** need to use your personal Facebook as the only login — once Live, any Facebook user can authorize FLUGR.

## Render

```text
META_OAUTH_MODE=business
FACEBOOK_LOGIN_CONFIG_ID=<already set>
```

## Instagram note

Instagram **Login** still requires the person to use a **Professional** Instagram account (Creator/Business). Personal IG accounts cannot complete Instagram Business Login — that is a Meta rule, not a flugr limit. Facebook Login works with normal Facebook accounts when the app is Live.

## Verify

```bash
curl -s https://project2-social.onrender.com/api/oauth/providers | jq .meta_oauth_mode
# expect: "business"
```
