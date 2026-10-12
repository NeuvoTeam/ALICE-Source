# GEMINI.md

This repo's agent contract lives in [`AGENTS.md`](./AGENTS.md) — read it and follow it.

The rule that matters most: **every change to code, config or the data model updates
`documentation.md` in the same commit.** §14 of that file maps a change to the section that owns
it; `npm run docs:check` (also a `commit-msg` hook and a CI job) fails a change that skips it.
`DOCS: none` in the commit message is the only opt-out.

Verify with `npx tsc --noEmit`, `npm test` and `npm run docs:check` before finishing.

## Codebase Navigation & Token Conservation (Graphify Engine)
- An offline AST knowledge graph is maintained in `graphify-out/graph.json` (1,171 nodes, 81 communities).
- MANDATORY: Before opening multi-file source directories or executing broad grep searches:
  1. Locate functions and subsystems: `graphify query "<question or feature>"`
  2. Inspect direct callers and dependencies: `graphify explain "<SymbolName>"`
  3. Trace cross-component linkage: `graphify path "<Source>" "<Target>" --undirected`
  4. Qualify duplicate functions using `<filepath>::<function>()` syntax.
- Only use `read_file` on target files once identified by the graph.