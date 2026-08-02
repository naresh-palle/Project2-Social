# Mobile QA report — Aug 2026

## Issues found (senior QA)

| ID | Severity | Area | Issue |
| --- | --- | --- | --- |
| M1 | Critical | Landing / Login / Register | **Hero background not visible** on phones — desktop-style left veil + heavy dim painted the photo nearly solid black; image also not `Positioned.fill`. |
| M2 | Critical | Navigation | **Back does nothing useful** — Landing used `context.go('/login')` / `go('/register')`, which **clears the stack**, so `canPop()` is false and Android system back exits the app instead of returning. |
| M3 | High | Login / Register | In-app back arrow used `canPop ? pop : go('/')` but stack was empty after `go`, so behaviour felt broken / inconsistent with system back. |
| M4 | Medium | Login | `dim: 0.7` made the studio photo even darker behind the login card. |
| M5 | Medium | Forgot / Register forms | Missing consistent back + `PopScope` for Android back. |

## Fixes shipped

| ID | Fix |
| --- | --- |
| M1 | Rewrote `StudioBackdrop` for **mobile portrait**: lighter bottom/left veils, `Positioned.fill` hero, earlier fade-in, visible glow orbs. |
| M2 | Landing **Sign In / Join Studio** now use `context.push(...)` so history exists. |
| M3 | Added `cr8Back()` + `Cr8BackButton`; Login/Register/Forgot wrap with `PopScope` so UI back **and** Android back return to the previous screen (fallback `/` or `/login`). |
| M4 | Login/register backdrop `dim` reduced (~0.32–0.4). |
| M5 | Forgot password + register role screens use the same back pattern. |

## Verify on device

1. Uninstall old APK → install `mobile/dist/cr8-studio-release.apk` (v1.0.1+2).
2. Open app → landing shows **photo background** + animations.
3. Tap Sign In → back arrow **and** Android back return to landing.
4. Join Studio → pick role → back returns to role picker → back to landing.

## Still out of scope / watch

- Full web landing marquee / multi-slide marketing (mobile keeps a focused auth shell).
- Apple Sign In on Android requires extra Apple service config; button may show “unavailable” without it.
- Google Sign In needs SHA-1 of the debug/release keystore registered in Google Cloud.
