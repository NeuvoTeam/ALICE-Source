# Playbook: Feature

## Steps (stateless — one Cline task per step)
1. PLAN      → list files to create/edit. Max 3 files. > 3 → ESCALATE.
2. TYPES     → write TS types / interfaces first.
3. IMPL      → implement against the types.
4. TESTS     → unit tests for each new branch of logic.
5. VERIFY    → run `./scripts/verify.sh`

## Final step (mandatory)
Write `pr-context.txt` at repo root. Contents, in order, max 4000 chars:
  Task: <ClickUp task ID>
  Playbook: feature
  Summary: <one paragraph>
  Files: <git diff --stat output>
  Verify: exit <n> from ./scripts/verify.sh

No HTML, code fences, or @-mentions. Do not push without this file.