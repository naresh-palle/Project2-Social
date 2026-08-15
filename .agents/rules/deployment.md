# Deployment Workflow

When making changes to this project, you MUST ALWAYS ensure they are properly deployed so the user can test them immediately. Do not assume the user will deploy the frontend manually.

Follow `.agents/skills/post-change-workflow/SKILL.md`, `.agents/skills/deploy-render-gh-pages/SKILL.md`, and (for Flutter/APK work) `.agents/skills/flutter-app-build/SKILL.md`.

## Frontend Changes
If you modify ANY frontend code (React, CSS, HTML, JSX) in the `frontend/` directory:
1. Run `bash scripts/sync-web-to-backend.sh`, commit, and push to `main`.
2. Wait until https://project2-social.onrender.com serves the new `main.*.js` bundle.
3. Deploy GitHub Pages:
   ```bash
   cd frontend
   npm run deploy:gh-pages
   ```
   (Equivalent: `PUBLIC_URL=/Project2-Social npm run build && npx gh-pages -d build`)
4. Confirm https://naresh-palle.github.io/Project2-Social updates.

## Backend Changes
If you modify ANY backend code (FastAPI, Python, MongoDB models) in the `backend/` directory:
1. Commit and push the changes to the `main` branch.
2. Wait for Render auto-deploy (or trigger Manual Deploy if needed).
3. Verify https://project2-social.onrender.com/api is healthy.

## Mobile / APK (every app build)
If you modify ANY Flutter code in `mobile/`, or the user asks to build/share the app:
1. Follow `.agents/skills/flutter-app-build/SKILL.md`.
2. `bash mobile/scripts/build_apk.sh` then `bash mobile/scripts/share_apk.sh`.
3. Copy `cr8-studio-release.apk` into Cursor artifacts and deploy GitHub Pages so
   https://naresh-palle.github.io/Project2-Social/cr8-studio-release.apk is current.
4. Never commit `*.apk`.
