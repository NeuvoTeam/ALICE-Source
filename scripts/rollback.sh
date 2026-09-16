#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:?usage: rollback.sh <task_id> [default_branch]}"
DEFAULT_BRANCH="${2:-main}"
BRANCH="ai/${TASK_ID}"

echo "Initiating rollback for: $BRANCH"

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  SHA=$(git rev-parse HEAD)
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  TAG="quarantine/${TASK_ID}-${STAMP}"
  git tag "$TAG" "$SHA" 2>/dev/null || true
  git push origin "refs/tags/$TAG" 2>/dev/null \
    || echo "Tag $TAG not pushed."
fi

git checkout "$DEFAULT_BRANCH" 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true
git push origin --delete "$BRANCH" 2>/dev/null \
  || echo "Branch $BRANCH already deleted remotely."

echo "ROLLED BACK: $BRANCH"