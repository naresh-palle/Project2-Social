# Store readiness checklist

## Android (Play Console)

- [ ] Create upload keystore; keep `android/key.properties` local (never commit)
- [ ] Set `applicationId` / version in `android/app/build.gradle(.kts)` (`studio.cr8.cr8_mobile`)
- [ ] Configure Google Sign-In SHA-1 / SHA-256 for release + debug
- [ ] Privacy policy URL (same as web Legal)
- [ ] Build: `flutter build appbundle --release --dart-define=API_BASE=https://project2-social.onrender.com/api`
- [ ] Smoke-test: login, marketplace apply, DM send, profile upload on a physical device

## iOS (App Store Connect)

- [ ] Bundle ID + Team in Xcode (`ios/Runner.xcworkspace`)
- [ ] Enable Sign in with Apple capability
- [ ] Fill usage strings already present in `Info.plist` (camera / photos / mic)
- [ ] Apple Services ID / redirect aligned with backend `/auth/apple-login`
- [ ] Build: `flutter build ipa --release`
- [ ] App Privacy nutrition labels (auth, messaging, analytics as applicable)

## Shared

- Deep link scheme: `cr8://` (messages + reset-password)
- No Product Catalog / Group Chat / Mutual Friends / Email OTP UI (parity with web exclusions)
- CI: `.github/workflows/flutter-mobile.yml` (`analyze` + `test`)
