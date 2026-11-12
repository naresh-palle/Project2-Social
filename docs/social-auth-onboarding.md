# CR8 Social Auth, Verification & Profile Completion

## Business rule

**Successful authentication ≠ completed registration.**

Users must complete mandatory profile fields and verify email + mobile before full dashboard access. Until then they may browse **Campaigns** and use **Complete Profile**.

## Providers

| Provider | Flow | Notes |
|---|---|---|
| Google | GIS ID-token (`POST /api/auth/google-login`) + optional auth-code | Creates incomplete account when missing |
| Facebook | OAuth 2.0 code + state (`/api/oauth/facebook/*`) | Needs `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` |
| Instagram | **Business Login for Instagram** (`instagram.com/oauth`, `instagram_business_basic`) | Not Facebook Login. Needs professional IG account; App Review/Advanced Access often pending |

## OAuth redirect URIs to register

- `{API_PUBLIC_URL}/api/oauth/google/callback`
- `{API_PUBLIC_URL}/api/oauth/facebook/callback`
- `{API_PUBLIC_URL}/api/oauth/instagram/callback`

Frontend landing: `https://flugr.in/#/oauth/callback`

## Onboarding statuses

`REGISTERED` · `EMAIL_PENDING` · `MOBILE_PENDING` · `PROFILE_INCOMPLETE` · `VERIFICATION_PENDING` · `COMPLETED` · `SUSPENDED`

Discrete flags: `email_verified`, `mobile_verified`, `onboarding_completed`, `registration_method`, `auth_providers[]`.

## Restricted mode

Incomplete users:

- Nav: Campaigns · Complete Profile · Logout
- Direct `/dashboard` → redirected to campaigns
- `POST /api/campaigns/{id}/apply` → `403 ONBOARDING_INCOMPLETE`

## Existing users

Completed `onboarding_status` accounts are grandfathered: missing verify flags are set on next `/auth/me` so access is not lost.

## Env vars

See `backend/.env.example` (Google / Facebook / Instagram / FRONTEND_URL / API_PUBLIC_URL / OAUTH_ENCRYPTION_KEY).
