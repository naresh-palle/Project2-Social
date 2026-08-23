# AGENTS.md

## Cursor Cloud specific instructions

CR8 Studio (a.k.a. "flugr" / Project2-Social) is an influencer marketplace. The
primary product is the **web app**: a FastAPI + MongoDB backend and a React
(Create React App via craco) frontend. There is also a Flutter `mobile/` client
(secondary — see notes at the bottom).

### Services (local dev)

| Service | Location | Run command | Port |
| --- | --- | --- | --- |
| MongoDB | system pkg `mongodb-org` (v8) | `mongod --dbpath /workspace/.mongo/data --bind_ip 127.0.0.1 --port 27017` | 27017 |
| Backend API | `backend/` | `python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload` | 8000 |
| Frontend | `frontend/` | `BROWSER=none yarn start` | 3000 |

Start them in that order (Mongo → backend → frontend). There is **no systemd** in
this VM, so `mongod` must be started manually (the update script does not start
services). A convenient local data/log dir is `/workspace/.mongo/` (gitignored).

### Environment files

- `backend/.env` and `frontend/.env` are gitignored and must exist for local dev.
  Templates: `backend/.env.example`. Minimal working values:
  - `backend/.env`: `MONGO_URL=mongodb://localhost:27017`, `DB_NAME=cr8_social`,
    `JWT_SECRET=dev-local-secret`, `CORS_ORIGINS=*`.
  - `frontend/.env`: `REACT_APP_BACKEND_URL=http://localhost:8000` (the frontend
    otherwise defaults to the live Render URL, so this is required to hit local backend).
- `DB_NAME` must match between `seed.py`, `server.py`, and `.env`. Both code
  defaults are `cr8_social`; the `.env.example` value `cr8` is stale — use `cr8_social`.

### Non-obvious gotchas

- `backend/server.py` imports `cryptography` (Fernet) at module top level, but
  `cryptography` is **not** in `backend/requirements.txt`. The update script
  installs it explicitly; if you recreate deps by hand, add `cryptography`.
- Test deps (`pytest`, `pytest-xdist`, `requests`) are also not in
  `requirements.txt`; the update script installs them.
- pip installs to `~/.local` (user site). `uvicorn`/`pytest` land in
  `~/.local/bin` which is not on `PATH` — invoke via `python3 -m uvicorn` /
  `python3 -m pytest`.
- The backend **self-seeds** demo/support data on startup. A harmless
  `E11000 duplicate key` warning for `mock_comms` appears on repeat startups —
  ignore it.
- Login API expects `{"identifier": ..., "password": ...}` (not `email`) and
  returns the JWT under the key `token` (not `access_token`).

### Demo logins (from `backend/seed.py`; run `python3 backend/seed.py` to (re)seed)

- Brand/owner: `zomato@cr8.studio` / `company123`
- Influencer: `arjun@cr8.studio` / `creator123`
- Admin: `admin@cr8.studio` / `admin123`

### Lint / test / build

- Backend unit tests (no Mongo needed): `cd backend && python3 -m pytest tests/test_invoice_engine.py tests/test_otp_utils.py tests/test_social_audit.py tests/test_discovery_engine.py tests/test_social_analytics.py tests/test_mock_user_details.py`
  (`pytest.ini` pins `-n 2 --dist loadscope`; do not change `addopts`).
- `backend/tests/backend_test.py` and `backend/tests/test_iteration2_features.py`
  are **end-to-end** suites that hit a running server via `REACT_APP_BACKEND_URL`
  and assume a specific seeded dataset (emails like `studio@cr8.studio`,
  `lena@cr8.studio`) that `seed.py` does not create — they are not part of the
  quick local unit run.
- Frontend lint: there is no standalone ESLint config or `lint` npm script —
  ESLint runs through the craco/react-scripts build (`yarn start` / `yarn build`)
  and reports `react-hooks` warnings.
- Frontend build: `yarn build` (or `bash scripts/sync-web-to-backend.sh` to build
  into `backend/web` for Render). Use dev (`yarn start`) for development.

### Deploy

Deploy/publish steps (Render + GitHub Pages) are documented in the README and
`.agents/skills/post-change-workflow/SKILL.md`. Do not run deploys as part of
routine dev.

### Mobile (Flutter) — secondary

The `mobile/` Flutter client is **not** set up by the standard update script: it
requires the Flutter SDK + Android SDK, which are not preinstalled in this VM
(despite what `mobile/docs/DEV_SETUP.md` implies). Install per that doc only if a
task specifically needs the mobile app; every mobile build must follow
`.agents/skills/flutter-app-build/SKILL.md`.
