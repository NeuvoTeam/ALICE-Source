# ALICE — System Documentation

> Canonical, code-verified reference for the ALICE platform (`NeuvoTeam/ALICE-Source`):
> what the product is, how the runtime tiers talk to each other, the full HTTP API, the
> data model the code depends on, local setup, and the guardrails that must not be broken.
>
> Companion documents — do **not** duplicate their content here:
>
> - `ARCHITECTURE.md` — authoritative Java module layering rules.
> - `.github/copilot-instructions.md` — rules for AI agents using the ALICE MCP Gateway.
>
> Every path in this document is relative to the repository root. All API behaviour below
> was read out of `backend/CloudFlare.js` and `workers/mcp-gateway/src/index.ts`.

## Table of contents

1. [What ALICE is](#1-what-alice-is)
2. [Repository map](#2-repository-map)
3. [Runtime architecture](#3-runtime-architecture)
4. [End-to-end flows](#4-end-to-end-flows)
5. [HTTP API reference](#5-http-api-reference)
6. [Data model](#6-data-model)
7. [AI layer](#7-ai-layer)
8. [Frontend state, routing & storage](#8-frontend-state-routing--storage)
9. [MCP gateway](#9-mcp-gateway)
10. [Local development & deployment](#10-local-development--deployment)
11. [Conventions & guardrails](#11-conventions--guardrails)
12. [Java module skeleton](#12-java-module-skeleton)
13. [Known gaps & open items](#13-known-gaps--open-items)
14. [Maintaining this document](#14-maintaining-this-document)

---

## 1. What ALICE is

ALICE is an AI-assisted clinical workspace for mental-health clinicians, plus a read-only
client-facing surface that presents the materials a clinician has assigned.

**Domain model** — a strict three-level hierarchy, per clinician:

```
Client  ──▶  Case (case formulation)  ──▶  Session
   │                    │                      │
   │                    │                      ├─ session notes (free text)
   │                    │                      ├─ analysis      (AI formulation + risk flags)
   │                    │                      ├─ vignette      (AI scenario text)
   │                    │                      ├─ homework      (AI task list)
   │                    │                      ├─ quiz          (AI questions)
   │                    │                      ├─ practice_package (scenario/quiz/homework bundle)
   │                    │                      └─ modality      (e.g. cbt / dbt / act)
   │                    │
   │                    └─ named formulation, e.g. "Intake & assessment", "Case 1"
   └─ name + contact details (first/middle/last name, email, country code, phone)
```

**Two views** (`app/dashboard/page.tsx`, toggled in `components/dashboard-sidebar.tsx`):

| View | Component | Purpose |
| --- | --- | --- |
| Clinician (`viewMode="clinician"`) | `components/main-content.tsx` → `components/vignette-generator.tsx` | Run the 3-phase AI workflow, manage the client/case/session tree, review history |
| Client (`viewMode="client"`) | `components/client-view.tsx` | Read assigned materials and submit worksheet reflections |

**Clinician AI workflow** (3 phases, `components/vignette-generator.tsx`):

1. **Phase 1 — input.** Paste/label session notes.
2. **Phase 2 — analysis.** `POST /analyze/session` → `{ rationale, inferredModality, riskFlags[] }`.
3. **Phase 3 — materials.** `POST /generate/practice-package` → `{ homework[], scenario{...}, quiz[...] }`,
   rendered as a worksheet that can be exported to PDF (jsPDF + html2canvas).

Every phase transition persists to the current session, and each save also appends a row to
`session_versions` so prior content is recoverable.

**What is in the repository today:** the Next.js clinician app, the Cloudflare Worker API, a
separate Cloudflare Worker that exposes the same capability over MCP, and an **empty** Java
multi-module skeleton reserved for the domain/engine/runtime layers (see §12).

---

## 2. Repository map

### Frontend (Next.js App Router)

| Path | Contents |
| --- | --- |
| `app/` | Routes and layouts. `layout.tsx` sets `ALICE` metadata + Geist fonts; `app/globals.css` holds the Tailwind v4 theme; `app/global-error.tsx` is the root error boundary |
| `app/dashboard/page.tsx` | Authenticated shell — client landing → sidebar + clinician/client view |
| `app/login`, `app/signup`, `app/forgot-password` | Clinician auth screens (inline styles, not shadcn) |
| `app/client-login`, `app/test-auth` | Stubs / diagnostics (see §13) |
| `app/homework/[sessionId]`, `app/practice/[sessionId]` | Public, unauthenticated client-facing material views |
| `app/cases/[caseId]/sessions/[sessionId]` | Bookmark-compat redirect shim — selects the session in the store then `router.replace('/')` |
| `app/api/analyze/session/route.ts` | **Legacy/dev-only** Next.js route calling a local Ollama instance. Not used by the shipped UI (see §7) |
| `components/` | Feature components: `ClientLanding`, `main-content`, `vignette-generator`, `client-view`, `dashboard-sidebar`, `auth-guard`, `logout-button`, `session-history-panel`, `theme-provider`, plus `components/sidebar/*` (the client→case→session tree) |
| `components/ui/` | Generated shadcn/ui primitives (new-york style). Treat as vendored — regenerate rather than hand-edit |
| `hooks/` | `use-clinical-workspace.ts` (local-only workspace — see §8), `use-mobile.ts`, `use-toast.ts` |
| `lib/` | API base constant, auth helpers, Supabase tripwire, session/hierarchy models, utils |
| `stores/` | `useClientNavStore.ts` — the **authoritative** zustand store for client/case/session state |
| `types/` | Shared types (`Client`) |
| `styles/globals.css` | Duplicate of the Tailwind theme (the canonical copy per `components.json` is `app/globals.css`) |
| `public/` | Icons, logos, placeholders |

### Backend and infrastructure

| Path | Contents |
| --- | --- |
| `backend/CloudFlare.js` | The entire API Worker (`clinical-ai-backend`): auth, CRUD, AI orchestration, Supabase proxy. Single file, ~1280 lines |
| `wrangler.jsonc` | Worker config for `clinical-ai-backend` (`main: backend/CloudFlare.js`) |
| `workers/mcp-gateway/` | Second Worker (`alice-mcp`): MCP context/tools gateway with a service binding to the API Worker |
| `supabase/migrations/` | `20260603_session_clinical_fields.sql` — adds the clinical columns to `public.sessions` |
| `supabase/functions/` | Empty — reserved for Supabase edge functions |
| `ai-config/` | `mcp.json` (MCP server registration; contains a placeholder subdomain) and `prompts/` (`intake.txt`, `session.txt` — both empty) |
| `.cursor/config.json` | Cursor MCP client config pointing at the deployed gateway |
| `.github/copilot-instructions.md` | Agent rules: use the MCP gateway, never guess the DB schema |

### Java skeleton and shared config

| Path | Contents |
| --- | --- |
| `alice-core`, `alice-api`, `alice-engine`, `alice-runtime`, `alice-plugin-api`, `alice-plugins`, `alice-platform` | Gradle modules. Only `build.gradle.kts` is committed; `src/main/java` is empty in all seven |
| `settings.gradle.kts`, `build.gradle.kts` | Gradle root: group `com.neuvo.alice`, version `0.1.0-SNAPSHOT`, Java 17 toolchain |
| `package.json` | Next.js app manifest. Both `package-lock.json` **and** `pnpm-lock.yaml` are committed |
| `tsconfig.json` | TypeScript strict, `target: ES6`, path alias `@/*` → repo root |
| `next.config.mjs` | `typescript.ignoreBuildErrors: true`, `images.unoptimized: true` |
| `postcss.config.mjs` | Tailwind v4 via `@tailwindcss/postcss` |
| `components.json` | shadcn/ui config: new-york, neutral base, RSC + TS, `css: app/globals.css` |
| `.vscode/launch.json` | Chrome launch config pointing at `http://localhost:8080` |
| `.rooignore` / `.gitignore` | Ignore lists for tooling and VCS |

---

## 3. Runtime architecture

Three tiers, one direction of trust: the browser only ever talks to a Cloudflare Worker.

```
┌──────────────────────────────┐
│  Browser — Next.js 16 (RSC)  │
│  app/ components/ stores/    │
│                              │
│  • API origin constant:      │
│    lib/clinical-ai-api.ts    │
│  • token in localStorage:    │
│    alice_token               │
└───────────────┬──────────────┘
                │  HTTPS (CORS: *), no API keys in the browser
                ▼
┌──────────────────────────────────────────────┐
│  Worker: clinical-ai-backend                 │
│  backend/CloudFlare.js + wrangler.jsonc      │
│                                              │
│  • verifies nothing itself — it is the       │
│    trusted proxy; it holds the service-role  │
│    key and speaks to Supabase on your behalf │
│  • orchestrates Groq for all AI output       │
└───────┬────────────────────────┬─────────────┘
        │                        │
        │ PostgREST + GoTrue     │ Chat Completions
        │ (service role / anon)  │ (GROQ_API_KEY)
        ▼                        ▼
┌────────────────────┐   ┌───────────────────────────┐
│ Supabase           │   │ Groq API                  │
│ • clients          │   │ model: llama-3.1-8b-instant│
│ • case_formulations│   └───────────────────────────┘
│ • sessions         │
│ • session_versions │
│ • profiles         │
│ • auth.users       │
└────────────────────┘
        ▲
        │  service binding (Worker→Worker, no public hop)
┌───────┴──────────────────────────────────────┐
│  Worker: alice-mcp  (workers/mcp-gateway)    │
│  /context  /tools  /tools/run  /debug  /     │
│  → forwards to BACKEND binding               │
└──────────────────────────────────────────────┘
                ▲
                │  AI agents (Cline, Cursor, Copilot, …)
                └──────────────────────────────────
```

### Boundary rules

1. **The frontend never talks to Supabase.** `lib/supabase.ts` exports a `Proxy` whose `get`
   handler throws `"Direct Supabase usage in frontend is disabled. Use Cloudflare API instead."`
   This is intentional and enforced at runtime — do not "fix" it.
2. **One API origin.** `lib/clinical-ai-api.ts` exports `CLINICAL_AI_API_BASE`
   (`https://clinical-ai-backend.neuvoteam.workers.dev`) and throws at module load if the value
   is not an absolute `https://` URL. Import it instead of hard-coding a URL.
   *(Exception today: `components/ClientLanding.tsx`, `app/login/page.tsx` and
   `app/signup/page.tsx` still hard-code the same URL — see §13.)*
3. **Secrets live only in Worker configuration.** The browser never receives
   `SUPABASE_SERVICE_ROLE_KEY` or `GROQ_API_KEY`.

### Cross-cutting backend behaviour

| Concern | Behaviour in `backend/CloudFlare.js` |
| --- | --- |
| CORS | `Access-Control-Allow-Origin: *`, methods `GET, POST, PATCH, DELETE, OPTIONS`, headers `Content-Type, Authorization, apikey, Prefer`. `OPTIONS` short-circuits with `200` and no body |
| Path handling | Trailing slashes stripped (`cleanPath`); path segments read from `path.split("/")[2]` for `:id` routes |
| Supabase REST base | `env.SUPABASE_URL` normalised (trailing `/` removed) then `${base}/rest/v1` |
| Supabase auth base | `${base}/auth/v1` |
| Write auth | Service role key in both `apikey` and `Authorization`, `Prefer: return=representation` |
| Errors | Whole handler wrapped in `try/catch`; failures return `500 { error: <err.message> }`. Unmatched paths return `404 { error: "Route not found" }` |
| **Route ordering** | Handlers are matched top-to-bottom. `/auth/*`, `/clients`, `/cases`, `/sessions` POST handlers are declared **before** the catch-all `if (method === "POST")` AI block, so their returns win. New POST routes must be inserted above that block or they will be rejected with `Missing sessionNotes` |
| Schema drift tolerance | `fetchSessionRow` first selects the full column list; on Postgres `42703` ("does not exist") it retries with `id,name,case_id`. `patchSessionRow` splits clinical columns into a second PATCH and warns instead of failing when they are missing |

---

## 4. End-to-end flows

### 4.1 Sign-up (clinician)

1. `/signup` validates locally (first + last name, email regex, password ≥ 8 chars, confirmation match) and enables the button only when valid.
2. `POST /auth/signup` → Worker forwards to Supabase GoTrue `/auth/v1/signup` with
   `data: { first_name, last_name, role: "clinician" }` (role is hard-coded by the Worker, not sent by the client).
3. Worker responds `{ success: true, message: "Verification email sent" }`. Rate-limit errors
   (`over_email_send_rate_limit`) are surfaced to the user as "Limit reached."

### 4.2 Login, session bootstrap and logout

1. `POST /auth/login` → GoTrue `token?grant_type=password` → `{ access_token, refresh_token, user }`;
   failures return `401`.
2. The client stores `access_token` in `localStorage` under **`alice_token`** and navigates to `/dashboard`.
3. `components/auth-guard.tsx` calls `GET /auth/me` with the token; on failure it hard-redirects to `/login`.
   `GET /auth/me` returns `{ user, profile }` where `profile` is the matching `profiles` row.
4. `GET /` (`app/page.tsx`) is a pure client-side redirect: no token → `/login`, otherwise `/dashboard`.
5. Logout (`lib/auth.ts` → `components/logout-button.tsx`) removes `alice_token` and sends the user to `/login`.

> There is no server-side session, no refresh-token rotation and no route middleware. Access
> control is entirely client-side plus the Worker's own trust of its service-role key.

### 4.3 Choosing a client (landing → workspace)

1. `/dashboard` mounts `AuthGuard`, then `ClientLanding`, which does
   `GET /clients` → `[{ id, name }]` (name comes from `full_name`; the Worker falls back to
   `` `Client ${id.slice(0,6)}` `` when it is null).
2. Clicking a client does `GET /client/:id` for the full tree, then
   `useClientNavStore.selectClient(id)` re-fetches the tree itself and normalises it.
3. `selectClient` restores the previously open session via `resolveDefaultSession`
   (`lib/last-session-access.ts` reads `localStorage["alice:last-session-by-client"]`) and falls
   back to the newest session in the newest case.
4. With `{ bootstrap: true }` (newly created clients) the store creates a default case and
   session first: `POST /cases` → `POST /sessions` → re-fetch tree → select.

### 4.4 Managing the tree

| Action | Store call | HTTP |
| --- | --- | --- |
| New clinic client | `ClientLanding` form (4.6) | `POST /clients` |
| New case | `createCase` | `POST /cases` (Worker names it `Case N`) then re-select client |
| New session | `createSession(caseId)` | `POST /sessions` (names it `Session N`) then re-select client + select newest session |
| Delete case | `deleteCase(caseId)` | `DELETE /cases/:id` then re-select client |
| Delete session | `deleteSession(caseId, sessionId)` | `DELETE /sessions/:sessionId`, clears selection if it was open, then re-select |
| Rename client | `renameClient` | optimistic local update, then `PATCH /clients/:id` |
| Rename case | `renameCase` | optimistic local update, then `PATCH /cases/:id` |
| Rename session | `renameSession` | optimistic local update, then `PATCH /sessions/:id` |

The sidebar UI is `components/sidebar/ClientNode.tsx` → `CaseNode.tsx` → `SessionNode.tsx`, with
`EditableName` inline rename. `components/clinical-folder-tree.tsx` and
`components/sidebar/Sidebar.tsx` are unused alternates (see §13).

### 4.5 The AI workflow (notes → analysis → materials)

```
Phase 1  clinician writes notes in components/vignette-generator.tsx
             │
Phase 2      ├─ POST /analyze/session  { sessionNotes, clientId, sessionId }
             │     → { rationale, inferredModality, riskFlags[] }
             │     → server-side: sessions.session_notes + sessions.analysis
             │       AND a new session_versions snapshot
             │
Phase 3      └─ POST /generate/practice-package { sessionNotes, clientId, sessionId }
                   → { homework[], scenario{title,difficulty,situation,objectives,coachTips}, quiz[] }
                   → server-side: sessions.practice_package (+ a session_versions snapshot)
             │
             └─ store.saveSessionContent(caseId, sessionId, { sessionNotes, analysis, practicePackage })
                   → PATCH /sessions/:sessionId  (optimistic UI, then reconcile with response)
```

`POST /generate/vignette` is the lighter alternative (`{ scenario, quiz, homework }`) used for the
plain vignette flow; it persists `vignette`, `homework`, `quiz` and `modality`.

### 4.6 Creating a clinic client

`ClientLanding` collects first / middle / last name, email, country code (default `+65`) and phone,
validates (email regex, digits only, 6–15 digits), then `POST /clients` with snake_case keys
(`first_name`, `middle_name`, `last_name`, `email`, `country_code`, `phone_number`) and refreshes
the list. The newly created client is *not* auto-opened — the clinician clicks it.

### 4.7 Client-facing material pages (public)

- `app/homework/[sessionId]/page.tsx` → `GET /sessions/:id`, renders `vignette` (Case Summary),
  `quiz` (Reflection Questions) and `homework` (Your Tasks).
- `app/practice/[sessionId]/page.tsx` → `GET /sessions/:id`, renders `practicePackage.homework`
  as a checklist.
- The Worker also exposes `GET /client-homework/:sessionId` returning
  `{ sessionId, title, homework, quiz, vignette }` for link previews / MCP tooling.

Neither page authenticates, and neither is linked from the clinician UI today — the clinician shares
the URL. `sessionId` must be at least 10 characters for `/client-homework/*`.

---

## 5. HTTP API reference

Base URL: `https://clinical-ai-backend.neuvoteam.workers.dev`
(source: `lib/clinical-ai-api.ts`). All bodies and responses are JSON. There is **no** API-level
authentication on any route except `GET /auth/me` — the Worker authenticates to Supabase with its
service-role key regardless of the caller.

### 5.1 Auth

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/signup` | `{ first_name, last_name, email, password }` | `200 { success, message: "Verification email sent" }` | `400` when any field is missing; upstream GoTrue error body relayed with `400` |
| `POST` | `/auth/login` | `{ email, password }` | `200 { access_token, refresh_token, user }` | `400` missing fields; `401` invalid credentials (GoTrue body relayed) |
| `GET` | `/auth/me` | `Authorization: Bearer <access_token>` | `200 { user, profile }` (`profile` = matching `profiles` row, or `null`) | `401` no token / invalid token |

### 5.2 Clients

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/clients` | – | `200 [{ id, name }]` — `name` is `full_name`, falling back to `Client <first 6 of id>`; `[]` if the payload is not an array | `500` on Supabase error |
| `POST` | `/clients` | `{ name }` **or** any of `first_name, middle_name, last_name, email, country_code, phone_number` | `200` the inserted row | `400 { error: "Missing client details (name or contact fields)" }`; `500` |
| `PATCH` | `/clients/:id` | `{ name }` **or** any of `first_name, middle_name, last_name, email, country_code, phone_number` | `200 { success: true }` | `400 { error: "No client fields to update" }` |
| `GET` | `/client/:id` | – | `200 { id, name, cases: [{ id, name, sessions: [{ id, name }] }] }` | `404 { error: "Client not found" }` |
| `GET` | `/client/history` | query `clientId` | `200 [material]` — sessions that carry a `vignette` or `practice_package`, newest first | `400 { error: "Missing clientId" }` |
| `POST` | `/client/worksheet` | `{ clientId, sessionId \| vignetteId, answers }` | `200 { success: true, submission }` | `400 { error: "Missing clientId or answers" }`; `500` |

`buildClientPayload` accepts either shape: a single `name` is split into `first_name` / `middle_name` /
`last_name` (and written to `full_name` too), while the discrete contact columns are written verbatim.
`writeClientRow` retries without `full_name` when Supabase reports it as generated or missing, so renaming
a client no longer blanks its contacts and `useClientNavStore.createClient(name)` now creates a named row.

`GET /client/history` returns the shape `components/client-view.tsx` renders —
`{ id, title, content, scenario, skill, reflection, worksheetQuestions[], createdAt, modality }` — derived
from `practice_package` (scenario / quiz / coachTips) plus `vignette`. Both new routes are declared
**above** their would-be shadows: `/client/history` before the `GET /client/:id` prefix handler, and
`/client/worksheet` before the `if (method === "POST")` AI guard. The history query joins through
`case_formulations` because `sessions.client_id` is frequently `NULL` (§13.2).

### 5.3 Cases

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/cases` | `{ clientId, name? }` | `200` the inserted `case_formulations` row. When `name` is omitted the Worker counts existing cases for the client and uses `` `Case ${count + 1}` `` | `400 { error: "Missing clientId" }` |
| `PATCH` | `/cases/:id` | `{ name }` | `200 { success: true }` | `400 { error: "Missing name" }` |
| `DELETE` | `/cases/:id` | – | `200 { success: true }` | `400` missing id; `500` on Supabase error |

### 5.4 Sessions

Canonical session projection returned by every read/write route (`formatSessionRow`):

```jsonc
{
  "id": "uuid",
  "name": "Session 1",
  "caseId": "uuid",
  "sessionNotes": "",
  "vignette": "",
  "homework": [],
  "quiz": [],
  "practicePackage": null,
  "analysis": null,
  "modality": null,
  "created_at": "timestamp",
  "lastUpdated": "timestamp"
}
```

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/sessions` | `{ caseId, clientId?, name? }` | `200` inserted row; default name `` `Session ${count + 1}` `` | `400 { error: "Missing caseId" }` |
| `GET` | `/sessions` | query `clientId?`, `sessionId?` | `200 [session]` ordered `created_at.desc` | `500` |
| `GET` | `/sessions/:id` | – | `200 session` | `400` missing id; `404 { error: "Session not found" }` |
| `GET` | `/latest-session` | query `sessionId?` | `200 session`, or `200 { sessionNotes: "", lastUpdated: null }` when no `sessionId` is supplied | `404` |
| `PATCH` | `/sessions/:id` | any of `name`, `sessionNotes`, `vignette`, `homework`, `quiz`, `practicePackage`, `analysis`, `modality` | `200 session`; also appends a `session_versions` snapshot | `400 { error: "No fields to update" }`; `404` |
| `DELETE` | `/sessions/:id` | – | `200 { success: true }` | `400`; `500` |
| `GET` | `/client-homework/:sessionId` | – | `200 { sessionId, title, homework, quiz, vignette }` | `400 { error: "Invalid session ID" }` when the id is shorter than 10 chars; `404` |

`PATCH` field mapping is done by `buildSessionPatch` — camelCase in, snake_case out:

| Client field | DB column |
| --- | --- |
| `name` (must be a non-empty string) | `name` |
| `sessionNotes` | `session_notes` |
| `vignette` | `vignette` |
| `homework` | `homework` |
| `quiz` | `quiz` |
| `practicePackage` | `practice_package` |
| `analysis` | `analysis` |
| `modality` | `modality` |

### 5.5 AI routes

All three require `sessionNotes` (non-empty) in the body — the shared guard runs before the route
match, so a missing field returns `400 { error: "Missing sessionNotes" }` even for an unknown path.

| Method | Path | Request | Success response |
| --- | --- | --- | --- |
| `POST` | `/analyze/session` | `{ sessionNotes, clientId?, sessionId? }` | `{ rationale, inferredModality, riskFlags[] }` |
| `POST` | `/generate/vignette` | `{ sessionNotes, modality?, verifiedModality?, clientId?, sessionId? }` | `{ scenario, quiz[], homework[] }` |
| `POST` | `/generate/practice-package` | `{ sessionNotes, modality?, verifiedModality?, clientId?, sessionId? }` | `{ homework[], scenario{ title, difficulty, situation, objectives[], coachTips[] }, quiz[{ question, answer, rationale }] }` |

- Modality resolution is `verifiedModality ?? modality ?? "cbt"`; the value is passed to the prompt
  verbatim and stored in `sessions.modality`. `components/vignette-generator.tsx` sends the analysed
  `inferredModality` as `modality` (and persists it via `PATCH /sessions/:id`), so a DBT/ACT analysis no
  longer produces CBT material.
- When `sessionId` is supplied, the route **also writes to the database before responding**:
  `persistSessionFields` updates `sessions`, and `saveSessionVersion` appends to `session_versions`.
  A failure inside those helpers is logged, not surfaced — the AI payload still returns `200`.
- `riskFlags` shape: `{ label, severity: "low"|"medium"|"high", confidence: 0..1, evidence: [string] }`.
- **Failures are loud by default.** When Groq is unreachable or rejects the request, `callGroq` returns a
  result object and the route answers `502 { error: "AI unavailable", code: "GROQ_ERROR", detail,
  groqStatus, model }`, where `detail` is Groq's own `error.message` (for example the
  `model_not_found` sentence). Nothing is persisted on this path. Append `?allowDegraded=1` to get a
  `200` with the placeholder payload plus `degraded: true`, `warning` and `model` instead of the `502`
  (also not persisted — the router returns before any write).
- **Unparseable output counts as a failure.** If Groq answers but the content is not usable JSON, the
  route returns `502 { error: "AI unavailable", code: "BAD_AI_RESPONSE", detail, sample, model }` (or a
  degraded `200` carrying the same `sample` when flagged), so a placeholder can never be presented as a
  real formulation.

### 5.6 Preflight, unmatched paths and errors

| Case | Response |
| --- | --- |
| `OPTIONS` any path | `200`, empty body, CORS headers only |
| `POST` to an unknown path with `sessionNotes` present | `404 { error: "Route not found" }` |
| `POST` to an unknown path without `sessionNotes` | `400 { error: "Missing sessionNotes" }` |
| Any unhandled GET/DELETE/PATCH | Falls through to `404 { error: "Route not found" }` (the outer `respond` at the end of the `try`) |
| Thrown error anywhere | `500 { error: <err.message> }` + `console.error("Worker error:", err)` |

**Paths referenced by the frontend but not implemented by the Worker**: none. `GET /client/history` and
`POST /client/worksheet` are now implemented (§5.2), each declared above the handler that used to shadow
it (`GET /client/:id`, and the `if (method === "POST")` AI guard respectively).

### 5.7 AI diagnostics

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/ai/models` | `{ ok, model, configuredAvailable, count, available[] }` — the Worker proxies Groq's `GET /openai/v1/models` with its own key, so this reports exactly which model IDs the account may call, and whether the configured `GROQ_MODEL` is one of them. `ok: false` + `groqStatus`/`detail` when the key itself is rejected |
| `GET` | `/ai/health` | `{ ok, model, sample }` on success, `{ ok: false, model, groqStatus, detail }` when Groq rejects the request. Always `200` so a script or the dashboard can read it |
| `GET` | `/ai/probe` | Runs the **real** handler against the configured model and returns `{ ok, prompt, model, parse_ok, finish_reason, raw_sample, parsed, groq_error, failure }`. `?prompt=analyze\|generate\|package`, plus optional `?notes=` and `?modality=`. `failure` is `"groq_error"`, `"parse_error"` or `null` — this is the single call that answers "why is generation not working". Always `200` |

Both are declared **above** the AI guard and need no body. When the AI looks broken, check these before
blaming the UI: `curl <worker>/ai/models`, then `curl <worker>/ai/health`, then watch
`npx wrangler tail` while clicking Generate.

---

## 6. Data model

**Supabase Postgres.** The schema is authoritative in Supabase itself — per
`.github/copilot-instructions.md`, *do not guess the schema*; query the MCP gateway's `/context`
or read the tables. What follows is the contract the current code actually depends on.

### 6.1 Tables

| Table | Columns used by the code | Where |
| --- | --- | --- |
| `clients` | `id`, `full_name` (read), `first_name`, `middle_name`, `last_name`, `email`, `country_code`, `phone_number` (written) | `GET /clients`, `GET /client/:id`, `POST /clients`, `PATCH /clients/:id` |
| `case_formulations` | `id`, `client_id`, `name`, plus embedded `sessions(id,name)` | `POST /cases`, `PATCH /cases/:id`, `DELETE /cases/:id`, `GET /client/:id` |
| `sessions` | `id`, `case_id`, `client_id`, `name`, `session_notes`, `vignette`, `homework` (jsonb), `quiz` (jsonb), `practice_package` (jsonb), `analysis` (jsonb), `modality` (text), `created_at`, `updated_at` | every session route |
| `session_versions` | `session_id`, `session_notes`, `vignette`, `homework`, `quiz`, `practice_package`, `modality`, `analysis`, `created_at` (written only — nothing reads it yet) | `saveSessionVersion` |
| `profiles` | `id`, `*` | `GET /auth/me` |

Notes:

- `full_name` is read but **never written** by the Worker, so it must be a generated column or
  trigger-maintained in the database. Creating a client by hand in the SQL editor without it will
  produce fallback names such as `Client 7f3a9c`.
- `sessions.client_id` is written by `POST /sessions` only when the caller passes it; the store's
  `createSession` sends `{ caseId }` alone, so new sessions may have a `NULL` `client_id`. Anything
  filtering sessions by client should go through the case relationship or the `/sessions?clientId=`
  query.

### 6.2 Migration in-repo

`supabase/migrations/20260603_session_clinical_fields.sql` (idempotent — run it in the Supabase SQL
editor when the clinical columns are missing):

```sql
alter table public.sessions
  add column if not exists session_notes text,
  add column if not exists vignette text,
  add column if not exists homework jsonb default '[]'::jsonb,
  add column if not exists quiz jsonb default '[]'::jsonb,
  add column if not exists analysis jsonb,
  add column if not exists modality text;
```

This migration does **not** cover `practice_package` (written by the Worker) and does **not** define
`session_versions` — both exist only in the live database. Add further migrations to
`supabase/migrations/` rather than editing this file.

`supabase/migrations/20260914_worksheet_submissions.sql` adds `worksheet_submissions`
(`client_id`, `session_id`, `answers` jsonb, `created_at` + indexes) which backs
`POST /client/worksheet`. Run it in the Supabase SQL editor before that route can persist anything.

### 6.3 JSON payload shapes stored on `sessions`

| Column | Shape |
| --- | --- |
| `homework` | `string[]` |
| `quiz` | `string[]` for the vignette flow; `{ question, answer, rationale }[]` inside `practice_package.quiz` |
| `analysis` | `{ rationale: string, inferredModality: string, riskFlags: { label, severity, confidence, evidence[] }[] }` |
| `practice_package` | `{ homework: string[], scenario: { title, difficulty: "easy"\|"medium"\|"hard", situation, objectives: string[], coachTips: string[] }, quiz: { question, answer, rationale }[] }` (see `lib/practice-package.ts`) |
| `vignette` | Plain string (scenario text) |

---

## 7. AI layer

All AI output is produced inside `backend/CloudFlare.js` via Groq's OpenAI-compatible endpoint.

| Setting | Value |
| --- | --- |
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| Model | `env.GROQ_MODEL` (a `wrangler.jsonc` var) falling back to the `MODEL` constant — both currently `openai/gpt-oss-20b`. The Llama 3.x IDs this code originally targeted (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) are now **Enterprise-only** on Groq and return `404 model_not_found` |
| Auth | `Authorization: Bearer ${env.GROQ_API_KEY}` |
| Temperature | `0.3` for `/analyze/session`, `0.6` for `/generate/vignette`, `0.5` for `/generate/practice-package` |

### 7.1 Prompt contracts

Each handler sends a `system` message that demands **JSON only**, plus a `user` message containing the
modality (where relevant) and the clinician's notes.

| Handler | Output contract |
| --- | --- |
| `handleAnalyze` | `{ rationale, inferredModality: "CBT"\|"DBT"\|"ACT", riskFlags[{ label, severity, confidence, evidence[] }] }`. Prompt rules: focus on underlying mechanisms, extract verbatim evidence phrases, include only real risks |
| `handleGenerate` | `{ scenario, quiz[], homework[] }`. Rules: real psychological mechanisms, insight questions (not recall), precise/measurable homework, match modality strictly |
| `handleGeneratePracticePackage` | `{ homework[], scenario{ title, difficulty, situation, objectives[], coachTips[] }, quiz[{ question, answer, rationale }] }`. Rules: actionable measurable homework, role-play-supporting scenario, insight-reinforcing quiz |

### 7.2 Robustness

- `callGroq` returns a result object — `{ ok: true, model, content }` or
  `{ ok: false, model, error: { status, message, raw } }` — and logs
  `Groq error: GROQ ERROR <status> <message> (model=<id>)`. It never throws. `extractGroqErrorMessage`
  lifts Groq's own `error.message` out of the body so both the log and the HTTP response carry the real
  reason (`model_not_found`, `invalid_api_key`, …) instead of a truncated blob.
- Handlers translate that result: **`502` by default** (`groqFailureResponse`) or, with
  `?allowDegraded=1`, a `200` placeholder payload tagged `degraded: true` + `warning`
  (`degradedGroqPayload`). The router recognises the failure by checking for a `Response` and returns it
  **before** any persistence runs.
- `stripMarkdown` **unwraps** a fenced ```json block instead of deleting it. Deleting was the cause of a
  real incident: any model that fenced its JSON had the answer thrown away, and the handler silently
  served the placeholder as if it were the formulation. Bare and prose-wrapped JSON both parse.
- `extractJsonObject` slices from the first `{` to the last `}` and `JSON.parse`s it, returning `null`
  when that fails.
- Hard-coded fallbacks (`"Clinical synthesis unavailable."`, `"Scenario unavailable."`, the default
  `Practice Scenario` object) are now used for unparseable *successful* completions and for the
  `?allowDegraded=1` path — not for the default `502` path.

### 7.3 Persistence side effects

Because a generation carrying a `sessionId` writes *before* responding, the client's follow-up
`PATCH /sessions/:id` is a second write of the same data. The PATCH is the call that guarantees the
camelCase `analysis` / `practicePackage` payload reaches the database; the generate-time write exists so
content survives even if the tab is closed mid-workflow.

### 7.4 Legacy Ollama route (not part of the product flow)

`app/api/analyze/session/route.ts` is a Next.js route handler that `POST`s to
`http://localhost:11434/api/generate` with `model: "llama3"` and returns `{ vignette: data.response }`.
It is a development leftover: no component references it (the UI calls the Worker directly), it returns
`502` when Ollama is not running, and it cannot work on a deployed host where `localhost` is not the
developer's machine. Treat it as scratch code — if it is still needed, point it at the Worker and
import `CLINICAL_AI_API_BASE`.

---

## 8. Frontend state, routing & storage

### 8.1 Routes

| Route | Type | Notes |
| --- | --- | --- |
| `/` | client redirect | no `alice_token` → `/login`, else `/dashboard` |
| `/login` | public | email + password against `POST /auth/login` |
| `/signup` | public | `POST /auth/signup`, then a verification email |
| `/forgot-password` | public stub | shows an alert; no reset request is sent |
| `/client-login` | public stub | accepts input, then `router.push(redirect)` — it authenticates nothing |
| `/test-auth` | diagnostic | calls `getCurrentUser()` and logs the result |
| `/dashboard` | guarded | client landing → sidebar + clinician/client view |
| `/cases/[caseId]/sessions/[sessionId]` | redirect shim | selects the session, then `router.replace('/')` |
| `/homework/[sessionId]` | public | client-facing Case Summary / Reflection Questions / Your Tasks |
| `/practice/[sessionId]` | public | client-facing practice checklist |
| `/api/analyze/session` | API route | legacy Ollama bridge (§7.4) |

### 8.2 The authoritative store — `stores/useClientNavStore.ts`

A zustand store holding `client`, `clients`, `selectedClientId`, `selectedCaseId`,
`selectedSessionId`, `loading` and `error`.

- **Reads** go through `/clients`, `/client/:id` and `/sessions/:id`; `normalizeSession` and
  `normalizeClientTree` convert snake_case DB rows into camelCase app state and coerce `homework` /
  `quiz` to arrays.
- **Writes are optimistic**: state is updated first, then the HTTP call runs; on failure only `error`
  is set — there is **no rollback**.
- `safeFetch` logs `🌐 SAFE FETCH: <url>` and, on failure, the URL plus the parsed body, then throws
  `data?.error || "Request failed"`.
- `selectSession` records the choice via `setLastSession` and re-fetches the session to refresh cached
  content.
- `saveSessionContent(caseId, sessionId, payload)` sends only the camelCase keys present in the payload
  and merges the response back into the tree.

### 8.3 The local-only hierarchy (parallel model — do not confuse with the store)

`lib/clinical-hierarchy.ts` + `hooks/use-clinical-workspace.ts` implement a **separate, browser-only**
client→case→session model persisted under the `localStorage` key `mindcare-clinical-hierarchy-v1`
(with a seeded "Sample client"). It exports helpers such as `addClient`, `addCase`, `addSession`,
`updateSessionNotes`, `appendSessionAnalysis` and `appendSessionWorksheet`, and
`lib/vignette-restore.ts` rebuilds a 3-step UI state from its records.

Nothing in the shipped dashboard consumes it: `/dashboard` renders `ClientLanding` plus the zustand
store, not `useClinicalWorkspace`. It reads as an earlier iteration of the same idea. Before changing
this area, confirm which model the screen you are editing actually uses — and prefer the zustand store,
which talks to the Worker.

### 8.4 Client-side storage keys

| Key | Owner | Purpose |
| --- | --- | --- |
| `alice_token` | `lib/auth.ts`, `app/page.tsx`, `app/login/page.tsx` | Supabase access token |
| `alice:last-session-by-client` | `lib/last-session-access.ts` | `{ [clientId]: { caseId, sessionId, accessedAt } }` |
| `mindcare-clinical-hierarchy-v1` | `lib/clinical-hierarchy.ts` | The local-only hierarchy (§8.3) |

No refresh token is persisted, so an expired token simply bounces the user to `/login` via `AuthGuard`.

### 8.5 Notable component details

- `components/vignette-generator.tsx` is the largest client component: a 3-phase state machine, a
  `Progress` bar, and PDF export via dynamic `jspdf` + `html2canvas`. Because Tailwind v4 emits
  `oklch()`/`lab()` colours that html2canvas cannot parse, it inlines sRGB-safe computed styles onto the
  cloned DOM (`coerceStyleValueForHtml2Canvas`, `inlineComputedStylesForCapture`) before capture — keep
  that shim if you change the worksheet markup.
- `components/main-content.tsx` dynamically imports the generator with `ssr: false`; its History tab
  lists `GET /sessions?clientId=…` rows keyed on `created_at`.
- `components/auth-guard.tsx` renders `Loading...` until `GET /auth/me` resolves, then either renders
  the children or hard-redirects to `/login`.
- Toast feedback is wired to `hooks/use-toast.ts`, and `components/ui/toaster.tsx` /
  `components/ui/sonner.tsx` exist — but **no layout mounts `<Toaster />`**, so `toast()` calls (for
  example the "Could not open client" notice in `app/dashboard/page.tsx`) render nothing today.
  Mounting a `Toaster` in `app/layout.tsx` is a one-line fix.

---

## 9. MCP gateway

A second Cloudflare Worker, `alice-mcp` (`workers/mcp-gateway/`), exposes the platform to AI agents
over plain HTTP so tooling never has to guess the schema or hand-roll Supabase calls.

Config (`workers/mcp-gateway/wrangler.toml`): `main = "src/index.ts"`, and a **service binding**
`BACKEND → clinical-ai-backend` so every call goes Worker-to-Worker with no public hop.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Health text: `ALICE MCP Gateway running` |
| `GET` | `/context` | Machine-readable system context: `system`, `modules`, `tools` |
| `GET` | `/tools` | `[{ name }]` for all eight tools |
| `POST` | `/tools/run` | `{ tool, input }` → executes the tool against the `BACKEND` binding |
| `GET` | `/debug` | Fetches `/clients` through the binding and returns the raw text (diagnostics) |

### 9.1 Tools

| Tool | Input | Backend call |
| --- | --- | --- |
| `get_client_tree` | – | `GET /clients` |
| `get_client` | `{ client_id }` | `GET /client/:client_id` |
| `create_case` | `{ client_id }` | `POST /cases` with `{ clientId }` |
| `create_session` | `{ case_id }` | `POST /sessions` with `{ caseId }` |
| `delete_case` | `{ case_id }` | `DELETE /cases/:case_id` |
| `delete_session` | `{ session_id }` | `DELETE /sessions/:session_id` |
| `analyze_session` | `{ text }` | `POST /analyze/session` with `{ sessionNotes: text }` |
| `generate_vignette` | `{ text, modality? }` | `POST /generate/vignette` with `{ sessionNotes: text, modality: modality ?? "cbt" }` |

Unknown tools return `400 { error: "Unknown tool" }`; execution failures return
`500 { error: "Execution failed", message, stack }`.

### 9.2 Agent workflow

1. `GET /context` first — it is the declared source of truth for modules and tools.
2. Discover with `GET /tools`, then execute with `POST /tools/run`.
3. Never guess table or column names; ask the gateway or inspect the database.

Client registration lives in three places that must stay in sync: `.cursor/config.json`
(`https://alice-mcp.neuvoteam.workers.dev/`), `ai-config/mcp.json` (a placeholder
`alice-mcp.YOUR-SUBDOMAIN.workers.dev`), and `.github/copilot-instructions.md` (which documents
`https://alice-mcp.neuvoteam.workers.dev/context`).

**Dead code in this Worker:** `src/tools.ts` (`get_client` only) and `src/context.ts` are never
imported — `src/index.ts` inlines both; `src/memory.ts` is empty.

---

## 10. Local development & deployment

### 10.1 Prerequisites

| Tool | Why |
| --- | --- |
| Node.js 20+ (repo has been used with Node 25) and npm or pnpm | Next.js app |
| Wrangler CLI (`npx wrangler`) | It is **not** a project dependency, so run it through `npx` |
| A Supabase project | Auth + Postgres |
| A Groq API key | All AI routes |
| Java 17 + a local Gradle 8+ install | Only for the Java modules — **no wrapper is committed** (no `gradlew`, no `gradle/wrapper/`), so `gradle` must be on your PATH |

### 10.2 Frontend

```powershell
npm install          # or: pnpm install
npm run dev          # Next.js dev server → http://localhost:3000
npm run build        # production build (type errors are ignored, see §11)
npm run start        # serve the production build
npm run lint         # ⚠ currently broken — see below
```

- **Pick one package manager.** Both `package-lock.json` and `pnpm-lock.yaml` are committed. Mixing
  them produces large, noisy diffs; the lockfile you touch should be the one the team standardises on.
- `npm run lint` runs `eslint .`, but ESLint is not in `devDependencies` and there is no
  `eslint.config.mjs` / `.eslintrc.json`, so the command fails out of the box (§13).
- `.vscode/launch.json` launches Chrome against `http://localhost:8080`, which does not match the
  Next.js default port (`3000`). Either start the dev server on 8080 or update the launch config.
- The frontend talks to the **deployed** Worker by default, because the base URL is a hard-coded
  constant in `lib/clinical-ai-api.ts`. To exercise a local Worker, point that constant at
  `http://localhost:8787` (Wrangler's default) while developing — remember to revert it.

### 10.3 API Worker (`clinical-ai-backend`)

Entry point `backend/CloudFlare.js`, configured by the root `wrangler.jsonc`.

```powershell
npx wrangler dev      # local Worker on http://localhost:8787
npx wrangler deploy   # publish
```

Runtime configuration (set as Worker secrets/vars — **never** commit the values):

| Variable | Used for |
| --- | --- |
| `SUPABASE_URL` | Base for `${url}/rest/v1` and `${url}/auth/v1` |
| `SUPABASE_ANON_KEY` | GoTrue signup/login/user calls |
| `SUPABASE_SERVICE_ROLE_KEY` | All PostgREST reads/writes |
| `GROQ_API_KEY` | AI routes |
| `GROQ_MODEL` | **A plain var, not a secret** (`wrangler.jsonc` `vars`) — the Groq model ID; overrides the `MODEL` constant. Change this, not the code, whenever Groq retires a model |
| `GROQ_MAX_TOKENS` | Optional plain var — when set it is sent as `max_tokens`, so a long model preamble cannot truncate the JSON. Unset by default (no such parameter is sent, so nothing can break on a model that rejects it) |

Locally, Wrangler reads these from a `.dev.vars` file; in production use
`npx wrangler secret put <NAME>`. `.dev.vars` (like `.wrangler/`) is covered by `.gitignore`, so a local
secrets file cannot be committed by accident.

### 10.4 MCP gateway Worker (`alice-mcp`)

```powershell
cd workers/mcp-gateway
npx wrangler dev
npx wrangler deploy
```

It has its own `wrangler.toml` with the `BACKEND` service binding, so it must be deployed after
`clinical-ai-backend` and against the same Cloudflare account.

> ⚠ **Security — read before touching this file.** `workers/mcp-gateway/wrangler.toml` is committed and
> its `[vars]` block still carries the live Supabase project URL. The `SUPABASE_SERVICE_ROLE_KEY` value
> that used to sit here was a `service_role` JWT that bypasses row-level security entirely; it has been
> removed from the working tree (along with the stray `workers/mcp-gateway/Untitled` copy), **but it
> remains in git history**. Rotate it in the Supabase dashboard, then set the new value with
> `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name alice-mcp` (or a local `.dev.vars`). Never
> write the value into documentation or code.

### 10.5 Database

Run `supabase/migrations/20260603_session_clinical_fields.sql` in the Supabase SQL editor on any
environment whose `sessions` table lacks the clinical columns, and add new migrations as new files in
`supabase/migrations/`.

### 10.6 Java modules

```powershell
gradle projects     # requires a local Gradle install; no wrapper is committed
gradle build        # compiles nothing today — all modules and src/main/java are empty
```

---

## 11. Conventions & guardrails

### 11.1 TypeScript / Next.js

- **Alias:** always import through `@/*` (→ repo root per `tsconfig.json`), e.g.
  `import { useClientNavStore } from "@/stores/useClientNavStore"`.
- **"use client"** at the top of every interactive component. In practice the whole `app/` tree is
  client-rendered: every page plus `app/global-error.tsx` declares `"use client"`, leaving only
  `app/layout.tsx` and `app/api/analyze/session/route.ts` on the server.
- **Strict mode is on but not enforced at build time:** `next.config.mjs` sets
  `typescript.ignoreBuildErrors: true`, so `npm run build` will happily ship type errors. Run
  `npx tsc --noEmit` for a real check (`tsconfig.json` already has `noEmit: true`).
- **Styling:** Tailwind v4 utility classes with `cn()` from `lib/utils.ts`
  (`clsx` + `tailwind-merge`). No Tailwind config file — the theme lives in `app/globals.css` via
  `@theme`/CSS variables. Auth screens (`login`, `signup`, `forgot-password`, `ClientLanding`) instead
  use inline `style` objects for a legacy look; match the surrounding file rather than converting
  styles mid-feature.
- **UI primitives:** shadcn/ui, new-york style, neutral base, RSC + TS enabled, lucide icons
  (`components.json`). Add new primitives with the shadcn CLI into `components/ui/`; do not hand-roll
  equivalents.
- **Forms/validation:** `react-hook-form` + `zod` + `@hookform/resolvers` are available, but the
  shipped auth/client forms use `useState` + `alert()`. Follow the pattern of the file you are editing.

### 11.2 Data access

- Only **one** origin to call: `CLINICAL_AI_API_BASE`. Never import `@supabase/supabase-js` in the
  browser (and never re-enable `lib/supabase.ts`).
- DB rows are snake_case; app state is camelCase. Convert at the boundary in the normaliser
  (`normalizeSession` / `normalizeClientTree` / `formatSessionRow`), not inside components.
- Treat the database as untrusted/unknown: per `.github/copilot-instructions.md`, **never guess the
  schema** — read it or ask the MCP gateway.
- Worker routes are order-sensitive (§3). Add new POST routes above the catch-all AI block.

### 11.3 Java module rules (authoritative copy: `ARCHITECTURE.md`)

```
alice-core        pure domain logic; no IO, no threads, no platform APIs; depends on nothing
alice-api         stable internal interfaces and contracts; depends on alice-core
alice-engine      orchestration and pipelines; depends on alice-api + alice-core
alice-runtime     production wiring (threads, clocks, logging); depends on engine/api/core
alice-plugin-api  public plugin surface; depends on alice-api
alice-plugins     plugin implementations
alice-platform    platform adapters
```

Rules that must not be broken: **no static global state**, **constructor injection only**, and
**no platform or runtime types may appear in `alice-core` or `alice-engine`**. Behaviour must not
change during refactors.

---

## 12. Java module skeleton

All seven modules are declared in `settings.gradle.kts` and exist on disk as
`build.gradle.kts` + an empty `src/main/java`. Nothing is compiled yet; the modules establish the
target layering for the domain/engine/runtime work.

| Module | `build.gradle.kts` dependency declarations |
| --- | --- |
| `alice-core` | *(none — "Intentionally empty: core depends on nothing")* |
| `alice-api` | `api(project(":alice-core"))` |
| `alice-engine` | `api(project(":alice-api"))`, `implementation(project(":alice-core"))` |
| `alice-runtime` | `implementation` of `:alice-engine`, `:alice-api`, `:alice-core` |
| `alice-plugin-api` | `api(project(":alice-api"))` |
| `alice-plugins` | `implementation` of `:alice-plugin-api`, `:alice-runtime` |
| `alice-platform` | `implementation(project(":alice-runtime"))` |

Root `build.gradle.kts` applies `java-library` to every subproject, sets the group
`com.neuvo.alice`, version `0.1.0-SNAPSHOT`, `mavenCentral()`, and a Java 17 toolchain.

**Relationship to the shipped product:** none, today. The running system is the TypeScript/Cloudflare
implementation described above. Treat this skeleton as the destination for a future extraction of the
domain logic — do not assume any `alice-*` class exists.

---

## 13. Known gaps & open items

Verified against the current tree — these are facts to be aware of, not opinions. None of them block
local development, but several are user-visible or security-relevant.

### 13.1 Security

| Item | Detail |
| --- | --- |
| **Committed service-role key (rotate it)** | A live `service_role` JWT was committed in `workers/mcp-gateway/wrangler.toml` `[vars]`, plus a stray `workers/mcp-gateway/Untitled` copy. Both are now gone from the working tree and `git grep eyJhbGciOi` is clean, but the value is still in git history — **rotate it in Supabase** and re-set it with `wrangler secret put` (§10.4) |
| **No API authentication** | Every Worker route except `GET /auth/me` is open, CORS is `*`, and the Worker uses its service-role key regardless of the caller. Anyone who knows the Worker URL can read or mutate any client, case or session — including deleting them. The `alice_token` check is client-side only and provides no protection |
| **Unauthenticated client pages** | `/homework/:sessionId` and `/practice/:sessionId` require no token; knowing (or guessing) a session UUID is the only gate. There are no signed or expiring links |
| **`POST /client/worksheet` is unauthenticated** | The submissions route is open like the rest of the API and trusts `clientId` from the body, so it needs the same ownership check as the rest of the surface |

### 13.2 Correctness bugs to fix

| Area | Problem |
| --- | --- |
| `sessions.client_id` | `createSession` sends `{ caseId }` only, so new sessions can have a `NULL` `client_id` even though the column is written when supplied. `GET /client/history` works around this by joining through `case_formulations`; `GET /sessions?clientId=…` (used by the History tab) does not, so it stays empty for such sessions |
| `/forgot-password` | "Send Reset Link" only shows `alert("Reset password functionality will be connected next.")` — no GoTrue recovery call |
| `/client-login` | Accepts credentials, then simply `router.push(redirect)`. It authenticates nothing |
| `session-history-panel.tsx` | Declares `riskFlags?: string[]` while `analysis.riskFlags` entries are objects (`{ label, severity, confidence, evidence }`); nothing currently renders this component against real data |
| Toasts never render | Nothing mounts `components/ui/toaster.tsx` or `components/ui/sonner.tsx`, so every `toast()` call in `app/dashboard/page.tsx` is silent (§8.5) |

### 13.3 Duplication, drift and dead code

| Item | Detail |
| --- | --- |
| Two hierarchy models | `stores/useClientNavStore.ts` (Worker-backed, in use) vs `lib/clinical-hierarchy.ts` + `hooks/use-clinical-workspace.ts` + `lib/vignette-restore.ts` (localStorage-only, unused by the dashboard). Keeping both invites edits to the wrong one |
| Unused components | `components/clinical-folder-tree.tsx` is a truncated stub referencing an undefined `ClinicalFolderTreeProps`; `components/sidebar/Sidebar.tsx` duplicates `dashboard-sidebar.tsx` without the app chrome. Neither is imported anywhere |
| Hard-coded API URLs | `components/ClientLanding.tsx`, `app/login/page.tsx` and `app/signup/page.tsx` repeat the Worker URL instead of importing `CLINICAL_AI_API_BASE` |
| Unused MCP sources | `workers/mcp-gateway/src/tools.ts` and `src/context.ts` are never imported (the gateway inlines both); `src/memory.ts` is empty |
| Empty placeholders | `ai-config/prompts/intake.txt`, `ai-config/prompts/session.txt`, `supabase/functions/`, `public/placeholder-*` |
| Stale MCP config | `ai-config/mcp.json` still points at `alice-mcp.YOUR-SUBDOMAIN.workers.dev`, unlike `.cursor/config.json` |
| Gateway package manifest | `workers/mcp-gateway/package.json` declares no dependencies and no scripts, so there is no `dev`/`deploy` shortcut |
| Schema not fully migrated | `session_versions` (written on every save) and `sessions.practice_package` exist only in the live database — no migration in-repo |
| Legacy Ollama route | `app/api/analyze/session/route.ts` (§7.4) |
| Duplicate theme | `styles/globals.css` duplicates `app/globals.css`; only the latter is referenced by `components.json` and imported by `app/layout.tsx` |
| Empty README | `README.md` is zero bytes; this document is not linked from anywhere in the repo |

### 13.4 Tooling and process gaps

| Item | Detail |
| --- | --- |
| No tests | No test runner, no test files, no test script |
| No CI | `.github/` contains only `copilot-instructions.md` — nothing builds or lints on push |
| Broken lint script | `npm run lint` → `eslint .`, but ESLint is absent from `devDependencies` and no config file exists |
| Type errors not gated | `next.config.mjs` sets `typescript.ignoreBuildErrors: true`; run `npx tsc --noEmit` manually |
| Two lockfiles | `package-lock.json` and `pnpm-lock.yaml` are both tracked |
| No Gradle wrapper | `gradlew` and `gradle/wrapper/` are absent; a local Gradle install is required |
| Launch config port | `.vscode/launch.json` targets `http://localhost:8080` while `next dev` serves `3000` |

### 13.5 Suggested order of attack

1. Rotate the committed Supabase service-role key (**outstanding** — the value also exists in git
   history) and re-set it with `wrangler secret put`; `.wrangler/` and `.dev.vars` are now git-ignored.
2. `PATCH /clients/:id` rename-vs-contact handling and `POST /clients` name support — done (§5.2).
3. `GET /client/history` and `POST /client/worksheet` — done (§5.2, §6.2; the migration still has to be
   run in Supabase).
4. `/client-login` no longer breaks `npm run build` (its `useSearchParams` call is wrapped in `Suspense`).
5. Decide on one client state model and delete the other.
6. Introduce lint/type/test gates in CI, then delete the dead code listed in §13.3.
7. The Groq model is now a `GROQ_MODEL` var rather than a code constant (§7). Llama 3.x IDs are
   Enterprise-only, so watch `/ai/models` and bump the var when Groq retires whatever is configured.

---

## 14. Maintaining this document

| If you… | Update |
| --- | --- |
| Add, rename or remove a Worker route | §5 tables (method, path, body, response, errors), §4 flows if the client consumes it, and the tool table in §9 if you expose it over MCP |
| Add a column or table | §6 (`Table`, columns used by code, JSON shapes), and add a migration file in `supabase/migrations/` |
| Change the Groq model, temperature or a prompt contract | §7 |
| Add a route or page | §8.1 |
| Add, rename or remove a `localStorage` key | §8.4 |
| Add an MCP tool or endpoint | §9 |
| Change env-var names, ports or scripts | §10 |
| Add a Java module or change dependencies | §12 and `ARCHITECTURE.md` |
| Fix one of the items above | Remove it from §13 |

### Document ownership

| Document | Owns |
| --- | --- |
| `ARCHITECTURE.md` | Java module layering rules (the normative copy) |
| `documentation.md` (this file) | Product behaviour, architecture of the running system, APIs, data model, setup, gaps |
| `.github/copilot-instructions.md` | Agent-specific instructions for using the ALICE MCP Gateway |

Keep this file honest: if a claim here no longer matches the code, the code wins — fix the document in
the same pull request that changes the behaviour. Never paste secret values (keys, tokens, JWTs,
connection strings) into this file; refer to variable names only.












