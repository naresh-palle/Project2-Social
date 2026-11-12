---
name: task-queue-completion
description: >-
  Enforce task queue, completion verification, and end-of-work overview. Use on
  every multi-step request, when the user sends a follow-up while work is in
  progress, when they ask what is done/not done, or when confirming a prior task
  finished.
---

# Task Queue + Completion Verification

See also: `.agents/skills/task-queue-completion/SKILL.md` (canonical copy).

## Rules
1. Track ACTIVE / QUEUED / COMPLETED / BLOCKED
2. Mid-flight prompts → queue; finish ACTIVE first
3. Verify (build/deploy/live API) before COMPLETED
4. Drain queue in order
5. End with Completed vs Not completed overview
