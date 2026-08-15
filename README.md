# CR8 Studio (Project2-Social)

Influencer marketplace — brands, creators, and agents.

## Live

| Surface | URL |
| --- | --- |
| **App (primary)** | https://project2-social.onrender.com |
| API | https://project2-social.onrender.com/api |
| GitHub Pages | https://naresh-palle.github.io/Project2-Social |
| **Android APK** | https://naresh-palle.github.io/Project2-Social/cr8-studio-release.apk |
| **Discover (brands)** | https://project2-social.onrender.com/#/discover |

Demo: `company@cr8.studio` / `creator@cr8.studio` / `demo1234`

## Deploy

```bash
# 1) Build SPA into backend/web (Render)
bash scripts/sync-web-to-backend.sh
git add -A && git commit -m "Ship web" && git push origin main
# wait until https://project2-social.onrender.com shows the new main.*.js hash

# 2) GitHub Pages
cd frontend && npm run deploy:gh-pages
```

If Pages Actions stay stuck in `queued`, clear blockers:

```bash
bash scripts/unblock-github-pages.sh
```

## Why GitHub Pages may stay “queued”

Pages can be blocked by a **zombie Actions run from 2026-07-20**:

https://github.com/naresh-palle/Project2-Social/actions/runs/29747341200

That run has sat in `queued` for hundreds of hours. Newer `pages-build-deployment` jobs wait behind it, then time out with `deployment_in_progress` / `Timeout reached, aborting!`.

| Tool | Can cancel that run? | Why |
| --- | --- | --- |
| **Antigravity / your laptop `gh`** | Yes | Logged in as repo owner with Actions write |
| **Cursor Cloud agent** | No | Uses `cursor[bot]` — Actions cancel returns **HTTP 403** |

**Unblock (run in Antigravity or locally as Naresh):**

```bash
bash scripts/unblock-github-pages.sh
```

Or open the zombie run URL above → **Cancel workflow**, then cancel any other queued “pages build and deployment” runs.

## Repo layout

- `backend/` — FastAPI + MongoDB (also serves `backend/web` SPA on Render)
- `frontend/` — React web client
- `mobile/` — Flutter client
- `scripts/sync-web-to-backend.sh` — build frontend → `backend/web`
- `scripts/unblock-github-pages.sh` — cancel stuck Pages Actions (needs owner `gh`)
- `.agents/skills/post-change-workflow/` — required agent deploy checklist
- `.agents/skills/deploy-render-gh-pages/` — Render + Pages deploy skill
- `.agents/skills/flutter-app-build/` — every mobile build: Creator Studio UI + share APK
- `mobile/scripts/build_apk.sh` — release APK, then copy to `mobile/dist/` and artifacts
