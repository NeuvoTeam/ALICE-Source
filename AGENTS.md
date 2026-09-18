# AGENTS.md — ALICE (Neuvo)

Read this first. It is the contract for **every** coding agent in this repo — Cline, Copilot,
Codex, Cursor, Gemini, Claude and any other CLI. The tool-specific files (`.clinerules`,
`.github/copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`) point here or mirror these rules;
this file is the one to keep current.

`documentation.md` is the source of truth for product behaviour, the running architecture, the
API, the data model, setup and known gaps. `ARCHITECTURE.md` owns the Java module rules. If either
disagrees with the code, the code wins — fix the document in the same change.

## Documentation is part of the change

**Every change to code, config or the data model updates `documentation.md` in the same commit.**
Not a follow-up, not a nice-to-have.

1. Open `documentation.md` §14 "Maintaining this document" and use its mapping table to find the
   section your change affects.
2. Update that section. If you closed or opened a known gap, update §13 as well.
3. Run `npm run docs:check` before you commit — the same check runs as the `commit-msg` hook and
   as the `docs-check` workflow.

A change that genuinely needs no documentation edit says so out loud with `DOCS: none` in the
commit message. That is the only opt-out, and it is a statement of intent — not a way to skip the
thinking.

## Project rules

| Rule | Detail |
| --- | --- |
| Frontend isolation | The browser never talks to Supabase. `lib/supabase.ts` is a deliberate throwing proxy — never bypass it. All browser traffic goes through the Cloudflare Worker via `CLINICAL_AI_API_BASE` (`lib/clinical-ai-api.ts`). |
| Auth | Clinician calls go through `apiFetch` (`lib/auth.ts`) so the bearer token is attached and a `401` routes to `/login`. Client-facing pages use signed, expiring links instead. |
| Case mapping | snake_case for DB rows, camelCase for app state, converted **only** in the normalisers (`normalizeSession`, `normalizeClientTree`). |
| Worker routes | `backend/CloudFlare.js` is a Web-Fetch Worker — no Express-style code (`app.use`, `req.body`, `res.status`). Declare new `POST` routes **above** the catch-all `if (method === "POST")` AI block. |
| State | `stores/useClientNavStore.ts` (Zustand) is authoritative. Ignore the unused local-only model in `lib/clinical-hierarchy.ts` / `hooks/use-clinical-workspace.ts`. |
| Session hydration | `GET /client/:id` embeds only `sessions(id,name)`, so a tree row can exist before its payload. `sessionHydratedId` plus `lib/session-hydration.ts` gate the vignette generator — see `documentation.md` §8.2 and §4.5. |
| Secrets | Never commit keys, service-role tokens or JWTs. `npx wrangler secret put` for the Worker; `.dev.vars` locally. |
| Generated code | Do not hand-edit `components/ui/*` (shadcn) or lockfiles. |
| Java | Follow `ARCHITECTURE.md`: `alice-core` is pure domain logic — zero IO, no threads, no dependencies, constructor injection only. |

## Verify before you claim done

| Command | Expectation |
| --- | --- |
| `npx tsc --noEmit` | exit 0 — `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so this is the real gate |
| `npm test` | worker, PDF and hydration suites all green |
| `npm run docs:check` | exit 0 — `documentation.md` moved with your change |

## Where the rest lives

- `.clinerules` — Cline's tool-call format plus the same project rules.
- `.github/copilot-instructions.md` — MCP gateway usage.
- `documentation.md` §14 — the authoritative "if you change X, update Y" table.
- `ARCHITECTURE.md` — Java module layering.
- `scripts/check-docs.mjs` — the enforcement described above, in plain Node.
