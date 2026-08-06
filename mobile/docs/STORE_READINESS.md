# Store readiness checklist

## Android (Play Console)

See **[PLAY_STORE_PUBLISH.md](PLAY_STORE_PUBLISH.md)** for the full “what to provide” list and upload steps.

- [ ] Play Console developer account (\$25)
- [ ] Create upload keystore: `bash android/scripts/create_upload_keystore.sh`
- [ ] Fill `android/key.properties` (never commit; template: `key.properties.example`)
- [ ] Store listing assets (icon 512, feature 1024×500, ≥2 screenshots, descriptions, privacy URL)
- [ ] Add release SHA-1 / SHA-256 to Google Sign-In OAuth client
- [ ] `flutter build appbundle --release --dart-define=API_BASE=https://project2-social.onrender.com/api`
- [ ] Upload `.aab` → Internal testing → Production
- [ ] Smoke-test: login, marketplace apply, DM send, profile upload on a physical device

## iOS (App Store Connect)

- [ ] Bundle ID + Team in Xcode (`ios/Runner.xcworkspace`)
- [ ] Fill usage strings already present in `Info.plist` (camera / photos / mic)
- [ ] Build: `flutter build ipa --release`
- [ ] App Privacy nutrition labels (auth, messaging, analytics as applicable)

## Shared

- Deep link scheme: `cr8://` (messages + reset-password)
- No Product Catalog / Group Chat / Mutual Friends / Email OTP UI (parity with web exclusions)
- CI: `.github/workflows/flutter-mobile.yml` (`analyze` + `test`)
