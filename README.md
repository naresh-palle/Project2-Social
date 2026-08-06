# CR8 Studio (Project2-Social)

Influencer marketplace — brands, creators, and agents.

## Live

| Surface | URL |
| --- | --- |
| **App (primary)** | https://project2-social.onrender.com |
| API | https://project2-social.onrender.com/api |
| GitHub Pages | https://naresh-palle.github.io/Project2-Social (often stale / queued) |

Demo: `company@cr8.studio` / `creator@cr8.studio` / `demo1234`

## Why GitHub Pages stays “queued” (and Antigravity can fix it)

Pages deploys are blocked by a **zombie Actions run from 2026-07-20**:

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

Until Pages is unblocked, **use Render only**. Ship UI with:

```bash
bash scripts/sync-web-to-backend.sh
git add backend/web && git commit -m "Refresh Render SPA" && git push origin main
```

Do **not** run `npm run deploy` / push full SPA builds to `gh-pages` — that only lengthens the stuck queue. `npm run deploy` is disabled on purpose; use `npm run deploy:render`.

## Repo layout

- `backend/` — FastAPI + MongoDB (also serves `backend/web` SPA on Render)
- `frontend/` — React web client
- `mobile/` — Flutter client
- `scripts/sync-web-to-backend.sh` — build frontend → `backend/web`
- `scripts/unblock-github-pages.sh` — cancel stuck Pages Actions (needs owner `gh`)
