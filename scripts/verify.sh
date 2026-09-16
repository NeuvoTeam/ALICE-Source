#!/usr/bin/env bash
set -euo pipefail

FAIL=0
run() {
  echo "── $1"
  if ! eval "$2"; then
    echo "FAILED: $1"
    FAIL=1
  fi
}

# ── Config drift guard ──
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  PROTECTED="package.json package-lock.json tsconfig.json vitest.config.ts vite.config.ts eslint.config.js eslint.config.mjs playwright.config.ts .github/workflows/ supabase/config.toml"
  DRIFT=$(git diff --name-only origin/main HEAD -- $PROTECTED 2>/dev/null || true)
  if [ -n "$DRIFT" ]; then
    echo "── config drift detected (requires human approval):"
    echo "$DRIFT" | sed 's/^/     /'
    echo "FAILED: config drift"
    FAIL=1
  fi
fi

# ── Verification Steps ──
run "typecheck"   "npx tsc --noEmit"
run "eslint"      "npx eslint . --max-warnings=0"
run "prettier"    "npx prettier --check ."
run "unit tests"  "npx vitest run --coverage.enabled --coverage.thresholds.lines=80"

if [ -f "playwright.config.ts" ]; then
  run "e2e tests" "npx playwright test --retries=2"
fi

if compgen -G "schemas/*.schema.json" > /dev/null; then
  run "schema lint" "npx ajv-cli compile -s 'schemas/*.schema.json' --strict=false"
fi

run "build"       "npm run build"

echo "───────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  echo "STATUS: PASS"
  exit 0
else
  echo "STATUS: FAIL"
  exit 1
fi