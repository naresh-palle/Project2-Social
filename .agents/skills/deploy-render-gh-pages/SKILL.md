---
name: deploy-render-gh-pages
description: >-
  Deploy the CR8 Studio web app: sync SPA to backend/web for Render, wait until
  the live bundle updates, then publish GitHub Pages. Use when the user asks to
  deploy, ship, or publish to Render / gh-pages.
---

# Deploy Render + GitHub Pages

## Render (primary)

1. `bash scripts/sync-web-to-backend.sh`
2. Commit `backend/web` + source changes; push to `main`.
3. Wait until https://project2-social.onrender.com serves the new `main.*.js` hash
   from `backend/web/index.html`.

## GitHub Pages (secondary)

```bash
cd frontend
PUBLIC_URL=/Project2-Social npm run build
npx gh-pages -d build
```

Or: `cd frontend && npm run deploy:gh-pages`

Pages URL: https://naresh-palle.github.io/Project2-Social

If Actions stay queued forever, clear blockers with
`bash scripts/unblock-github-pages.sh` (needs repo admin `gh`), then redeploy.
