# CR8 — PRD

## Original problem statement
> Create a website named CR8, where we are bridge between The Owners and the Influencers.

User then requested a full-depth Phase-1 marketplace layered on the award-worthy editorial UI (Awwwards Site-of-the-Day level, framer-motion, lenis, masked hero, manifesto, editorial marquee, kinetic wordmark).

## Stack
- **Frontend**: React (CRA + Craco), Tailwind, framer-motion, lenis, react-fast-marquee, shadcn/ui, sonner, lucide-react
- **Backend**: FastAPI + Motor (MongoDB async)
- **Auth**: JWT (bcrypt), Bearer token in `localStorage` under `cr8_token`
- **AI**: Emergent Universal LLM Key → `anthropic / claude-sonnet-4-6` via `emergentintegrations`

## User personas
- **Owner** — brand/house/studio funding culture. Posts briefs, invites creators, funds escrow, reviews deliverables.
- **Influencer / Creator** — editor/voice. Pitches briefs, accepts invitations, submits deliverables, receives payout.
- **Admin** — moderates the register. Verifies users, removes campaigns.

## Design language
- Editorial dark canvas (`#0A0A0A`) + paper section (`#F4F4F0`) + vermilion accent (`#FF3B30`)
- Playfair Display (editorial), Manrope (UI), JetBrains Mono (mono meta)
- Film-grain overlay, hairline dividers, spotlight photography, chapter numbers, kinetic wordmark, one editorial marquee, lenis smooth scroll, framer-motion masked-line hero reveal, parallax hero image.

## Implemented (Dec 2025)
- **Landing** — kinetic masked hero, editorial marquee, 4 numbered manifesto chapters, hover-split Owners/Influencers, bento featured grid, stats ledger, closing CTA
- **Auth** — register with role selector (Owner/Creator), login, JWT-based session, seeded admin + demo users (`studio@`, `lena@`, `kai@`, `nova@`)
- **Marketplace** — creators grid + campaign list with niche filter, search, tabbed view
- **Creator detail** — hero portrait, bio, stats, rate card, portfolio grid, reviews, Owner-side actions: Invite modal + AI Match Score + Message
- **Campaign detail** — brief header with escrow status; Owner: applications list · accept · fund escrow · release · deliverable review · **AI Top-5 ranked matches** with quick-invite; Creator: pitch form · deliverable submission; both-side: post-completion 5-star review
- **New Campaign (Owner)** — full form + AI Brand Copilot (Claude Sonnet 4.6) + **cover image upload**
- **Profile Editor** — role-aware fields, niches/platforms pills, **avatar & portfolio uploads** (drag files → local storage), rate card
- **Messages** — conversation list + threaded chat per (campaign, creator), **real-time SSE stream** (5s polling replaced)
- **Invitations** — Owner sees extended, Creator can accept / decline / counter
- **Wallet (mocked)** — giant editorial balance, deposit/withdraw/escrow, transactions ledger
- **Admin console** — users list + verify, campaigns list + delete
- **Analytics** — 6-tile snapshot on Owner AND Creator dashboards (live briefs, escrow held, paid, applications, ratings, etc.)
- **Email notifications** — Resend (Emergent-managed) fires on: new application, application accepted, invitation created, invitation acted on
- **File uploads** — `/api/uploads` (jpeg/png/webp/gif ≤ 8MB) stored in `/app/backend/uploads`, served back via `/api/uploads/{id}`
- **RBAC + tests** — 64/64 backend tests pass (49 regression + 15 new)

## What's NOT built (deferred)
- **Stripe payments** — Emergent-provisioned sandbox refused country IN. Wallet remains mocked. To enable: user must be in a Stripe-supported country OR volunteer their own key.
- Real-time WebSockets (SSE is used instead)
- Cloud/S3 storage for uploads (currently on-disk in `/app/backend/uploads` — persists in pod, lost on hard restart if not in /app)
- Push notifications (email only)
- Mobile apps

## Backlog (P0 → P2)
- **P0** — Stripe live payments (replace mocked wallet), Resend transactional email (invite/accept/apply notifications), image uploads to object storage
- **P1** — Real-time messaging (SSE or websocket), notifications center, analytics charts on Owner dashboard, saved-search for creators, campaign duplicate & templates
- **P2** — OAuth (Google + Apple), 2FA, mobile web app polish, translations, dispute resolution flow, contract PDF generation

## Env / integrations
- `MONGO_URL`, `DB_NAME` — Mongo
- `JWT_SECRET` — token secret
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — seed admin (idempotent password reset on startup)
- `EMERGENT_LLM_KEY` — for AI (Claude Sonnet 4.6)

## Testing
- 49/49 backend tests passing (`/app/backend/tests/backend_test.py`)
- Frontend smoke-tested via Playwright screenshots on all key pages (landing, marketplace, dashboard, wallet, messages, new campaign + AI panel)

## Credentials (see `/app/memory/test_credentials.md`)
- Admin: `admin@cr8.studio / admin123`
- Owner: `studio@cr8.studio / demo1234` (wallet seeded to $25,000)
- Creators: `lena@`, `kai@`, `nova@` — all `demo1234`
