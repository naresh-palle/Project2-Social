# Dev machine setup (Flutter)

## This Cursor Cloud agent (already done)

Flutter **3.47.0** + Android SDK are installed and on `PATH` via `~/.bashrc`.

In a **new** terminal:

```bash
cd mobile
flutter doctor
flutter build apk --release --dart-define=API_BASE=https://project2-social.onrender.com/api
# or:
bash scripts/build_apk.sh
```

Prebuilt binaries (when available):

- Android APK: https://naresh-palle.github.io/Project2-Social/cr8-studio-release.apk
- iOS IPA: https://naresh-palle.github.io/Project2-Social/cr8-studio-release.ipa — see [`IOS_APP.md`](IOS_APP.md) (Apple will not sideload like Android)
- After a local Android build: `mobile/dist/cr8-studio-release.apk`
- After a local iOS build (Mac): `mobile/dist/cr8-studio-release.ipa`

Every app build must follow `.agents/skills/flutter-app-build/SKILL.md` (premium Creator Studio Home + share the APK).

## Your own Windows PC (local Cursor terminal)

Cloud agents cannot install software on your laptop. Run **once** in PowerShell:

```powershell
cd mobile\scripts
Set-ExecutionPolicy -Scope Process Bypass
.\install_flutter_windows.ps1
```

Then install [Android Studio](https://developer.android.com/studio), open SDK Manager, install Android SDK + cmdline-tools. **Restart Cursor**, then:

```bash
flutter doctor
cd mobile
flutter pub get
bash scripts/build_apk.sh
```

## macOS / Linux (local)

```bash
# https://docs.flutter.dev/get-started/install
git clone https://github.com/flutter/flutter.git -b stable $HOME/flutter
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.bashrc   # or ~/.zshrc
source ~/.bashrc
flutter doctor
```

Install Android Studio / Xcode as prompted by `flutter doctor`.
