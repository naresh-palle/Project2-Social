---
name: flutter-app-build
description: >-
  Required for every Flutter/Android app build of CR8 Studio. Enforces the
  premium Creator Studio dashboard after login, builds a release APK, and
  copies it to Cursor artifacts plus GitHub Pages so the user can download
  and install it locally. Use whenever building the mobile app, sharing an
  APK, changing the post-login dashboard, or shipping mobile UI.
---

# Flutter app build (every time)

Use this skill for **every** CR8 Studio mobile/app build. Do not ship a
Flutter change without a shareable APK.

## 1. Post-login creator Home (do not regress)

After login, influencers land on `/dashboard` with `CreatorStudioView`
(`mobile/lib/features/dashboard/presentation/widgets/creator_studio.dart`).

Required Home layout:

- Greeting + display name + menu
- Earnings hero (INR) with 7D / 30D / 90D
- Four KPI tiles (Reach, Engagement, Campaigns, Rating)
- 7-day trend sparkline
- Recent activity
- Quick actions (Campaigns, Analytics, Messages, Wallet)
- Bottom nav: **Home · Campaigns · Analytics · Messages · Profile**

Admin / brand / agent keep their own consoles. Feed and Search stay in the
drawer, not the bottom nav.

Signed-in users hitting `/`, `/login`, or `/register` redirect to `/dashboard`.

Match **GitHub Actions Flutter `stable`** (see `.github/workflows/flutter-mobile.yml`).
CI runs `flutter analyze --no-fatal-infos`, so **errors fail the deploy**:

- `ThemeData.cardTheme` must be `CardThemeData` (not `CardTheme`)
- Prefer `withValues(alpha: …)`, `WidgetStateProperty`, and `WidgetState`
- Do not commit `mobile/pubspec.lock` produced by an older local SDK (e.g. 3.24)

## 2. Build the release APK

```bash
bash mobile/scripts/build_apk.sh
```

Default API: `https://project2-social.onrender.com/api`.

The script copies the APK to:

| Location | Purpose |
| --- | --- |
| `mobile/dist/cr8-studio-release.apk` | Local copy in the repo workspace |
| `/opt/cursor/artifacts/cr8-studio-release.apk` | Cursor download (cloud runs) |
| `frontend/public/cr8-studio-release.apk` | Included on the next GitHub Pages deploy |

Never commit `*.apk` (gitignored). Always share the file via artifacts + Pages.

## 3. Publish a copy the user can download

After the APK exists:

```bash
bash mobile/scripts/share_apk.sh
cd frontend && npm run deploy:gh-pages
```

Download URL:

https://naresh-palle.github.io/Project2-Social/cr8-studio-release.apk

Tell the user that URL **and** the Cursor artifact path so they can copy the
app locally without rebuilding.

## 4. Local copy (user machine)

```bash
git pull origin main
cd mobile
bash scripts/build_apk.sh
# APK: mobile/dist/cr8-studio-release.apk
```

Or download the Pages APK and sideload it on Android (allow unknown sources).

Demo login: `creator@cr8.studio` / `demo1234`
