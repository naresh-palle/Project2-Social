---
name: post-change-workflow
description: >-
  Use this skill whenever you have completed a change or a bug fix. It enforces a
  standard workflow: check code, push to git, deploy Render (wait until live),
  then deploy GitHub Pages.
---

# Post-Change Workflow

Whenever a bug fix or feature change is completed, you MUST perform the following
steps **in order**. Do not mark the task complete until all steps finish.

## 1. Check the Code Before Push

- Run the relevant build (`bash scripts/sync-web-to-backend.sh` or `cd frontend && npm run build`).
- Ensure there are no syntax errors or unresolved build failures.
- Run tests if applicable.

## 2. Push Code to Git

- Stage changes: `git add <files>` (or `git add .`)
- Commit with a descriptive message: `git commit -m "fix: …"`
- Push the feature branch: `git push -u origin <branch>`
- Merge (or fast-forward) into `main` and push `main` so Render can pick it up:
  - `git checkout main && git pull origin main`
  - `git merge <branch> && git push origin main`

Render serves the SPA from `backend/web`. After frontend changes, always run
`bash scripts/sync-web-to-backend.sh` and commit the updated `backend/web` artifacts
before pushing `main`.

## 3. Deploy Render — Wait Until Complete

- Pushing `main` with updated `backend/web` triggers Render auto-deploy.
- Poll the live site until the new bundle hash appears in the HTML, e.g.:

```bash
curl -s "https://project2-social.onrender.com/" | grep -oE 'main\.[a-z0-9]+\.js' | head -1
```

- Compare against the hash in `backend/web/index.html`. Only continue once they match.
- Primary live URL: https://project2-social.onrender.com

## 4. Deploy GitHub Pages

- From `frontend/`:

```bash
cd frontend
PUBLIC_URL=/Project2-Social npm run build
npx gh-pages -d build
```

- Confirm the Pages Action succeeds (`pages-build-deployment`) and
  https://naresh-palle.github.io/Project2-Social loads.
- If Pages is stuck in a queued zombie run, run `bash scripts/unblock-github-pages.sh`
  from a machine with Actions write access, then retry the `gh-pages` deploy.

## 5. npm helpers

| Script | Purpose |
| --- | --- |
| `npm run deploy:render` (in `frontend/`) | Build + sync into `backend/web` for Render |
| `npm run deploy:gh-pages` (in `frontend/`) | Build with `PUBLIC_URL=/Project2-Social` and publish `gh-pages` |
| `npm run deploy` | Runs Render sync then GH Pages publish |

Do not skip Render wait or GH Pages when the user asks for a full deploy.
