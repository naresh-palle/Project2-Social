# CR8 Studio iOS app

The Flutter client under `mobile/` is a **real iOS app** (same screens and Render API as Android / web). Bundle ID: `studio.cr8.mobile`. Minimum iOS: **16**.

## Install on an iPhone

Apple will not sideload an unsigned IPA the way Android sideloads an APK. Pick one:

### A) Mac + Xcode (install on your phone, free Apple ID)

1. Install [Xcode](https://developer.apple.com/xcode/) and open `mobile/ios/Runner.xcworkspace` (**workspace**, not `.xcodeproj`).
2. Signing & Capabilities → Team → your Apple ID.
3. Plug in the iPhone, trust the computer, select the device, press Run.
4. On the phone: Settings → General → VPN & Device Management → trust the developer.

```bash
cd mobile
flutter pub get
cd ios && pod install && cd ..
flutter run --release --dart-define=API_BASE=https://project2-social.onrender.com/api
```

### B) App Store / TestFlight (paid Apple Developer Program, $99/year)

1. Create App ID `studio.cr8.mobile` in [Apple Developer](https://developer.apple.com/account).
2. In Xcode set that Team + Bundle ID.
3. `bash mobile/scripts/build_ios.sh` **without** `--no-codesign`, or:

```bash
cd mobile
flutter build ipa --release --dart-define=API_BASE=https://project2-social.onrender.com/api
```

4. Upload the signed IPA via Transporter / Xcode Organizer → TestFlight.

### C) Unsigned IPA from CI (for archive / resigning)

GitHub Actions workflow `.github/workflows/flutter-ios.yml` builds `cr8-studio-release.ipa` on `macos-latest`.

Download: GitHub Actions artifact **cr8-studio-release-ipa**, or (after Pages deploy):

https://naresh-palle.github.io/Project2-Social/cr8-studio-release.ipa

This file is **unsigned**. It will not install from Safari. Use it with Xcode / a signing service, or resign with your Team.

## Google Sign-In on iOS

Create an **iOS** OAuth client in Google Cloud for bundle ID `studio.cr8.mobile`, then add its reversed client ID URL scheme in `ios/Runner/Info.plist`. The web client ID is already used as `serverClientId`.

## Demo

`creator@cr8.studio` / `demo1234`
