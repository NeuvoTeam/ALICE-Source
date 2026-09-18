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

**Access model (current).** Every clinician route requires a Supabase bearer token (`requireUser`,
§5.0). The client-facing surface needs no login, but is reachable only through a **signed, expiring
link** (§4.7, §5.2). The only public families are `/auth/*` and the signed-link client endpoints.

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
   rendered as a worksheet whose homework list exports to A4 via `lib/export-practice-pdf.ts`
   (programmatic jsPDF — no rasterisation).

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
| `app/practice/[sessionId]` | Client-facing material view (the `practiceHomework` checklist) — no login, but only reachable with a signed, expiring link (§4.7, §5.2) |
| `app/homework/[sessionId]` | Legacy redirect shim — forwards an already-shared `/homework` link to `/practice/<id>`, carrying `?exp=&sig=` across unchanged (§4.7) |
| `app/cases/[caseId]/sessions/[sessionId]` | Bookmark-compat redirect shim — selects the session in the store then `router.replace('/')` |
| `app/api/analyze/session/route.ts` | **Legacy/dev-only** Next.js route calling a local Ollama instance. Not used by the shipped UI (see §7) |
| `components/` | Feature components: `ClientLanding`, `main-content`, `vignette-generator`, `client-view`, `dashboard-sidebar`, `auth-guard`, `logout-button`, `session-history-panel`, `theme-provider`, plus `components/sidebar/*` (the client→case→session tree) |
| `components/ui/` | Generated shadcn/ui primitives (new-york style). Treat as vendored — regenerate rather than hand-edit |
| `hooks/` | `use-clinical-workspace.ts` (local-only workspace — see §8), `use-mobile.ts`, `use-toast.ts` |
| `lib/` | API base constant, auth helpers, Supabase tripwire, session/hierarchy models, the session-hydration guard (§8.2), utils |
| `stores/` | `useClientNavStore.ts` — the **authoritative** zustand store for client/case/session state |
| `types/` | Shared types (`Client`) |
| `styles/globals.css` | Duplicate of the Tailwind theme (the canonical copy per `components.json` is `app/globals.css`) |
| `public/` | Icons, logos, placeholders |

### Backend and infrastructure

| Path | Contents |
| --- | --- |
| `backend/CloudFlare.js` | The entire API Worker (`clinical-ai-backend`): caller authentication, CRUD, AI orchestration, Supabase proxy. Single file, ~2,820 lines |
| `wrangler.jsonc` | Worker config for `clinical-ai-backend` (`main: backend/CloudFlare.js`) |
| `workers/mcp-gateway/` | Second Worker (`alice-mcp`): MCP context/tools gateway with a service binding to the API Worker |
| `supabase/migrations/` | `20260603_session_clinical_fields.sql` (clinical columns on `public.sessions`) and `20260914_worksheet_submissions.sql` (storage behind `POST /client/worksheet`) — see §6.2 |
| `supabase/functions/` | Empty — reserved for Supabase edge functions |
| `ai-config/` | `mcp.json` (MCP server registration; contains a placeholder subdomain) and `prompts/` (`intake.txt`, `session.txt` — both empty) |
| `.cursor/config.json` | Cursor MCP client config pointing at the deployed gateway |
| `.github/copilot-instructions.md` | Agent rules: use the MCP gateway, never guess the DB schema |
| `AGENTS.md` | The agent contract for **every** CLI in this repo: the documentation rule (§14) plus the project rules |
| `.clinerules` | Cline's copy: tool-call format plus the same project rules |
| `scripts/check-docs.mjs` | `npm run docs:check` — fails a change that touches source without updating `documentation.md` (§14) |
| `.githooks/commit-msg`, `.github/workflows/docs-check.yml`, `.github/workflows/weekly-docs-audit.yml` | The local and CI gates that run and audit it; CI runs as a non-blocking warning with automated PR comments detailing uncommitted documentation gaps, and weekly audit generates debt reports for `DOCS: none` overrides; `.gitattributes` keeps the hook LF so the Git-for-Windows bash can read its shebang |
| `tests/` | `worker.test.mjs`, `pdf-export.test.mjs`, `hydration-guard.test.mjs` — dependency-free Node harnesses (§13.4) |

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
| Copy / open client link | `SessionNode` row actions (no store call) | `GET /client-link/:sessionId` (§5.2) with the clinician's bearer token, then clipboard or a new tab (§4.7) |

The sidebar UI is `components/sidebar/ClientNode.tsx` → `CaseNode.tsx` → `SessionNode.tsx`, with
`EditableName` inline rename. Each session row reveals three actions on hover: **Copy client link**
and **Open client link** — both mint a fresh signed link through `apiFetch`, so an expired token is
routed to `/login` rather than failing silently — and a `confirm()`-gated delete.
`components/clinical-folder-tree.tsx` and `components/sidebar/Sidebar.tsx` are unused alternates
(see §13).

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

Phase 1 does not become authoritative until the session payload has landed.
`components/vignette-generator.tsx` hydrates exactly once per session, keyed on
`[session, sessionHydratedId]` (§8.2) and latched in a `useRef`: `GET /client/:id` embeds only
`sessions(id,name)`, so the row that mounts the component is a content-less stub. A later store
write — blur-save, rename, the `PATCH` echo — therefore cannot reset the phase or discard unsaved
notes, and a failed `GET /sessions/:id` leaves Phase 1 empty rather than showing the stub.

`POST /generate/vignette` is the lighter alternative (`{ scenario, quiz, homework }`) used for the
plain vignette flow; it persists `vignette`, `homework`, `quiz` and `modality`.

### 4.6 Creating a clinic client

`ClientLanding` collects first / middle / last name, email, country code (default `+65`) and phone,
validates (email regex, digits only, 6–15 digits), then `POST /clients` with snake_case keys
(`first_name`, `middle_name`, `last_name`, `email`, `country_code`, `phone_number`) and refreshes
the list. The newly created client is *not* auto-opened — the clinician clicks it.

### 4.7 Client-facing material pages (public)

There is **one client link**: `/practice/<sessionId>?exp=…&sig=…`. It is the only page that reads the
narrow projection `GET /client-homework/:sessionId`, and it renders `practiceHomework` as a checklist.

- `app/practice/[sessionId]/page.tsx` → renders the `practiceHomework` checklist from
  `GET /client-homework/:id?exp=…&sig=…`.
- `app/homework/[sessionId]/page.tsx` → **legacy shim only**. Links minted before the consolidation
  (or bookmarked) still work: the page fetches nothing and forwards to `/practice/<id>` with
  `window.location.replace` plus `window.location.search` verbatim, so the signed `exp`+`sig` pair —
  the page's only credential — survives untouched and the dead URL stays out of the history.
- The projection still returns `{ sessionId, title, homework, quiz, vignette, practiceHomework }` —
  never `session_notes`, `analysis` or `riskFlags`. `vignette`, `quiz` and `homework` are no longer
  rendered by any page (§13.3); only `practiceHomework` reaches the client today.
- The clinician obtains the URL from `GET /client-link/:sessionId` (§5.2), from the **Copy Client
  Link** button in step 3 of `components/vignette-generator.tsx`, or from the session row's
  **Copy client link** / **Open client link** actions in the sidebar (§4.4). The Worker signs
  `v1|sessionId|exp` with HMAC-SHA256 and still returns `homeworkUrl`, `practiceUrl` and
  `expiresAt`; every UI consumer now uses `practiceUrl`.
- Without a valid `exp`+`sig` pair the route answers `403`, so a bare session UUID opens nothing
  (§13.1). `sessionId` must be at least 10 characters.

The link's signature, TTL and failure modes are specified in §5.2 (signing protocol).

---

## 5. HTTP API reference

Base URL: `https://clinical-ai-backend.neuvoteam.workers.dev`
(source: `lib/clinical-ai-api.ts`). All bodies and responses are JSON.

### 5.0 Caller authentication

**Every route requires `Authorization: Bearer <supabase access token>` except two public families:**

| Public | Why |
| --- | --- |
| `/auth/*` (`signup`, `login`, `me`) | No session exists yet, and `GET /auth/me` validates the token it is handed |
| `/client-homework/:sessionId` | Read by the client-facing pages without a login — but only with a valid `?exp=&sig=` signed link (§4.7, §5.2) |

`requireUser(request, env, cors, baseUrl)` performs the check by calling Supabase
`GET ${SUPABASE_URL}/auth/v1/user` with the anon key plus the caller's token — the same call
`GET /auth/me` has always made. Outcomes: `401 { error: "Missing token" }` when the header is absent,
`401` with Supabase's own body for a malformed or expired token, and
`503 { error: "Authentication unavailable" }` if Supabase cannot be reached. Nothing upstream runs
first: an unauthenticated request never reaches Supabase's REST API or Groq.

`OPTIONS` returns before the guard, so CORS preflight never needs a token, and CORS is an explicit
origin allowlist (`ALLOWED_ORIGINS`, §10.3) rather than `*`.

The Worker still authenticates *to* Supabase with its service-role key, so any authenticated clinician
can currently reach any client's rows — see §13.1 (open item).

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
| `GET` | `/client-link/:sessionId` | query `ttlDays?` (default `14`, clamped to `30`) | `200 { sessionId, ttlDays, exp, expiresAt, homeworkUrl, practiceUrl }` | `400 { error: "Invalid session ID" }`; `404 { error: "Session not found" }`; `500 { error: "PUBLIC_APP_URL is not configured" }`; `503 { error: "Client links are not configured" }` when `CLIENT_LINK_SECRET` is missing |

#### Client link signing (HMAC-SHA256)

Signed links are what make the client-facing pages safe to share by email or SMS without a login:

| Element | Value |
| --- | --- |
| Signed payload | `v1\|<sessionId>\|<exp>`, where `exp` is Unix seconds |
| Algorithm | HMAC-SHA256, key `CLIENT_LINK_SECRET` (Worker secret — §10.3); signature is base64url |
| URL shape | `<PUBLIC_APP_URL>/practice/<sessionId>?exp=<unix>&sig=<base64url>` — the only link in use. The response also carries `homeworkUrl` (`/homework/…`) for compatibility: that page forwards to `/practice/…` (§4.7) |
| TTL | `ttlDays` on the mint call; default **14 days**, hard ceiling **30 days** |
| Verification | `crypto.subtle.verify` (constant-time — never a string comparison) plus an `exp` check against the clock |
| Rejection | `403 { error: "This link is invalid or has expired. Please ask your clinician for a new one." }`, logged as `Client link rejected (<reason>)` with `missing` / `expired` / `bad_signature` / `not_configured` |
| Fail closed | With no `CLIENT_LINK_SECRET` — or one shorter than 16 characters — minting answers `503` and every client read answers `403`; there is no unsigned fallback |

Because the signature covers the `sessionId`, a link cannot be replayed against a different session;
because it covers `exp`, the expiry cannot be extended without the secret. The secret is trimmed on
read, so a trailing newline captured by a piped `wrangler secret put` cannot desynchronise signing from
verification. Minting is a clinician-only route, so the link origin is taken from `PUBLIC_APP_URL`
(falling back to the first `ALLOWED_ORIGINS` entry).

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
| `GET` | `/client-homework/:sessionId` | query `exp` + `sig` — **required**, see §5.2 | `200 { sessionId, title, homework, quiz, vignette, practiceHomework }` — the token-free projection | `403 { error: "This link is invalid or has expired…" }` for a missing, expired or tampered signature, and for a bare UUID; `400 { error: "Invalid session ID" }` when the id is shorter than 10 chars; `404` |

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
- **Unusable output counts as a failure.** A usable answer means "parsed *and* matching the contract":
  every route validates the parsed object against a minimum shape (`isUsableAnalysis` /
  `isUsableVignette` / `isUsablePracticePackage`) before accepting it. Valid JSON with missing required
  fields — or a missing `riskFlags`, which would otherwise read as "no risks" — is treated exactly like
  unparseable output. Each envelope carries `reason`, `parseError` (the `JSON.parse` message including
  the character offset — never clinical text), `finishReason`, `length`, `attempts` and `model`:

  | `code` | `reason` | Meaning |
  | --- | --- | --- |
  | `BAD_AI_RESPONSE` | `invalid_json`, `prose_wrapped_invalid_json`, `no_json_found` | The content was not usable JSON, even after the repair pass (§7.2) |
  | `AI_TRUNCATED` | `truncated` | `finish_reason: "length"` — the model ran out of output mid-object |
  | `BAD_AI_SHAPE` | `bad_shape` | The JSON parsed but did not match the contract |
  | `GROQ_ERROR` | – | Groq refused the request; `groqStatus` carries the HTTP status |

  The degraded `200` (`?allowDegraded=1`) carries the same fields plus `degraded: true` and `warning`,
  so a placeholder is never presented as a real formulation nor written to the database.
- **One corrective retry.** Before returning any envelope above, the handler retries **once** at
  `temperature: 0`, appending an explicit "your previous reply was not valid JSON…" turn, and asks for a
  larger `max_completion_tokens` when the first attempt looked truncated. The retry never fires for a
  `GROQ_ERROR` — a rate limit is not a formatting problem.

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
| `GET` | `/ai/probe` | Runs the **real** handler against the configured model and returns `{ ok, prompt, model, parse_ok, finish_reason, attempts, strategy, reason, parse_error, raw_sample, parsed, groq_error, failure }`. `?prompt=analyze\|generate\|package`, plus optional `?notes=` and `?modality=`. `parse_ok` means *accepted* (parsed **and** matching the contract), `strategy` is `strict` / `repaired` / `failed`, and `failure` is `"groq_error"`, `"parse_error"` or `null` — this is the single call that answers "why is generation not working". Always `200` |

All three are authenticated like every other route (§5.0) and need no body. When the AI looks broken,
check these before blaming the UI — each needs the clinician token:

```powershell
$h = @{ Authorization = "Bearer <access_token>" }
Invoke-RestMethod "https://clinical-ai-backend.neuvoteam.workers.dev/ai/models" -Headers $h
Invoke-RestMethod "https://clinical-ai-backend.neuvoteam.workers.dev/ai/health" -Headers $h
# then watch the Worker while clicking Generate:
npx wrangler tail --format pretty
```

`/ai/health` costs one small Groq completion per call, which is why it is guarded alongside the rest
rather than exposed for anonymous probes. If an unauthenticated uptime check is ever needed, add a
static, zero-cost `GET /ping` and exempt only that.

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
| Model | `env.GROQ_MODEL` — an `openai/gpt-oss-120b` var in `wrangler.jsonc`, falling back to the `MODEL` constant `openai/gpt-oss-20b` if the var is ever unset. Switched from 20b to 120b for JSON reliability (§7.2); both IDs are available to the account per `GET /ai/models`. The Llama 3.x IDs this code originally targeted (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) are now **Enterprise-only** on Groq and return `404 model_not_found` |
| Auth | `Authorization: Bearer ${env.GROQ_API_KEY}` |
| Temperature | `0.3` for `/analyze/session`, `0.6` for `/generate/vignette`, `0.5` for `/generate/practice-package`; a retry always uses `0` |
| Response format | `env.GROQ_RESPONSE_FORMAT` (plain var; unset ⇒ **`off`**): `off` = prompt-only, `json_object` = syntax-only JSON mode, `schema` = strict `json_schema`. Measured 2026-09-16 on 20b: `off` accepted 7/10 runs, `json_object` 2/5 (the model stopped after `homework`), `schema` 2/5 (Groq returned `400 failed_generation`). Contract *validation* (§7.2) runs in every mode; the strict schemas are `ANALYSIS_SCHEMA`, `VIGNETTE_SCHEMA` and `PRACTICE_PACKAGE_SCHEMA` |
| Reasoning | `reasoning_effort: "low"` for reasoning models (`isReasoningModel`), overridable with `GROQ_REASONING_EFFORT` — hidden reasoning tokens count against the tier's TPM, so this keeps headroom for the JSON itself |
| Output cap | `env.GROQ_MAX_TOKENS`, sent as `max_completion_tokens` (not the deprecated `max_tokens`) and unset by default — see the note in `wrangler.jsonc` for why capping the completion does not prevent a 429 |
| Rate limit | The on-demand tier allows **8,000 tokens/minute, 1,000 requests/day and 200,000 tokens/day** per model for both gpt-oss models. The limiter reserves the *prompt* tokens, and `/analyze/session` + `/generate/practice-package` each send the same notes, so note length is capped in the UI (`SESSION_NOTES_MAX_CHARS = 18000`, warn at `SESSION_NOTES_WARN_CHARS = 8000`; `lib/clinical-ai-api.ts`) |

### 7.1 Prompt contracts

Each handler sends a `system` message that demands **JSON only**, plus a `user` message containing the
modality (where relevant) and the clinician's notes.

| Handler | Output contract |
| --- | --- |
| `handleAnalyze` | `{ rationale, inferredModality: "CBT"\|"DBT"\|"ACT", riskFlags[{ label, severity, confidence, evidence[] }] }`. Prompt rules: focus on underlying mechanisms, extract verbatim evidence phrases, include only real risks |
| `handleGenerate` | `{ scenario, quiz[], homework[] }`. Rules: real psychological mechanisms, insight questions (not recall), precise/measurable homework, match modality strictly |
| `handleGeneratePracticePackage` | `{ homework[], scenario{ title, difficulty, situation, objectives[], coachTips[] }, quiz[{ question, answer, rationale }] }`. Rules: actionable measurable homework, role-play-supporting scenario, insight-reinforcing quiz |

### 7.2 Robustness

- `callGroq` returns a result object — `{ ok: true, model, content, finishReason }` or
  `{ ok: false, model, error: { status, message, raw } }` — and logs
  `Groq error: GROQ ERROR <status> <message> (model=<id>)`. It never throws. `extractGroqErrorMessage`
  lifts Groq's own `error.message` out of the body so both the log and the HTTP response carry the real
  reason (`model_not_found`, `invalid_api_key`, …) instead of a truncated blob.
- `generateJson` wraps that call with the response-format mode, the contract validator and the single
  retry; handlers then translate the outcome: **`502` by default**, or with `?allowDegraded=1` a `200`
  placeholder payload tagged `degraded: true` + `warning`. The router recognises a failure by checking
  for a `Response` and returns it **before** any persistence runs.
- `stripMarkdown` **unwraps** a fenced ```json block instead of deleting it. Deleting caused a real
  incident: any model that fenced its JSON had the answer thrown away, and the handler silently served
  the placeholder as though it were the formulation.
- `extractJsonObject` slices from the first `{` to the last `}`, parses, and — when that fails — runs
  `repairJson`, which escapes the JSON the model should have escaped: an inner `"` inside a string value,
  plus raw control characters. The in-string rule is that a `"` only *closes* a string when the next
  significant character is structural (`: , } ]` or end of input). `/ai/probe` reports which path
  succeeded as `strategy: "strict" | "repaired" | "failed"`. Measured on 20b this was the largest single
  residual fix: 3 of 10 runs died with `Expected ',' or ']' after array element in JSON at position 1395`
  — an unescaped quote inside a task string — and none fail that way after it.
- Hard-coded fallbacks (`"Clinical synthesis unavailable."`, `"Scenario unavailable."`, the default
  `Practice Scenario` object) are used **only** on the `?allowDegraded=1` path. They are never used to
  paper over a partial answer: a shape-invalid response becomes `BAD_AI_SHAPE` and nothing is written. A
  live run predating this validation stored `scenario.title: "Practice Scenario"` with an empty quiz;
  that can no longer happen.

### 7.3 Persistence side effects

Because a generation carrying a `sessionId` writes *before* responding, the client's follow-up
`PATCH /sessions/:id` is a second write of the same data. The PATCH is the call that guarantees the
camelCase `analysis` / `practicePackage` payload reaches the database; the generate-time write exists so
content survives even if the tab is closed mid-workflow. Only validated output reaches either write:
every failure envelope is returned *before* `persistSessionFields` / `saveSessionVersion` run, and the
`PATCH` handler stores the same contract-checked shapes (§6.3).

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
| `/homework/[sessionId]` | redirect shim | forwards to `/practice/<id>` keeping `?exp=&sig=` — legacy alias for links minted before the consolidation (§4.7) |
| `/practice/[sessionId]` | signed link | client-facing practice checklist — the one canonical client link (§4.7) |
| `/api/analyze/session` | API route | legacy Ollama bridge (§7.4) |

### 8.2 The authoritative store — `stores/useClientNavStore.ts`

A zustand store holding `client`, `clients`, `selectedClientId`, `selectedCaseId`,
`selectedSessionId`, `sessionHydratedId`, `loading` and `error`.

- **Reads** go through `/clients`, `/client/:id` and `/sessions/:id`; `normalizeSession` and
  `normalizeClientTree` convert snake_case DB rows into camelCase app state and coerce `homework` /
  `quiz` to arrays.
- **Writes are optimistic**: state is updated first, then the HTTP call runs; on failure only `error`
  is set — there is **no rollback**.
- `safeFetch` logs `🌐 SAFE FETCH: <url>` and, on failure, the URL plus the parsed body, then throws
  `data?.error || "Request failed"`. It delegates to `apiFetch` (`lib/auth.ts`), which attaches
  `Authorization: Bearer <alice_token>` to every clinician call and, on `401`, clears the token and
  routes to `/login` — the token is removed *before* navigating, so `/login` cannot bounce back into a
  401 loop. `ClientLanding`, `main-content`, `client-view` and `vignette-generator` use `apiFetch`
  directly for the same reason, while the two client-facing pages deliberately keep using plain
  anonymous `fetch`.
- `selectSession` records the choice via `setLastSession`, clears `sessionHydratedId`, re-fetches the
  session and then sets `sessionHydratedId` to its id. That flag is the deterministic "the payload has
  landed" signal, and it is needed because `GET /client/:id` embeds only `sessions(id,name)`: the tree
  row can exist — sharing the session's id — before its notes/analysis/practice_package are known.
  `lib/session-hydration.ts` (`decideSessionHydration`) is the consumer's rule: wait for the signal,
  then hydrate once per session, so a later write cannot re-derive the phase (§4.5, §8.5).
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

- `components/vignette-generator.tsx` is the largest client component: a 3-phase state machine that
  hydrates once per session through `lib/session-hydration.ts` (§8.2), a `Progress` bar, and PDF export
  through `lib/export-practice-pdf.ts` (dynamically imported, so `jspdf` stays out of the main
  bundle). The exporter builds the A4 document programmatically — the homework list only, matching
  what `/practice/[sessionId]` exposes — with explicit sRGB colours (the Tailwind v4
  `oklch()` tokens are mapped in its `COLORS` table), an exact-fit `wrapText()`, and page breaks derived
  from `A4.CONTENT_BOTTOM`, so text can neither overlap nor leave the sheet. Downloads are named
  `ALICE_PracticePackage_YYYYMMDD_ClientName.pdf` (`buildPracticePackageFileName`, which strips spaces and
  illegal characters and folds accents; an unusable name drops the segment) and the `fileName` option
  overrides it. `html2canvas` and the computed-style inlining shim it required were removed in favour of
  this approach; the hidden role-play/quiz blocks and the unreferenced `components/clinical-folder-tree.tsx`
  stub went with them, since neither had a consumer (the screen hid them and the PDF excludes them) and
  both were the only `tsc` errors. `npm run test:pdf` guards geometry, pagination, glyph hygiene and naming.
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
npm test             # worker + PDF + hydration suites (plain node, no dependencies)
npm run docs:check   # fails a change that touched source without documentation.md (§14)
```

- **Pick one package manager.** Both `package-lock.json` and `pnpm-lock.yaml` are committed. Mixing
  them produces large, noisy diffs; the lockfile you touch should be the one the team standardises on.
- `npm run lint` runs `eslint .`, but ESLint is not in `devDependencies` and there is no
  `eslint.config.mjs` / `.eslintrc.json`, so the command fails out of the box (§13).
- `npm test` runs the three dependency-free Node harnesses of §13.4; `npm run test:pdf` and
  `npm run test:hydration` run them individually. `npm run docs:check` is the documentation gate of
  §14 — it also runs as the `.githooks/commit-msg` hook in this clone (`core.hooksPath=.githooks`)
  and as the `docs-check` workflow.
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

| Variable | Secret? | Used for |
| --- | --- | --- |
| `SUPABASE_URL` | var | Base for `${url}/rest/v1` and `${url}/auth/v1` |
| `SUPABASE_ANON_KEY` | secret | GoTrue signup/login/user calls, including the `requireUser` token check (§5.0) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | All PostgREST reads/writes |
| `GROQ_API_KEY` | secret | AI routes |
| `CLIENT_LINK_SECRET` | **secret** | HMAC-SHA256 key for client links (§5.2). Must be ≥16 characters and is trimmed on read. Missing ⇒ minting `503`, client reads `403` (fail closed). Set with `npx wrangler secret put CLIENT_LINK_SECRET`; a local `wrangler dev` needs it in `.dev.vars` as well |
| `PUBLIC_APP_URL` | var | Origin the signed client links point at (e.g. `http://localhost:3000`); falls back to the first `ALLOWED_ORIGINS` entry |
| `ALLOWED_ORIGINS` | var | Comma-separated CORS allowlist. A request from an origin not listed receives no CORS header at all, so the browser blocks the response |
| `GROQ_MODEL` | var | The Groq model ID — currently `openai/gpt-oss-120b`; overrides the `MODEL` constant (`openai/gpt-oss-20b`). Change this, not the code, whenever Groq retires a model |
| `GROQ_RESPONSE_FORMAT` | var | `off` (default) / `json_object` / `schema` — see §7 |
| `GROQ_REASONING_EFFORT` | var | Optional override for the default `low` sent on reasoning models |
| `GROQ_MAX_TOKENS` | var | Optional; sent as `max_completion_tokens`. Unset by default — reasoning tokens plus the JSON document must fit the tier's 8,000 TPM |

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

### 11.3 Security invariants

- **Auth is default-on.** Every Worker route sits behind `requireUser` (§5.0) unless it is explicitly on
  the public list. Adding a public route requires a justification in §5.0 *and* a §13.1 entry.
- **Never widen the public projection.** The only token-free read is `/client-homework/:id`, returning
  `{ sessionId, title, homework, quiz, vignette, practiceHomework }` and gated by a signed link (§5.2).
  Adding `session_notes`, `analysis` or `riskFlags` to it would recreate the enumeration leak.
- **Secrets never reach the browser.** Verification happens in the Worker; the client only ever receives a
  finished URL. `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` and `CLIENT_LINK_SECRET` exist on the Worker
  runtime only.
- **Signature comparisons are constant-time** (`crypto.subtle.verify`), client links *fail closed* when
  the secret is missing or weak, and generated output is validated against a contract before it is
  persisted (§7.2) — a placeholder must never be stored as clinical content.

### 11.4 Java module rules (authoritative copy: `ARCHITECTURE.md`)

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

| Item | Status | Detail |
| --- | --- | --- |
| **Committed service-role key (rotate it)** | **OPEN** | A live `service_role` JWT was committed in `workers/mcp-gateway/wrangler.toml` `[vars]`, plus a stray `workers/mcp-gateway/Untitled` copy. Both are gone from the working tree and `git grep eyJhbGciOi` is clean, but the value is still in git history — **rotate it in Supabase** and re-set it with `wrangler secret put` (§10.4) |
| **Unauthenticated API** | **CLOSED** | Every route except `/auth/*` and the signed-link client endpoint now requires a Supabase bearer token (`requireUser`, §5.0). Verified live 2026-09-16: `GET /clients`, `GET /sessions/:id`, `PATCH /sessions/:id`, `GET /ai/health` and `GET /ai/models` all answer `401 { error: "Missing token" }` without one, and a malformed token gets Supabase's `bad_jwt` body. CORS is an explicit `ALLOWED_ORIGINS` allowlist, no longer `*` |
| **Client-page UUID enumeration** | **CLOSED** | `/homework/:sessionId` and `/practice/:sessionId` now require a signed, expiring link (§5.2). Verified live: a bare session UUID answers `403`, as do tampered, expired and cross-session signatures, and the old anonymous `GET /sessions/:id` read of a full clinical row is gone. The pages themselves now receive only `{ title, homework, quiz, vignette, practiceHomework }` |
| **Cross-tenant read by an authenticated clinician** | **OPEN** | The Worker still authenticates *to* Supabase with the service-role key, so any signed-in clinician can reach any client's rows. The fix is least privilege — pass the caller's JWT to PostgREST and add RLS policies — not another route guard |
| **`POST /client/worksheet` trusts `clientId` from the body** | **OPEN** (partially mitigated) | The route is no longer anonymous, but it still trusts `clientId` in the payload, so a signed-in clinician can write a submission against another clinician's client. It needs an ownership check on the session/client |
| **No refresh-token flow** | **OPEN** | `alice_token` expires (~1h). `apiFetch` now intercepts the resulting `401` and routes to `/login`; a silent refresh (`refresh_token` + a `POST /auth/refresh` route) is the follow-up — the login response already returns `refresh_token`, it is simply discarded |

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
| Unrendered client projection fields | `GET /client-homework/:id` still returns `vignette`, `quiz` and `homework`, but since the two client pages were consolidated (§4.7) no UI renders them — the client sees only the `practiceHomework` checklist. The worker test asserts the full key set, so the fields are deliberate for now; decide whether to surface them again or narrow the projection |
| Duplicate theme | `styles/globals.css` duplicates `app/globals.css`; only the latter is referenced by `components.json` and imported by `app/layout.tsx` |
| Empty README | `README.md` is zero bytes; this document is not linked from anywhere in the repo |

### 13.4 Tooling and process gaps

| Item | Detail |
| --- | --- |
| Tests | `npm test` → `node tests/worker.test.mjs && node tests/pdf-export.test.mjs && node tests/hydration-guard.test.mjs`: dependency-free harnesses. The worker one stubs `globalThis.fetch` (Groq, Supabase REST and `/auth/v1/user`) and drives the Worker's real `fetch` handler; 32 checks cover the AI contract/retry/repair, the auth guard, persistence payloads and client-link signing. Its Supabase stub models the session→client ownership chain that `checkSessionAccess` walks, and asserts "nothing was persisted" against writes only, because every `sessionId`-bearing AI route reads the session and its owner first. `npm test` is green as of 2026-09-18 (32 worker + 12 PDF + 15 hydration checks). `tests/hydration-guard.test.mjs` imports the real guard (`lib/session-hydration.ts`) under Node's type stripping and locks the race, the blur-save bounce, the placeholder advisory and the failed-fetch fallback; no harness renders React, so component-level regressions still rely on review |
| Partial CI | `.github/workflows/docs-check.yml` runs `npm run docs:check` on push and pull requests as a non-blocking warning (`continue-on-error: true`), posting PR comments detailing uncommitted documentation gaps, while `.github/workflows/weekly-docs-audit.yml` audits `DOCS: none` overrides weekly. Nothing builds, lints or runs `npm test` on push yet |
| Docs gate | `scripts/check-docs.mjs` (`npm run docs:check`, the `.githooks/commit-msg` hook, and the workflow above) checks changes touching `app/ components/ stores/ lib/ hooks/ backend/ workers/ supabase/migrations/ tests/` or root configs against `documentation.md`. In local `.githooks/commit-msg`, the failure output explicitly directs callers to bypass via `DOCS: none`. In CI, the gate issues a non-blocking warning and comments on PRs without failing the build, while weekly cron audits log `DOCS: none` bypass debt. `DOCS: none` in the commit message is the bypass, `DOCS_CHECK=off` the local env override |
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

### 13.6 Closure record — security & reliability phase (2026-09-16)

Deployed Worker versions on `clinical-ai-backend`, oldest first:

| Version | Change |
| --- | --- |
| `98d42111` | Output-shape contracts, honest failure codes, one corrective retry |
| `3f0af673` | Strict `json_schema` attempt (Groq answered `400 failed_generation` in ~40% of runs) |
| `9d8de72b` | `GROQ_RESPONSE_FORMAT` knob, default `off` |
| `cc9e0700` | JSON repair pass (`repairJson`) — closed the unescaped-quote failures |
| `d475d48c` | Caller authentication guard (`requireUser`) + narrow client projection |
| `8ab16d22` | `GROQ_MODEL` → `openai/gpt-oss-120b` |
| `c59c822a` | HMAC-signed, expiring client links + `PUBLIC_APP_URL` |

Evidence for the two closed risk vectors is recorded in §13.1. `npx wrangler rollback` returns to the
previous version; the model is a plain var, so reverting it is a config change (§7).

**Deliberately frozen for this phase** (do not start without a new decision): RLS / least-privilege reads,
the refresh-token flow, `POST /client/worksheet` ownership checks, and the repo-hygiene items in §13.3
and §13.4 (CI, lint config, dead code).

### 13.7 Closure record — UI hydration race (2026-09-18)

| Item | Detail |
| --- | --- |
| Symptom | Opening a session that already held content could stick on Phase 1 with an empty notes box |
| Cause | `components/vignette-generator.tsx` read `useClientNavStore.getState()` once, with deps `[sessionId, caseId]`, while `selectSession` sets the selection *before* `GET /sessions/:id` resolves (§8.2). `GET /client/:id` embeds only `sessions(id,name)`, so the row that mounted the component was a stub sharing the session's id — the arriving payload changed no dependency, so the effect never re-ran |
| Fix | `sessionHydratedId` on the store (set only after the merge) plus `lib/session-hydration.ts`, consumed by the effect with a `useRef` latch: hydration is one-shot per session, so a later write cannot re-derive the phase or discard unsaved notes |
| Evidence | `npx tsc --noEmit` exit 0; `npm test` green — including `tests/hydration-guard.test.mjs` (15 checks: the guard table, the race, the blur-save bounce, the placeholder advisory, the failed fetch, remount, re-select), which imports the real guard rather than a copy; commit `c902331` |
| Note | `c902331` also carried an unrelated client-link documentation rewrite, so its diff is not a record of this change |

Anything that changes the store's shape or the hydration contract must update §8.2 (and §4.5/§8.5 if
the phases change) — see §14.

---

## 14. Maintaining this document

**Every agent must update this file in the same change.** Pick the section from the table below;
`npm run docs:check` (the `.githooks/commit-msg` hook, plus the `docs-check` workflow) checks a change that
touches source without it, and `DOCS: none` in the commit message is the bypass. `AGENTS.md`
states the same rule for every CLI in this repo.

| If you… | Update |
| --- | --- |
| Add, rename or remove a Worker route | §5 tables (method, path, body, response, errors), §4 flows if the client consumes it, and the tool table in §9 if you expose it over MCP |
| Add a column or table | §6 (`Table`, columns used by code, JSON shapes), and add a migration file in `supabase/migrations/` |
| Change the Groq model, temperature or a prompt contract | §7 |
| Change the auth model, or add a public route | §1 (access model), §5.0 (guard + public list), §13.1 |
| Rotate `CLIENT_LINK_SECRET`, or change link TTLs | §5.2 (signing protocol) and §10.3 |
| Change how a client link is minted, delivered or routed | §1 (access model), §4.4 and §4.7 (flows), §5.2 (response fields), §8.1 (routes) |
| Change the store's shape, or the session-hydration contract | §8.2 (and §4.5/§8.5 if the phases change) |
| Change an agent rule, a hook, a workflow or a script | §2 (repo map) and §14 itself (this table + Document ownership) |
| Close a security or reliability risk | §13.1 (status) and §13.6, or the newest §13.x closure record (version + evidence) |
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
| `documentation.md` (this file) | Product behaviour, architecture of the running system, APIs, data model, setup, gaps, and the maintenance contract above |
| `AGENTS.md` | The agent contract for every CLI in this repo: the documentation rule plus the project rules |
| `.clinerules` | Cline's tool-call format; mirrors the `AGENTS.md` rules |
| `.github/copilot-instructions.md` | Copilot's MCP gateway instructions |
| `scripts/check-docs.mjs`, `.githooks/commit-msg`, `.github/workflows/docs-check.yml`, `.github/workflows/weekly-docs-audit.yml` | Enforcement and audit of this section — plain Node, no dependencies, non-blocking CI warning with automated PR comments and weekly debt reports |

Keep this file honest: if a claim here no longer matches the code, the code wins — fix the document in
the same commit that changes the behaviour. Never paste secret values (keys, tokens, JWTs, connection
strings) into this file; refer to variable names only.












