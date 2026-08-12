---
name: post-change-workflow
description: >-
  Use this skill whenever you have completed a change or a bug fix. It enforces a standard 
  workflow to check the code, push it to git, and deploy it to Render/gh-pages.
---

# Post-Change Workflow

Whenever a bug fix or feature change is completed, you MUST perform the following steps sequentially.

## 1. Check the Code Before Push
- Run any relevant build commands (e.g., `npm run build` or `npm run lint`).
- Ensure there are no syntax errors or unresolved warnings.
- Run tests if applicable.

## 2. Push Code to Git
- Stage the modified files: `git add <files>` (or `git add .`)
- Commit the changes with a descriptive message: `git commit -m "fix: your descriptive message"`
- Push the changes to the remote repository: `git push`

## 3. Deploy (Render / GH Pages)
- Depending on the project requirements, trigger the deployment.
- For GH Pages: `npm run deploy` (or the equivalent command for the repository).
- For Render: Verify if the push auto-triggers the deployment, or trigger it manually if required.
- Wait for the deployment to finish before marking the task as complete.
