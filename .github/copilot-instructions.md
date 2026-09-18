This project uses ALICE MCP Gateway.

Always refer to:
https://alice-mcp.neuvoteam.workers.dev/context

Do not guess database schema.
Use defined tools when interacting with backend.
Follow system structure and constraints.

Documentation rule: any change to code, config or the data model must update documentation.md in
the same commit — use its §14 table to pick the section. AGENTS.md holds the full contract, and
`npm run docs:check` enforces it (also a commit-msg hook and the docs-check workflow). Say
"DOCS: none" in the commit message only if the change genuinely needs no doc edit.