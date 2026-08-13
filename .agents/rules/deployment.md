# Deployment Workflow

When making changes to this project, you MUST ALWAYS ensure they are properly deployed so the user can test them immediately. Do not assume the user will deploy the frontend manually.

## Frontend Changes
If you modify ANY frontend code (React, CSS, HTML, JSX) in the `frontend/` directory:
1. Commit and push the changes to the `main` branch.
2. **ALWAYS** build and deploy to GitHub Pages immediately by running the following command in the terminal:
   ```bash
   cd frontend
   npm run build
   npx gh-pages -d build
   ```
3. Wait for the task to complete or clearly inform the user that the `gh-pages` frontend deployment is actively running.

## Backend Changes
If you modify ANY backend code (FastAPI, Python, MongoDB models) in the `backend/` directory:
1. Commit and push the changes to the `main` branch.
2. Remind the user to click **"Manual Deploy" -> "Deploy latest commit"** in their Render dashboard to pull the latest changes, since Render doesn't trigger automatically for this setup.
