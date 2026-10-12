# ALICE

ALICE is an AI-assisted clinical workspace for mental-health clinicians, plus a read-only
client-facing surface that presents the materials a clinician has assigned. Clinicians work
through a three-level hierarchy — client, case, session — and a three-phase AI workflow:
label session notes, get an analysis (formulation + risk flags), then generate a practice
package of scenario, homework and quiz. Each phase transition persists to the session and
appends a version row, so prior content is recoverable. The client surface needs no login; it
is reachable only through a signed, expiring link.

The repository holds the Next.js App Router frontend (TypeScript, React 19, Tailwind v4,
shadcn/ui), the Cloudflare Worker API (`backend/CloudFlare.js`), a second Cloudflare Worker
that exposes the same capability over MCP (`workers/mcp-gateway/`), and a Java multi-module
skeleton that is currently empty. Supabase provides auth and Postgres.

## Run it locally

    npm install
    npm run dev        # Next.js dev server on http://localhost:3000

Local prerequisites and the Worker, gateway and database setup are in `documentation.md` §10.

## Gates that exist today

    npm test           # worker + PDF + hydration harnesses (plain node)
    npm run lint       # ESLint 9 flat config
    npx tsc --noEmit   # type check (the production build ignores type errors)
    npm run build      # production build

## Documentation

`documentation.md` is the canonical, code-verified reference: what the product is, the runtime
tiers, the full HTTP API, the data model, local setup and the guardrails. `debug_reports/`
holds the evidence trail behind that document and the repo's changes.
