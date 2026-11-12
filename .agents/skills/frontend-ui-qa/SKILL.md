---
name: frontend-ui-qa
description: >-
  UI QA for flugr cream brand pages (landing, login, register, onboarding). Use
  after visual/auth UI changes or when the user shares screenshots marking
  elements to remove/keep.
---

# Frontend UI QA

## Brand tokens
- Cream `#F6F0E6`, card `#FBF7F0`, espresso `#2A201A`, bronze `#A9824A`
- Fonts: Fraunces (editorial), Inter/mono labels

## Screenshot instructions
If the user marks UI with X/circles:
1. Remove only marked controls
2. Keep unmarked flows
3. Deploy Pages and hard-refresh verify

## Signup current product rules
- Splash: **categories only** (Influencer / Company; Agent gated)
- No Instagram/Facebook buttons unless flag on
- Login may keep Google

## Checks
- `/#/register` — category doors only
- `/#/login` — cream card; social per flags
- Landing Brand/Influencer CTAs still work
