---
name: task-queue-completion
description: >-
  Enforce task queue, completion verification, and end-of-work overview. Use on
  every multi-step request, when the user sends a follow-up while work is in
  progress, when they ask what is done/not done, or when confirming a prior task
  finished. Keep follow-ups queued until the active task is verified complete.
---

# Task Queue + Completion Verification

## Goal

Never mark work done until it is **verified**. If the user sends another request
while a task is running, **queue it** and finish the active task first. When the
queue is empty, report **Completed** vs **Not completed**.

## Required behavior (every run)

1. **Track tasks** with TodoWrite (or update `.agents/task-queue.md`):
   - `ACTIVE` — currently executing
   - `QUEUED` — received while ACTIVE was in progress
   - `COMPLETED` — verified done
   - `BLOCKED` — cannot finish (missing credentials, deploy access, etc.)
2. **One ACTIVE task at a time.** New user prompts during ACTIVE → append as QUEUED; do not abandon ACTIVE unless the user explicitly says to cancel/switch.
3. **Definition of Done (verify before COMPLETED):**
   - Code changed and builds (frontend `npm run build` and/or backend syntax as relevant)
   - Committed + pushed when shipping was implied
   - Deployed when shipping was implied (Pages / Render as applicable)
   - Live or API check proves the change (curl, screenshot, Graph/API response)
   - If the user asked “is this completed?”, re-check evidence — do not assume
4. **After ACTIVE is COMPLETED**, immediately start the next QUEUED item.
5. **When queue is empty** (or user asks for status), output the overview below.

## Queue protocol for mid-flight prompts

When a new message arrives while work is unfinished:

```text
Queued: <short title of new request>
Finishing active: <current task>
```

Then continue ACTIVE → verify → mark COMPLETED → start next QUEUED.

## Completion overview template (mandatory at end of batch)

```markdown
## Work overview

### Completed
- [x] <task> — evidence: <build/deploy/API/screenshot>

### Not completed / blocked
- [ ] <task> — reason: <missing env / waiting on user / failed check>

### Still queued
- [ ] <task> (if any)
```

Be honest. If mock user / OAuth / deploy was only partially done earlier, list it under **Not completed** until re-verified.

## Anti-patterns

- Saying “done” after code edit without build/deploy/live check when those were required
- Dropping a queued user request after finishing the previous one
- Marking Meta/OAuth complete when credentials were validated but env not set on Render or buttons still hidden by design
