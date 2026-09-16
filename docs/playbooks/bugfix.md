# Playbook: Bugfix

## Rule Zero
Reproduce before fixing. A failing test must exist before any source edit.

## Steps
1. REPRO   → write a failing test that captures the bug. Run it. Confirm it fails.
2. CONFIRM → show the failure output. No fix yet.
3. FIX     → smallest change that makes the test pass.
4. REGRESS → run full suite.
5. VERIFY  → run `./scripts/verify.sh`

## Final step (mandatory)
Write `pr-context.txt` at repo root exactly as defined in the feature playbook, updating the Playbook field to "bugfix". Do not push without this file.