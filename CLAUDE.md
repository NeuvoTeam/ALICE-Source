# CLAUDE.md

This repo's agent contract lives in [`AGENTS.md`](./AGENTS.md) — read it and follow it.

The rule that matters most: **every change to code, config or the data model updates
`documentation.md` in the same commit.** §14 of that file maps a change to the section that owns
it; `npm run docs:check` (also a `commit-msg` hook and a CI job) fails a change that skips it.
`DOCS: none` in the commit message is the only opt-out.

Verify with `npx tsc --noEmit`, `npm test` and `npm run docs:check` before finishing.
