# Play Store publish guide — CR8 Studio

Your website stays on GitHub Pages. The Android app is published on **Google Play**.

## What you must provide (checklist)

### 1. Accounts & identity
| Item | Notes |
| --- | --- |
| Google Play Console account | [play.google.com/console](https://play.google.com/console) — **\$25 one-time** |
| Developer name / org | Shown on the store listing |
| Contact email + phone | Required by Play for the listing |

### 2. Signing key (one-time, keep forever)
| Item | Notes |
| --- | --- |
| Upload keystore (`.jks`) | Created on your machine — **never commit / never lose** |
| `key.properties` | Local passwords file — already gitignored |

Generate on your PC (needs Java `keytool`):

```bash
cd mobile/android
bash scripts/create_upload_keystore.sh
# edit key.properties with the passwords you typed
```

Back up `upload-keystore.jks` + passwords in a password manager / secure drive.

### 3. Store listing assets (you create these)
| Asset | Spec |
| --- | --- |
| App name | e.g. **CR8 Studio** (30 chars max) |
| Short description | ≤ 80 characters |
| Full description | ≤ 4000 characters |
| App icon | 512×512 PNG |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | ≥ 2 (recommended 1080×1920) |
| Optional tablet / 7" / 10" screenshots | Helps ranking |
| Privacy policy URL | Use your live Legal page, e.g. `https://naresh-palle.github.io/Project2-Social/#/legal/privacy` |
| Category | e.g. Social / Business |
| Content rating | Complete IARC questionnaire in Play Console |

### 4. Google Sign-In (if you keep Google login)
In [Google Cloud Console](https://console.cloud.google.com/) → your OAuth client:
1. Get release fingerprints:
   ```bash
   keytool -list -v -keystore mobile/android/upload-keystore.jks -alias cr8upload
   ```
2. Add **SHA-1** and **SHA-256** to the Android OAuth client (package `studio.cr8.cr8_mobile`).
3. Keep using the same web/server client ID you already use for the website (`GOOGLE_CLIENT_ID` dart-define).

### 5. App package identity (already set in repo)
- Application ID: `studio.cr8.cr8_mobile`
- Version: from `mobile/pubspec.yaml` (`1.0.0+1` → name `1.0.0`, code `1`)

Bump before each store upload, e.g. `1.0.1+2`.

---

## Build the file you upload

```bash
cd mobile
flutter pub get
flutter build appbundle --release \
  --dart-define=API_BASE=https://project2-social.onrender.com/api \
  --dart-define=GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Output:
`mobile/build/app/outputs/bundle/release/app-release.aab`

Optional APK for direct install / testers (not for Play upload):
```bash
flutter build apk --release --dart-define=API_BASE=https://project2-social.onrender.com/api
# → build/app/outputs/flutter-apk/app-release.apk
```

---

## Play Console steps (downloadable for users)

1. **Create app** → App name CR8 Studio → Free → declare it’s not a game.
2. Fill **Store listing** with the assets above.
3. Complete **Content rating**, **Target audience**, **Data safety** (auth, messages, photos).
4. **App integrity / Play App Signing** — accept Google-managed signing (recommended).
5. **Production** (or start with **Internal testing**):
   - Create a release → upload `app-release.aab` → review → roll out.
6. After Google reviews and you publish, anyone can install from:
   `https://play.google.com/store/apps/details?id=studio.cr8.cr8_mobile`

Internal testing link is available sooner (add Gmail testers) before full public release.

---

## What you do **not** need for Play Store

- GitHub Pages (web only)
- An Apple Developer account (that’s iOS only)
- A new backend — keep using Render

## Security reminders

- Never commit `android/key.properties` or `*.jks` / `*.keystore`
- If you lose the upload key, recovery requires Play Console support + a new upload key request
- Templates: `android/key.properties.example`, script: `android/scripts/create_upload_keystore.sh`
