# Flutter app build

When changing anything under `mobile/`, or when the user asks to build, share,
or ship the Android app, follow `.agents/skills/flutter-app-build/SKILL.md`.

Every app build must:

1. Keep the premium Creator Studio dashboard as post-login influencer Home.
2. Run `bash mobile/scripts/build_apk.sh`.
3. Copy the APK to `/opt/cursor/artifacts/cr8-studio-release.apk` and publish
   it on GitHub Pages as `/cr8-studio-release.apk`.
4. Never commit `*.apk`.
