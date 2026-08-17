# CR8 Studio Mobile

Flutter client for the CR8 Studio marketplace. Uses the same Render API and JWT auth as the web app (`frontend/`).

## Stack

- Flutter 3.x / Dart 3
- Clean Architecture feature modules under `lib/features/*/{data,domain,presentation}`
- Riverpod + go_router + Dio + flutter_secure_storage + Hive offline cache
- Material 3 (dark editorial theme aligned with web: `#0B0B0E` / `#FF3B30`)

## Prerequisites

1. Install [Flutter stable](https://docs.flutter.dev/get-started/install) and put it on `PATH`
2. Android: Android Studio / cmdline-tools + an emulator or device (`flutter doctor`)
3. iOS: macOS + Xcode. Project under `ios/` — see [`docs/IOS_APP.md`](docs/IOS_APP.md).

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
```

## Run

Default API: `https://project2-social.onrender.com/api`

```bash
# Android / iOS / Chrome
flutter run

# Point at a local or staging backend
flutter run --dart-define=API_BASE=http://10.0.2.2:8000/api

# Google Sign-In (server/web client ID used as serverClientId)
flutter run --dart-define=GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Storage keys match web: `cr8_token`, `cr8_user`.

## Architecture

```
lib/
  core/           # theme, router, Dio ApiClient, session + Hive cache, shared widgets
  features/
    auth/         # login, register, OTP, Google, onboarding
    dashboard/    # role home + bottom nav shell
    marketplace/  # creators browse + detail
    campaigns/    # detail, apply, escrow, new campaign
    feed/         # modes, create, like/save/repost
    search/
    messages/     # list + thread (4s poll fallback for DM realtime)
    invitations/
    notifications/
    profile/      # self + public + edit/upload
    wallet/
    settings/     # privacy, 2FA, sessions, theme, export/delete
    admin/        # users, reports, broadcast (admin role)
```

## Navigation parity (web ↔ mobile)

| Web (HashRouter) | Mobile route |
| --- | --- |
| `/login` | `/login` |
| `/register/:role` | `/register/:role` |
| `/forgot-password`, `/reset-password` | same |
| `/dashboard` | `/dashboard` (tab) |
| `/feed` | `/feed` (tab) |
| `/search` | `/search` (tab) |
| `/messages`, `/messages/:id` | same |
| `/profile`, `/profile/edit` | same |
| `/marketplace`, `/creators/:id` | same |
| `/campaigns/:id`, `/campaigns/new` | same |
| `/invitations`, `/wallet`, `/settings`, `/admin` | same |
| `/u/:userId` | `/u/:userId` |
| Deep links `cr8://messages?id=` / `cr8://reset-password?token=` | go_router query/path |

Bottom nav: Dashboard · Feed · Search · Messages · Profile  
Drawer: Marketplace, Invitations, Wallet, Notifications, Settings, Admin (if admin)

## Auth / API contracts reused

- `Authorization: Bearer <JWT>`
- Roles: `owner` | `influencer` (UI: Creator) | `agent` | `admin`
- Login: `POST /auth/login`, `/auth/google-login`, mobile OTP, `/auth/mobile-register`
- Marketplace: `/creators`, `/campaigns`, apply / invite / escrow / deliverables
- Social: `/feed`, `/posts`, `/follow`, `/users/{id}/public`
- Messages: `/conversations`, `/conversations/dm` — polling every ~4s (SSE DM gap known on web)

## Offline

Hive boxes cache feed / profile / conversations. Failed posts/messages can be enqueued via `OfflineCache.enqueue` for later retry when connectivity returns.

## Release notes

### Android / Play Store

Full checklist of **what you must provide** + Console steps: [`docs/PLAY_STORE_PUBLISH.md`](docs/PLAY_STORE_PUBLISH.md)

```bash
cd mobile/android && bash scripts/create_upload_keystore.sh   # once
# edit android/key.properties with your passwords
cd .. && flutter build appbundle --release --dart-define=API_BASE=https://project2-social.onrender.com/api
# upload build/app/outputs/bundle/release/app-release.aab in Play Console
```

Application id: `studio.cr8.cr8_mobile`. Manifest includes `INTERNET` + `cr8://` deep links.

### iOS (macOS)

See [`docs/IOS_APP.md`](docs/IOS_APP.md). Bundle ID: `studio.cr8.mobile`.

```bash
bash scripts/build_ios.sh
# IPA: mobile/dist/cr8-studio-release.ipa
```

1. Open `ios/Runner.xcworkspace` in Xcode
2. Set Team + Bundle ID `studio.cr8.mobile`
3. Photo / camera / mic usage strings are in `Info.plist`

### CI

GitHub Actions: `.github/workflows/flutter-mobile.yml` (`analyze` + `test`) and `.github/workflows/flutter-ios.yml` (unsigned IPA on macOS).

## Non-goals

No new backend endpoints. Product Catalog / Group Chat / Mutual Friends / Email OTP UI stay out of scope (same as web Phase 1 exclusions). Website remains the source of truth for business rules.
