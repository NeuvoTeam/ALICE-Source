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
| `app/` | Routes and layouts. `layout.tsx` sets `ALICE` metadata and applies both Geist fonts — sans via `${geist.className}` and mono via the `${geistMono.variable}` class (`--font-geist-mono`) on `<body>`; `app/globals.css` holds the Tailwind v4 theme; `app/global-error.tsx` is the root error boundary |
| `app/dashboard/page.tsx` | Authenticated shell — client landing → sidebar + clinician/client view |
| `app/login`, `app/signup`, `app/forgot-password` | Clinician auth screens (inline styles, not shadcn) |
| `app/client-login`, `app/test-auth` | Stubs / diagnostics (see §13) |
| `app/practice/[sessionId]` | Client-facing material view (the `practiceHomework` checklist) — no login, but only reachable with a signed, expiring link (§4.7, §5.2) |
| `app/practitioner/tasks/[id]/review` | Practitioner Review Gateway — review CBT submissions side-by-side with reflection canvas outputs, append notes, adjust labels, request revisions, and approve/lock records (§5.8) |
| `app/homework/[sessionId]` | Legacy redirect shim — forwards an already-shared `/homework` link to `/practice/<id>`, carrying `?exp=&sig=` across unchanged (§4.7) |
| `app/cases/[caseId]/sessions/[sessionId]` | Bookmark-compat redirect shim — selects the session in the store then `router.replace('/')` |
| `app/api/analyze/session/route.ts` | **Legacy/dev-only** Next.js route calling a local Ollama instance. Not used by the shipped UI (see §7) |
| `components/` | Feature components: `ClientLanding`, `main-content`, `vignette-generator`, `client-view`, `dashboard-shell`, `dashboard-sidebar`, `auth-guard`, `logout-button`, `theme-provider`, plus `components/sidebar/*` (the client→case→session tree) |
| `components/tasks/` | Practice-task module: `DynamicTaskForm` (Typeform-style orchestrator with debounced auto-save + error banner + human-approval gate), `ActivityScheduleForm` (Handout 1 — weekly grid on desktop, day-accordion on mobile), `ThreeCsForm` (Handout 10 — progressive-disclosure 3-step thought record). All are `"use client"` and call the Worker via `apiFetch` — never Supabase directly |
| `components/canvas/` | Reflection canvas module: `ReflectionCanvas` (HTML5 Canvas with native Pointer Events, stylus detection, palm rejection, Bézier rendering, undo/redo, background variants — seeded from `initialData` once, at mount only; a parent swapping the document must remount it with a `key`, §13.4 lint rank 8c); `canvasUtils.ts` (rendering + compression pipeline — PNG then JPEG fallback to enforce ≤ 2 MB / ≤ 1 200 px); `canvasTypes.ts` (types + constants). Uploads go through `POST /reflections/upload` via `apiFetch` |
| `components/ui/` | Generated shadcn/ui primitives (new-york style). Treat as vendored — regenerate rather than hand-edit |
| `hooks/` | `use-clinical-workspace.ts` (local-only workspace — see §8), `use-mobile.ts`, `use-toast.ts` |
| `lib/` | API base constant, auth helpers, Supabase tripwire, session/hierarchy models, the session-hydration guard (§8.2), utils |
| `stores/` | `useClientNavStore.ts` — the **authoritative** zustand store for client/case/session state |
| `types/` | Shared types: `Client` (`types/index.ts`); practice-task domain types in `types/tasks.ts` (DB row interfaces, JSONB shapes, normalised app-state types, action I/O shapes) |
| `public/` | Icons, logos, placeholders |

### Backend and infrastructure

| Path | Contents |
| --- | --- |
| `backend/CloudFlare.js` | The entire API Worker (`clinical-ai-backend`): caller authentication, CRUD, AI orchestration, Supabase proxy. Single file, ~2,820 lines |
| `wrangler.jsonc` | Worker config for `clinical-ai-backend` (`main: backend/CloudFlare.js`) |
| `workers/mcp-gateway/` | Second Worker (`alice-mcp`): MCP context/tools gateway with a service binding to the API Worker |
| `supabase/migrations/` | `20260603_session_clinical_fields.sql` (clinical columns on `public.sessions`) and `20260914_worksheet_submissions.sql` (storage behind `POST /client/worksheet`) — see §6.2 |
| `supabase/functions/` | Empty — reserved for Supabase edge functions |
| `ai-config/` | `mcp.json` (MCP server registration; contains a placeholder subdomain, §13.3). `prompts/` was an empty directory holding two zero-byte files (`intake.txt`, `session.txt`), deleted in the 2026-10-10 dead-file sweep (zero-byte class) — §13.3 |
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
The action rows and the inline-rename pencil are rendered only on hover or keyboard focus
(`hidden group-hover:flex group-focus-within:flex`), so a session name gets the full row
width when idle instead of being permanently truncated to make room for icons that are not
drawn; every interactive element in the tree carries a visible `focus-visible` ring. The
whole shell takes its surface, text and hover colours from the `sidebar-*` tokens
(`app/globals.css`) rather than hardcoded Tailwind greys, so it follows the dark theme.
`components/clinical-folder-tree.tsx` was an unused alternate; it was deleted on 2026-10-10 once the per-file reference search proved no consumer (see §13.3).

The shell that hosts the sidebar — `components/dashboard-shell.tsx`, which
`app/dashboard/page.tsx` renders in place of the old `<div className="flex h-screen">` row — is
responsive. At `lg` (1024px) and above it is the static 256px `<aside>` the desktop has always
shown, with no extra chrome. Below `lg` it becomes a left `Sheet` (Radix Dialog) behind a 56px
top bar carrying a real **Open navigation** button with `aria-expanded`; the sheet hosts the same
`DashboardSidebar` element — never a second copy — traps focus, closes on Escape or its built-in
close button, and returns focus to the trigger. Choosing a client or a session from the drawer (a
change of `selectedClientId` or `selectedSessionId`) closes it, so it cannot keep covering the
region it just navigated to, and crossing the breakpoint closes it too. `lg` — the media query
Tailwind emits for it, `@media (min-width:64rem)` — is the single boundary for the CSS and the JS
alike: `SheetContent` is rendered unconditionally (Radix mounts the portal only while the sheet is
open, so a closed drawer costs no DOM), which means the trigger is never reachable without the
drawer content it opens, at any width, fractional or not. No store, route, request
or auth behaviour changed: the shell only reads those two store fields.

### 4.5 The AI workflow (notes + modalities → analysis → structured task)

```
Step 1       clinician enters session notes & selects 1-3 modalities (CBT, ACT, DBT) in components/vignette-generator.tsx
             │
             ├─ POST /analyze/session?allowDegraded=1  { sessionNotes, clientId, sessionId }
             │     → { rationale, inferredModality, riskFlags[] }
             │
             ├─ POST /generate/structured-task?allowDegraded=1  { sessionContext: sessionNotes, activityFormat: "auto", modalities: selectedModalities }
             │     → returns recommended task JSON schema payload (auto-selected from notes and modalities)
             │
             ├─ lib/tasks.ts upsertTaskDraft() → persists draft to practice_task_submissions
             │     → updates generatedSubmissionId
             │
             └─ store.saveSessionContent(caseId, sessionId, { sessionNotes, analysis, modality })
                   → PATCH /sessions/:sessionId  (optimistic UI, then reconcile with response)
             │
Step 2       Clinician reviews formulation & recommended task
             ├─ Option to override Activity Format and trigger targeted regeneration
             ├─ Interactive dynamic render:
             │     • reflection_prompt → <ReflectionCanvas clientId={clientId} submissionId={generatedSubmissionId} />
             │     • otherwise → <DynamicTaskForm taskType={activityFormat} initialData={...} submissionId={generatedSubmissionId} />
             └─ Copy signed client link for assignment
```

Phase 1 (Step 1) does not become authoritative until the session payload has landed.
`components/vignette-generator.tsx` hydrates exactly once per session, keyed on
`[session, sessionHydratedId]` (§8.2) and latched in a `useRef`: `GET /client/:id` embeds only
`sessions(id,name)`, so the row that mounts the component is a content-less stub. A later store
write — blur-save, rename, the `PATCH` echo — therefore cannot reset the phase or discard unsaved
notes, and a failed `GET /sessions/:id` leaves Phase 1 empty rather than showing the stub.

In Step 1, clinicians choose up to 3 evidence-based modalities (`CBT`, `ACT`, `DBT`) alongside session notes.
`components/modality-selector.tsx` renders that choice as a **dropdown of checkboxes** (Radix `Popover` +
the shared `Checkbox`): the trigger reads `Clinical Modalities (1-3)` followed by a live summary of the
current selection, and the menu lists every value of `MODALITIES`. The control enforces the same contract as
`ModalitiesSchema` — at least one, at most three, no duplicates, with `["CBT"]` as the fallback for an empty
or invalid value — and when three are selected the remaining rows are disabled behind an in-menu hint. The
component only reports the new array through `onChange`; the request schema is unchanged.
Clicking **Analyze & Recommend** automatically infers the formulation and generates the most fitting structured activity.
In Step 2, clinicians review the formulation and generated activity, with an override dropdown to re-generate into
alternative formats (`activity_log`, `thought_record`, `two_choice_worksheet`, `reflection_prompt`) if desired.

`POST /generate/vignette` is the lighter alternative (`{ scenario, quiz, homework }`) used for the
plain vignette flow; it persists `vignette`, `homework`, `quiz` and `modality`.

### 4.6 Creating a clinic client

`ClientLanding` collects first / middle / last name, email, country code (default `+65`) and phone,
validates (email regex, digits only, 6–15 digits), then `POST /clients` with snake_case keys
(`first_name`, `middle_name`, `last_name`, `email`, `country_code`, `phone_number`) and refreshes
the list. The newly created client is *not* auto-opened — the clinician clicks it.

### 4.7 Client-facing material pages (public)

There is **one client link**: `/practice/<sessionId>?exp=…&sig=…`. It is the only page that reads the
narrow projection `GET /client-homework/:sessionId`.

- `app/practice/[sessionId]/page.tsx` → renders the clinician's chosen activity via the `practiceTask` object (using `DynamicTaskForm` or `ReflectionCanvas`). The client cannot change the activity type, and client-side persistence is deliberately disabled (`persist={false}`). If no structured activity is found, it falls back to the `practiceHomework` checklist.
- `app/homework/[sessionId]/page.tsx` → **legacy shim only**. Links minted before the consolidation
  (or bookmarked) still work: the page fetches nothing and forwards to `/practice/<id>` with
  `window.location.replace` plus `window.location.search` verbatim, so the signed `exp`+`sig` pair —
  the page's only credential — survives untouched and the dead URL stays out of the history.
- The projection returns `{ sessionId, title, homework, quiz, vignette, practiceHomework, practiceTask }` —
  never `session_notes`, `analysis` or `riskFlags`. `practiceTask` carries the structured activity fields, whilst `practiceHomework` is the fallback array. The previous cross-session `practice_task_submissions` query has been removed.
- The clinician obtains the URL from `GET /client-link/:sessionId` (§5.2), from the **Copy Client
  Link** button in step 2 of `components/vignette-generator.tsx`, or from the session row's
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
| `POST` | `/generate/structured-task` | `{ sessionContext, activityFormat, modalities, sessionId? }` | `{ task_type, ... }` matching the `StructuredTask` Zod schema |

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

### 5.8 Practice-task submission routes

All practitioner task routes require a clinician bearer token and verify `checkClientAccess` before touching any
row. They are declared **above** the catch-all `if (method === "POST")` AI block in `backend/CloudFlare.js`.
Frontend callers use the server-action wrappers in `lib/tasks.ts`; types live in `types/tasks.ts`.

| Method | Path | Body / notes | Response |
| --- | --- | --- | --- |
| `POST` | `/tasks/submissions` | `{ id?, client_id, practitioner_id?, task_type, form_data }` — omit `id` to create, supply it to update a draft (`practitioner_id` is enforced from `authUser.id` on INSERT) | Upserted `practice_task_submissions` row. `409` if `id` exists with status ≠ `draft` |
| `POST` | `/tasks/submissions/:id/commit` | Empty body — `id` is in the path | Updated row with `status: "pending_practitioner_review"`. Appends a `status_audit_log` row (best-effort). `409` if status ≠ `draft` |
| `GET` | `/tasks/submissions/:id/bundle` | — | `{ submission, reflections[], practitioner_notes[], audit_log[] }` — all related rows in one round-trip. `audit_log` is best-effort (empty array on failure) |
| `POST` | `/tasks/submissions/:id/notes` | `{ practitioner_id?, notes }` | Newly created `submission_practitioner_notes` row. Notes are append-only |
| `POST` | `/tasks/submissions/:id/approve` | Empty body — `id` is in the path | Updated row with `status: "approved"`, `reviewed_at: ISO timestamp`. Immutability lock applies. Appends `status_audit_log` row. `409` if already approved |
| `POST` | `/tasks/submissions/:id/request-revision` | Empty body — `id` is in the path | Updated row with `status: "revision_requested"`. Appends `status_audit_log` row. `409` if status is approved |
| `PATCH` | `/tasks/submissions/:id/label` | `{ label: string }` (max 200 chars) | Updated row with label merged into `form_data.label`. `409` if status is approved |

### 5.9 Reflection image upload

Requires a clinician bearer token. Enforces 2 MB server-side as a defence-in-depth layer on top of the client-side compression already applied by `ReflectionCanvas`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/reflections/upload` | `multipart/form-data`: `file` (PNG/JPEG ≤ 2 MB), `submission_id`, `client_id` | `{ imageUrl, sizeBytes }`. Storage path: `reflections/<clientId>/<submissionId>/<timestamp>.ext`. Also inserts a `client_reflections` row (best-effort). `413` if > 2 MB; `415` for non-image MIME |

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
| `practice_task_submissions` | `id`, `client_id`, `practitioner_id`, `task_type`, `form_data` (jsonb), `status`, `reviewed_at`, `created_at`, `updated_at` | `POST /tasks/submissions`, `POST /tasks/submissions/:id/commit`, `GET /tasks/submissions/:id/bundle` |
| `submission_practitioner_notes` | `id`, `submission_id`, `practitioner_id`, `notes`, `created_at` | `POST /tasks/submissions/:id/notes`, `GET /tasks/submissions/:id/bundle` |
| `client_reflections` | `id`, `submission_id`, `client_id`, `canvas_data` (jsonb), `image_url`, `notes`, `created_at` | `GET /tasks/submissions/:id/bundle` (read-only from the Worker; written by client pages) |
| `status_audit_log` | `id`, `submission_id`, `previous_status`, `new_status`, `changed_by_user_id`, `changed_at` | Written by `POST /tasks/submissions/:id/commit`, `:id/approve`, and `:id/request-revision` (best-effort, non-fatal). **Read** by `GET /tasks/submissions/:id/bundle` — exposed as `audit_log[]` in the bundle and used by the Practitioner Review Gateway to surface the true reviewer identity from `changed_by_user_id` |

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
| `practice_package` | `{ homework: string[], scenario: { title, difficulty: "easy"\|"medium"\|"hard", situation, objectives: string[], coachTips: string[] }, quiz: { question, answer, rationale }[] }` (see `lib/practice-package.ts`) — **but the column is a union of two shapes, `StoredPracticeTask = StructuredTask \| PracticePackage`**: `/generate/structured-task` stores a structured practice task here (the client then saves the enriched task itself) and `/generate/practice-package` stores the package shape, so every reader must discriminate with the shared `isStructuredTask` guard rather than assume one (§13.4, lint rank 8h) |
| `vignette` | Plain string (scenario text) |

### 6.4 `form_data` JSONB shapes on `practice_task_submissions`

The `task_type` column is the discriminant; `types/tasks.ts` exports a `FormData` discriminated union, and — because `form_data` also holds the **seed** a clinician's generator upserts as a draft row before the client fills the form in (`components/vignette-generator.tsx`) — the column type itself is `SubmissionFormData = FormData | StructuredTask` (§13.4, lint rank 8h).

| `task_type` | Key fields |
| --- | --- |
| `activity_log` | `activity_date` (YYYY-MM-DD), `activity_description` (either plain text **or** `JSON.stringify(WeeklySchedule)` when submitted by `DynamicTaskForm`), `pleasure_rating` (0–10), `mastery_rating` (0–10), `notes?` |
| `thought_record` | `situation`, `automatic_thought`, `emotions: [{label, intensity}]` (0–100), `evidence_for`, `evidence_against`, `balanced_thought`, `outcome_emotion_intensity` (0–100), `notes?` |
| `behavioural_experiment` | `hypothesis`, `experiment_description`, `predicted_outcome`, `actual_outcome`, `what_i_learned`, `notes?` |
| `two_choice_worksheet` | `title`, `prompts: [{ question, options: [string, string] }]`, `answers: [0\|1\|null]`, `reflection`, `reflection_prompt`, `notes?` |

> **`activity_log` detail.** `DynamicTaskForm` stores the full weekly grid as `JSON.stringify(WeeklySchedule)` in `activity_description`, where `WeeklySchedule` is `Record<"Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun", Record<string, { activity: string; moodRating: number }>>`. The Practitioner Review Gateway detects the JSON prefix and renders it as a day-by-day grid rather than raw text.

### 6.5 Practice-task TypeScript types (`types/tasks.ts`)

Key composite types used in app state (all camelCase per AGENTS.md normalisation convention):

| Type | Shape | Notes |
| --- | --- | --- |
| `SubmissionBundle` | `{ submission: NormalisedSubmission, reflections: NormalisedReflection[], practitionerNotes: NormalisedPractitionerNote[], auditLog: NormalisedAuditLogEntry[] }` | Assembled by `fetchSubmissionBundle` in `lib/tasks.ts`; returned by `GET /tasks/submissions/:id/bundle` |
| `NormalisedAuditLogEntry` | `{ id, submissionId, previousStatus, newStatus, changedByUserId, changedAt }` | Normalised camelCase form of `status_audit_log` rows. The Practitioner Review Gateway uses `changedByUserId` from the `approved` entry to surface the true reviewer identity (not a heuristic) |
| `NormalisedSubmission` | `{ id, clientId, practitionerId, taskType, formData, status, reviewedAt, createdAt, updatedAt }` | Normalised form of `practice_task_submissions` |
| `NormalisedReflection` | `{ id, submissionId, clientId, canvasData, imageUrl, notes, createdAt }` | Normalised form of `client_reflections` |
| `NormalisedPractitionerNote` | `{ id, submissionId, practitionerId, notes, createdAt }` | Normalised form of `submission_practitioner_notes` |

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
| `handleGenerateStructuredTask` | `{ task_type, ... }` matching the `StructuredTask` schema (`activity_log`, `thought_record`, `reflection_prompt`, `two_choice_worksheet`). Prompt provides strict flat JSON skeletons; pre-Zod normalisation (`normalizeStructuredTask`) flattens nested hallucinations (e.g. `catch`/`check`/`correct` or `type` vs `task_type`) |

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
- `stripMarkdown` **unwraps** a fenced ```json block instead of deleting it, and strips reasoning/thinking tags (`<think>...</think>`) emitted by reasoning models before extracting curly braces. Deleting caused a real
  incident: any model that fenced its JSON had the answer thrown away, and curly braces inside thought blocks previously corrupted root object slicing.
- `extractJsonObject` slices from the first `{` to the last `}`, parses, and — when that fails — runs
  `repairJson`, which escapes the JSON the model should have escaped: an inner `"` inside a string value,
  plus raw control characters. The in-string rule is that a `"` only *closes* a string when the next
  significant character is structural (`: , } ]` or end of input). `/ai/probe` reports which path
  succeeded as `strategy: "strict" | "repaired" | "failed"`. Measured on 20b this was the largest single
  residual fix: 3 of 10 runs died with `Expected ',' or ']' after array element in JSON at position 1395`
  — an unescaped quote inside a task string — and none fail that way after it.
- `normalizeStructuredTask` resolves common model discrepancies for structured task generation (such as
  an open-source model emitting `type` instead of `task_type`, nesting 3 C's keys under `catch`/`check`/`correct`
  sub-objects, emitting arrays of strings for `evidence_for`/`evidence_against`, or omitting default emotion keys)
  prior to `StructuredTaskSchema.safeParse` validation so legitimate generations are safely accepted without 502 bad_shape failures.
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
  both were the only `tsc` errors. (Corrected 2026-10-10: that change removed the hidden blocks and the stub's
  *usage*, but the file itself stayed in the tree — `ClinicalFolderTreeProps` was defined in `ed4b794`, so the
  type errors were fixed rather than removed by deletion. The file was deleted for real in the 2026-10-10
  dead-file sweep, §13.3.) `npm run test:pdf` guards geometry, pagination, glyph hygiene and naming.
- The generator's shell is token-based: the card surface is `bg-card`, the header band and inline
  notices use `border-border` / `bg-muted/50` with explicit `dark:` variants for the amber, red, blue
  and green callouts, and the action buttons normalise to `rounded-xl` (the two hero radii,
  `rounded-[2rem]` on the notes area and `rounded-[2.5rem]` on the card and the document preview, are
  deliberate). Horizontal space adapts below `sm`: the card/header/notice padding drops from `px-8`/
  `mx-8`/`p-10` to `px-5`/`mx-5`/`p-6`, and the override-format and Back/Export rows stack
  (`flex-col sm:flex-row`) instead of squeezing. The "Client Practice Task" preview keeps its white
  paper colours on purpose — it is a document preview and stays legible in either theme.
- `components/modality-selector.tsx` is the only modality picker: a `Popover` trigger labelled
  `Clinical Modalities (1-3)` with the live selection appended, opening a checkbox list built from
  `MODALITIES` (`lib/ai/schemas.ts`). It is presentational only — the 1–3 / no-duplicate rule lives in
  the component's `normalizedSelected` memo and `toggleModality`, and the parent
  (`components/vignette-generator.tsx`) still owns the array. The prop contract
  (`selectedModalities`, `onChange`, `disabled`) is unchanged.
- `components/main-content.tsx` dynamically imports the generator with `ssr: false`; its History tab
  lists `GET /sessions?clientId=…` rows keyed on `created_at`. The region is `min-w-0` with
  `p-4 sm:p-6`, so the `flex-1` column can shrink at narrow widths instead of forcing horizontal
  overflow; the header wraps rather than clipping a long client name, and **Change Client** is the
  shared `Button variant="outline"` rather than a raw `<button>`. Error banners and flag pills carry
  explicit `dark:` variants so they stay legible when the dark theme is applied.
- `components/dashboard-shell.tsx` owns the responsive sidebar (§4.4). `lg` — the media query
  Tailwind emits for it, `@media (min-width:64rem)` — is the single source of truth: the
  `SheetContent` of the left `Sheet` is rendered unconditionally, so whenever the `lg:hidden` top bar
  (and its **Open navigation** trigger) is reachable the drawer has content, at any width including a
  fractional one produced by page zoom. The JS mirrors only the *negation* of that same query: the
  `isMobile` flag (`matchMedia("(min-width: 64rem)")` inverted) decides which single slot holds the
  one `DashboardSidebar` — the static `hidden lg:flex` wrapper, or the sheet below `lg` — and a
  `resize` listener closes the drawer only when that boundary is actually crossed. `isMobile` starts
  `false`, so the server render and the first client render agree and there is no hydration
  mismatch; the `hidden lg:flex` on the static slot means the pre-effect frame cannot paint a 256px
  sidebar at 390px, and a viewport change inside the same mode (an on-screen keyboard, say) leaves
  the drawer open. The drawer is
  `w-64 max-w-[85vw] gap-0 p-0`,
  carries sr-only `SheetTitle` / `SheetDescription`, and the top bar holding the trigger is
  `lg:hidden`, so no chrome is added on desktop. The repo's `hooks/use-mobile.ts` was not used: its
  768px breakpoint would not line up with the `lg` chrome, leaving the sidebar unreachable between
  768px and 1023px. Measurements and screenshots: `debug_reports/UI_MOBILE_DRAWER_20261010.md`.
- `components/auth-guard.tsx` renders `Loading...` until `GET /auth/me` resolves, then either renders
  the children or hard-redirects to `/login`.
- Toast feedback is wired to `hooks/use-toast.ts`, and `app/layout.tsx` mounts `<Toaster />` from
  `components/ui/toaster.tsx` inside `<body>` immediately after `{children}`, so every `toast()` call
  renders — for example the "Could not open client" notice in `app/dashboard/page.tsx`.
  `components/ui/toaster.tsx` reads `@/hooks/use-toast`, the same module the call sites use.
  `components/ui/sonner.tsx` exports a second `Toaster`, but no call site uses sonner, so it is
  deliberately not mounted — the file was deleted in the 2026-10-10 dead-file sweep (§13.3), which leaves the
  `sonner` dependency in `package.json` with no importer of any kind: recorded in §13.3, not removed, because a
  dependency change is its own decision. The Toaster is a client component, so the toast host mounts client-side
  while `app/layout.tsx` stays a server component: the server-rendered HTML is unchanged.
  The destructive variant's foreground is `--destructive-foreground: oklch(1 0 0)` in **both** themes —
  the same white the `Button` and `Badge` destructive variants paint with a literal `text-white` —
  measured at **4.76:1** on the light `--destructive` (`#e7000b`) and **10.06:1** on the dark one
  (`#82181a`); `ToastDescription` also carries `group-[.destructive]:opacity-100`, because its
  inherited `opacity-90` composites the description against the toast background and capped it at
  4.00:1 (`debug_reports/UI_DESTRUCTIVE_FOREGROUND_20261010.md`). Before 2026-10-10 the light pair was
  the same value twice, i.e. red text on red at 1.00:1.

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
imported — `src/index.ts` inlines both; those two are **kept**, because an unused non-empty module is a design
decision rather than junk. The zero-byte `src/memory.ts` was deleted in the 2026-10-10 dead-file sweep
(zero-byte class) — §13.3.

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
npm run lint         # ESLint 9 flat config; exits 0 — see the warning baseline below
npm test             # worker + PDF + hydration suites (plain node, no dependencies)
npm run docs:check   # fails a change that touched source without documentation.md (§14)
```

- **Pick one package manager.** Both `package-lock.json` and `pnpm-lock.yaml` are committed. Mixing
  them produces large, noisy diffs; the lockfile you touch should be the one the team standardises on.
- `npm run lint` runs `eslint .` against the committed flat config `eslint.config.mjs` (ESLint 9 +
  `eslint-config-next` 16.2.4, pinned to the installed `next`). It lints 120 files (`npx eslint . -f json`, the count of matched files: 122 before this card's two deletions) — `app/`,
  `components/`, `hooks/`, `lib/`, `stores/`, `workers/`, `tests/`, `scripts/` plus `types/`,
  `backend/` and the root configs — and exits **0** with a documented baseline of 0 errors /
  4 warnings (2026-10-10, after lint rank 8h — see §13.4 for the per-rank history). Every exception behind those numbers is listed
  rule-by-rule inside the config file and summarised in §13.4. Next 16 dropped `next lint`, so
  ESLint is driven directly.
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
- **Lint gate:** `npm run lint` (`eslint .` against `eslint.config.mjs`) is real and must exit 0.
  It reports 0 errors / 4 warnings on the current tree (§13.4, after rank 8h); the seven rule
  entries behind that number are each downgraded to `warn` (so their findings stay printed and
  counted) or scoped to the files that need them, each with a one-line reason in the config — see
  §13.4. Prefer fixing a site over widening an exception, and never add a blanket ignore of real
  source to make the gate pass.
- **Styling:** Tailwind v4 utility classes with `cn()` from `lib/utils.ts`
  (`clsx` + `tailwind-merge`). No Tailwind config file — the theme lives in `app/globals.css` via
  `@theme`/CSS variables. Scanned sources are explicitly bounded using `@import 'tailwindcss' source(none);`
  and `@source` paths (`app`, `components`, `lib`, `hooks`, `stores`) to prevent PostCSS/Turbopack
  from traversing workspace junctions (e.g. `.obsidian_sync`) outside the root. Auth screens (`login`,
  `signup`, `forgot-password`, `ClientLanding`) instead use inline `style` objects for a legacy look;
  match the surrounding file rather than converting styles mid-feature.
- **Fonts:** the sans family is applied by `geist.className` on `<body>`; monospaced UI (clinical values, audit codes, tabular metrics) uses the `--font-mono` token, which names the face **literally** — `--font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;` — so the real face wins when it loads and the stack's own `ui-monospace` takes over when it does not. `app/layout.tsx` keeps `variable: "--font-geist-mono"` on the loader and `${geistMono.variable}` on `<body>`, which is what emits the `@font-face` rules and the variable class; nothing reads the variable any more. Next's generated `--font-geist-mono` value still ends in its own metric-adjusted `"Geist Mono Fallback"` (`src: local(Arial)`, proportional) and that face is still emitted, but it is no longer in the `--font-mono` chain. Resolved 2026-10-10 (rank 8i) — the shadowed generic keyword rank 8b measured now takes effect on the webfont-failure path; §13.4.
- **UI primitives:** shadcn/ui, new-york style, neutral base, RSC + TS enabled, lucide icons
  (`components.json`). Add new primitives with the shadcn CLI into `components/ui/`; do not hand-roll
  equivalents.
- **Forms/validation:** `react-hook-form` + `zod` + `@hookform/resolvers` are available, but the
  shipped auth/client forms use `useState` + `alert()`. Follow the pattern of the file you are editing.

#### Corner-radius scale

Corner radii come from one ladder: `app/globals.css` defines `--radius: 0.75rem` and derives
`--radius-sm/md/lg/xl` from it (8 / 10 / 12 / 16px), and Tailwind v4 still supplies `rounded-xs`
(2px), `rounded-4xl` (32px) and `rounded-full`. Pick the token by role, not by eye:

| Role | Class | Computed here | What uses it |
| --- | --- | --- | --- |
| indicator | `rounded-xs` | 2px | checkboxes, chart swatches, tooltip arrows, resize handles, dialog/sheet close buttons |
| chip | `rounded-sm` | 8px | small inline badges, `<code>` chips, kbd |
| control | `rounded-md` | 10px | buttons, inputs, selects, textareas, icon buttons — the shadcn control default |
| panel | `rounded-lg` | 12px | containers nested inside a surface: inline callouts, table cells, inner rows |
| surface | `rounded-xl` | 16px | page-level cards and panels, modals, dropdown panels — the shadcn `Card` default |
| hero | `rounded-4xl` | 32px | the one decorative hero surface per view plus its immediate inner blocks |
| pill | `rounded-full` | — | pills, avatars, progress bars, switches, sliders, round icon buttons |

- **`rounded-2xl` is banned.** In this theme it computes to 1rem — byte-identical to `rounded-xl` —
  so the two classes are indistinguishable and the choice between them is noise.
- **Off-ladder values are out.** `rounded-3xl` (24px) and the bare `rounded` utility (4px, *not* the
  themed `rounded-sm`) were removed everywhere. Two arbitrary forms survive, both justified:
  `rounded-[inherit]` in `components/ui/scroll-area.tsx` (functional inheritance, not a value) and
  `rounded-[calc(var(--radius) - 5px)]` in `components/ui/input-group.tsx` (derived from the theme
  token, so it cannot drift).
- **Hero is deliberate and singular:** at most one `rounded-4xl` surface per view — the
  `VignetteGenerator` hero with its composer, its result card and the note inside it, plus the
  practice-session content card. Nothing else may use that token.
- **The legacy inline-styled auth screens** (`login`, `signup`, `forgot-password`, `ClientLanding`)
  keep their `style` objects (see the Styling bullet above) and carry the token's px value directly:
  `borderRadius: 16` is `rounded-xl`, `borderRadius: 10` is `rounded-md`.
- **`components/ui/**` already follows the ladder** — it is the reference implementation. Do not
  re-radius a vendored primitive for taste.
- Adding a radius? Add a row to this table first. The scale was unified on 2026-10-10 (card
  `t_923af17e`, on top of `8272327`); the changed-site list and the before/after measurements are in
  `debug_reports/UI_RADIUS_SCALE_20261010.md`.

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
  `{ sessionId, title, homework, quiz, vignette, practiceHomework, practiceTask }` and gated by a signed link (§5.2).
  The addition of `practiceTask` is a narrow, activity-only widening that strictly filters allowed keys and excludes all clinical fields. Adding `session_notes`, `analysis` or `riskFlags` to it would recreate the enumeration leak.
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
| Toasts now render | `app/layout.tsx` mounts `<Toaster />` from `components/ui/toaster.tsx` after `{children}`, so `toast()` calls such as the "Could not open client" notice in `app/dashboard/page.tsx` reach the DOM (§8.5) |
| Destructive toast text (fixed 2026-10-10) | `--destructive-foreground` was the **same value as `--destructive`** in the light theme, so the app's only `toast()` call (`app/dashboard/page.tsx`, `variant: "destructive"`) painted red on red — measured 1.00:1 on the rendered toast, and 2.63:1 in the dark theme. Both themes are now `oklch(1 0 0)` (4.76:1 light / 10.06:1 dark), and `ToastDescription` carries `group-[.destructive]:opacity-100` because its inherited `opacity-90` capped the description at 4.00:1 (§8.5) |

### 13.3 Duplication, drift and dead code

| Item | Detail |
| --- | --- |
| Two hierarchy models | `stores/useClientNavStore.ts` (Worker-backed, in use) vs `lib/clinical-hierarchy.ts` + `hooks/use-clinical-workspace.ts` + `lib/vignette-restore.ts` (localStorage-only, unused by the dashboard). Keeping both invites edits to the wrong one |
| Unused components | `components/clinical-folder-tree.tsx` is a truncated stub referencing an undefined `ClinicalFolderTreeProps`; it is the only unreferenced component left. The other three — `components/session-history-panel.tsx`, `components/sidebar/Sidebar.tsx` and `components/sidebar/EditableText.tsx` — were deleted on 2026-10-10 after a repo-wide reference search (static imports, dynamic `import()`, `next/dynamic`, barrels, tests, scripts, Tailwind `@source` globs and Markdown) came back empty for each; see `debug_reports/DEAD_COMPONENT_DELETION_20261010.md`. `components/ui/use-toast.ts` duplicates `hooks/use-toast.ts` and stays for now — out of scope. All four remaining members of this row are gone as of 2026-10-10: `components/clinical-folder-tree.tsx`, `components/ui/use-toast.ts` (dup of `hooks/use-toast.ts`), `components/ui/use-mobile.tsx` (dup of `hooks/use-mobile.ts`) and `components/ui/sonner.tsx` (a second `Toaster` no call site mounted) were each proved unreferenced by a per-file repo-wide search and deleted; the `sonner` dependency is now unused and is a listed recommendation, not a change. Full evidence: `debug_reports/DEAD_FILE_SWEEP_20261010.md` |
| Hard-coded API URLs | `components/ClientLanding.tsx`, `app/login/page.tsx` and `app/signup/page.tsx` repeat the Worker URL instead of importing `CLINICAL_AI_API_BASE` |
| Unused MCP sources | `workers/mcp-gateway/src/tools.ts` and `src/context.ts` are never imported (the gateway inlines both) — **kept**, pending a decision on whether the gateway should use them; a non-empty unused module is not junk. The zero-byte `src/memory.ts` was deleted in the 2026-10-10 zero-byte sweep |
| Empty placeholders | `supabase/functions/`, `public/placeholder-*`. The two zero-byte `ai-config/prompts/` files (`intake.txt`, `session.txt`) were deleted in the 2026-10-10 zero-byte sweep, leaving that directory empty on disk and untracked in Git; nothing in the repo ever read them |
| Stale MCP config | `ai-config/mcp.json` still points at `alice-mcp.YOUR-SUBDOMAIN.workers.dev`, unlike `.cursor/config.json` |
| Gateway package manifest | `workers/mcp-gateway/package.json` declares no dependencies and no scripts, so there is no `dev`/`deploy` shortcut |
| Schema not fully migrated | `session_versions` (written on every save) and `sessions.practice_package` exist only in the live database — no migration in-repo |
| Legacy Ollama route | `app/api/analyze/session/route.ts` (§7.4) |
| Unrendered client projection fields | `GET /client-homework/:id` now projects the chosen structured activity via the `practiceTask` field, rendered on the signed-link page with no client-side persistence. It still returns `vignette`, `quiz` and `homework` unused. The unscoped `practice_task_submissions` fallback was removed to close a cross-session disclosure. |
| Duplicate theme | `styles/globals.css` duplicates `app/globals.css`; only the latter is referenced by `components.json` and imported by `app/layout.tsx` (verified 2026-10-10 as **dead**: no source file imports `styles/`, it is absent from `.next/static`, and the rendered `/login` computes `--background` `#f6f9fb` and `--radius` `.75rem` — `app/globals.css`'s values, not `#ffffff` / `.625rem`. It was **deleted** on 2026-10-10 by the dead-file sweep that this row was waiting for — see `debug_reports/DEAD_FILE_SWEEP_20261010.md`) |
| Front door (README) | The root `README.md` was zero bytes and was deleted in the 2026-10-10 zero-byte sweep, leaving a fresh clone with no front door at all. Rewritten 2026-10-10 as a deliberately short, repo-derived front door — what ALICE is, the stack, the local run steps and the gates that exist — pointing at this document for the real documentation and at `debug_reports/` for the evidence trail. The deleted zero-byte copy remains recoverable from history (`git show 3b191e4:README.md`) |
| Root one-shot scripts | `patch-cloudflare.js`, `patch-tasks.js` and `patch-vignette.js` were one-shot source-patching utilities sitting in the repo root; no file imports or runs them. The only reference to any of them anywhere was the ESLint config's `files:` override (`eslint.config.mjs:41`), which now matches no file — that override is deliberately left in place for the lint triage. Deleted 2026-10-10 |
| Editor backup | `scripts/dispatch-inbox.ps1.bak-20261001-161325` was an editor backup of `scripts/dispatch-inbox.ps1`, which is live (`scripts/run-silent.vbs` runs it hidden via PowerShell). The `.bak` copy was referenced by nothing. Deleted 2026-10-10 |
| Tracked Gradle build state | `.gradle/` is tracked even though it is Gradle's own project cache (locks, hash bins, `cache.properties`). Its two zero-byte `gc.properties` files (`9.2.0/`, `vcs-1/`) were deleted in the 2026-10-10 zero-byte sweep; the remaining six files were untracked on 2026-10-10 (card `t_25d97d78`) with `git rm --cached` — the index entry is gone, every file stays on disk — and `.gradle/` was added to `.gitignore`, which did not cover it before. None of the six is a config, a wrapper or a `gradle.properties`; all are build state (three binary `.lock` files, `fileHashes.bin`, a 1-byte `last-build.bin`, and Gradle's generated `buildOutputCleanup/cache.properties`, `gradle.version=9.2.0`) |

### 13.4 Tooling and process gaps

| Item | Detail |
| --- | --- |
| Tests | `npm test` → `node tests/worker.test.mjs && node tests/pdf-export.test.mjs && node tests/hydration-guard.test.mjs`: dependency-free harnesses. The worker one stubs `globalThis.fetch` (Groq, Supabase REST and `/auth/v1/user`) and drives the Worker's real `fetch` handler; 32 checks cover the AI contract/retry/repair, the auth guard, persistence payloads and client-link signing. Its Supabase stub models the session→client ownership chain that `checkSessionAccess` walks, and asserts "nothing was persisted" against writes only, because every `sessionId`-bearing AI route reads the session and its owner first. `npm test` is green as of 2026-09-18 (32 worker + 12 PDF + 15 hydration checks). `tests/hydration-guard.test.mjs` imports the real guard (`lib/session-hydration.ts`) under Node's type stripping and locks the race, the blur-save bounce, the placeholder advisory and the failed-fetch fallback; no harness renders React, so component-level regressions still rely on review |
| Partial CI | `.github/workflows/docs-check.yml` runs `npm run docs:check` on push and pull requests as a non-blocking warning (`continue-on-error: true`), posting PR comments detailing uncommitted documentation gaps, while `.github/workflows/weekly-docs-audit.yml` audits `DOCS: none` overrides weekly. Nothing builds, lints or runs `npm test` on push yet |
| Docs gate | `scripts/check-docs.mjs` (`npm run docs:check`, the `.githooks/commit-msg` hook, and the workflow above) checks changes touching `app/ components/ stores/ lib/ hooks/ backend/ workers/ supabase/migrations/ tests/` or root configs against `documentation.md`. In local `.githooks/commit-msg`, the failure output explicitly directs callers to bypass via `DOCS: none`. In CI, the gate issues a non-blocking warning and comments on PRs without failing the build, while weekly cron audits log `DOCS: none` bypass debt. `DOCS: none` in the commit message is the bypass, `DOCS_CHECK=off` the local env override |
| Lint gate (added 2026-10-10, `t_95d7f790`) | `npm run lint` → `eslint .` against `eslint.config.mjs`: an ESLint 9 flat config extending `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, with `eslint-config-next` pinned to the installed `next` 16.2.4. It lints 130 files and exits **0**: 0 errors / 98 warnings (tree `cb3ac3a`). After the 2026-10-10 dead-file sweep (§13.3) the same command reports the same **0 errors** and **91 warnings** — every one of the seven removed findings sat in a deleted file. Its `patch-*.js` CommonJS override now matches no file; it is left for the lint triage, which owns `eslint.config.mjs`. The gate install deliberately did not remediate source — its first run was 73 errors / 29 warnings — so it encodes seven documented exceptions, each with a one-line reason in the config: `@typescript-eslint/no-explicit-any` → `warn` (51 sites of accumulated `any` at the gate install; 50 after rank 8a removed one incidentally in `components/vignette-generator.tsx`; **8 after rank 8e** — 7 in that same generator and 1 in `components/tasks/DynamicTaskForm.tsx`, left in place as recorded findings because removing them surfaces a genuine payload-shape error) and **0 after rank 8h**, which resolved that dual-shape conflict head-on (see the rank-8h record below), so this downgrade is now **dead** and deleting it is an open operator decision on the same standing as `react-hooks/refs` / `react-hooks/purity` / `react/no-unescaped-entities`, `react-hooks/set-state-in-effect` → `warn` (14 sites of the set-state-in-effect pattern), `react-hooks/refs` → `warn` (originally 1 site, `ReflectionCanvas.tsx`; **0 sites after rank 8c**, so the downgrade is now dead and is proposed for deletion at rank 8f), `react-hooks/purity` → `warn` (1 site, `Math.random` in `components/ui/sidebar.tsx`; **0 sites after rank 8d**, which deleted that file, so this downgrade is dead too and is likewise proposed for deletion at rank 8f), `react/no-unescaped-entities` → `warn` (2 one-line apostrophe escapes, both escaped at rank 8f, so the downgrade is now dead too and is also an open operator decision), `@typescript-eslint/no-require-imports` off for the three root CommonJS `patch-*.js` maintenance scripts (the override matched no file after those scripts were deleted and was itself deleted as dead config at rank 8f, clearing 0 findings), a scoped `import/no-anonymous-default-export` → `["warn", { allowObject: true }]` for `backend/**/*.js` + `workers/**/*.ts` (rank 8f: the `wrangler` module-worker entry shape is an object literal whose members are named, while an anonymous `export default function () {}` in those globs still reports — verified with throwaway probes), and `@typescript-eslint/ban-ts-comment` off under `backend/` (the Worker's deliberate `@ts-nocheck`). Downgraded rules stay visible in every run rather than being ignored. Deliberately **not** wired into `.githooks`: a pre-commit lint step against this baseline would block every future commit. The 91-warning baseline was triaged on 2026-10-10 into a classified register — every finding assigned to class A (correctness bug), B (real defect, low impact), C (dead code), D (type/style) or E (false positive / config gap / moot), each with a recommended action, an effort estimate and a "can it bite a clinician" verdict, plus a ranked fix plan: `debug_reports/LINT_TRIAGE_20261010.md`. Raw post-card-6 lint output: `debug_reports/lint_triage_post_card6_20261010.txt`. The triage changed no code and no rule: it is a proposal for the operator. **Rank 1 of that plan was executed on 2026-10-10** (card `t_c2aa216a`): the 15 dead bindings of register rows C1–C6 and C8–C14 (`generateStructuredTask`, `getDefaultActivity`, `sessionContext`/`setSessionContext`, `reflectionPrompt`/`setReflectionPrompt`, `catch (err)`, `clientId`, `Upload`, `drawBackground`, `prev`, `activeTab`, `loading`, `actionTypes`, `copyFile`) and the 3 stray empty template literals at EOF of `components/main-content.tsx`, `components/sidebar/CaseNode.tsx` and `components/sidebar/ClientNode.tsx` were deleted across 10 files, and `activeTab` was also dropped from the `MainContent` call site (`app/dashboard/page.tsx`). The same command now reports 0 errors / **72 warnings** on that tree. The drop is **19, not the register's projected 18**: the register counted the C4 line only as its two `no-unused-vars` findings, but that line also carried one `@typescript-eslint/no-explicit-any` which the register had budgeted to its rank-5 `any` sweep — so that sweep now targets **50** sites, not 51, and the "51 sites" figure in the config exception above stays stale until rank 5 lands. C7 (`geistMono`) was deliberately left untouched (§7.1 rank 8b). Raw before/after lint, `tsc`, `npm test`, `npm run build` and the 13-route build diff: `debug_reports/gates_lint_8a_20261010.txt`. Rank 8b (2026-10-10, `t_c2816da0`) then applied the C7 font. `app/layout.tsx` gives the Geist Mono loader `variable: "--font-geist-mono"` and puts `${geistMono.variable}` on `<body>` beside `${geist.className}`; `app/globals.css`'s `@theme inline` token is now `--font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;` (the sans token is untouched). `npm run lint` on that tree is **0 errors / 71 warnings** — one `no-unused-vars` cleared. The built stylesheet's rule is `.font-mono{font-family:var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace}` and `--font-geist-mono` itself is emitted as `"Geist Mono", "Geist Mono Fallback"`. Two measured corrections to the triage register's §5.1: (a) the `Geist Mono` `@font-face` rules were **already emitted before** the change — Next 16.2.4 (Turbopack) writes them for the loader call whether or not the loader's class is used — so pre-change `.font-mono` was already monospaced wherever the webfont loaded; the real pre-change defects were the missing generic fallback and the dead binding. (b) The new generic `monospace` keyword is nevertheless **shadowed on the webfont-failure path**: Next's generated value of `--font-geist-mono` ends in its own `"Geist Mono Fallback"` face (`src: local(Arial)`, proportional), which wins ahead of `ui-monospace`. Measured with `*.woff2` blocked, 14/14 review-page `.font-mono` elements render proportionally before *and* after (advance test 47.84px vs 203.22px; Arial wins), while the stack's own tail `ui-monospace, SFMono-Regular, Menlo, monospace` measures monospaced (87.97px/87.97px) — so the degradation guarantee is one family-list edit away, and it is an operator call because it trades away Next's metric-adjusted fallback. `adjustFontFallback: false` was tested and does **not** remove that face under Turbopack 16.2.4. Evidence: `debug_reports/gates_lint_8b_20261010.txt`, `css_8b_before_after_20261010.txt`, `font_8b_measure_*.json` and the two screenshots `font_8b_review_webfont_{loaded,blocked}_20261010.png`. **Rank 8b's operator call — rank 8i, card `t_eebc2dbb` — was resolved on 2026-10-10.** The operator answered the call above ("how much work is it to reorder? if it's not going to break anything and best practice, reorder"), so the token no longer routes the stack through Next's variable: `app/globals.css`'s `@theme inline` token is now `--font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;` — **one line in one file** — and `app/layout.tsx` is **unchanged** (`variable: "--font-geist-mono"` on the loader and `${geistMono.variable}` on `<body>` still emit the faces and the variable class). The mechanism was confirmed **before** the change shipped, not assumed: the emitted `@font-face` declares the family name `Geist Mono` literally (six subset rules, in a font CSS chunk whose content-hashed name — `037.tcc7jhmtv.css` — is unchanged across the before, after and shipped builds, so the face inventory and its media urls are identical on both sides of the change), and dropping `var(--font-geist-mono)` from the token does **not** stop the faces being emitted — the AFTER build still carries all six `Geist Mono` faces plus the `Geist Mono Fallback` shim, and `.geist_mono_d6617093-module__z61v7q__variable{--font-geist-mono:"Geist Mono", "Geist Mono Fallback"}` is still emitted (now unreferenced by the utility). The emitted rule goes from `.font-mono{font-family:var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace}` to `.font-mono{font-family:Geist Mono,ui-monospace,SFMono-Regular,Menlo,monospace}` and Tailwind's `--default-mono-font-family` mirrors it; the sans token (`--font-sans: 'Geist', 'Geist Fallback';`) and the `<body>` class are untouched. **Both states were measured, not narrated**, in a real Chromium run against the production build with `window.fetch` stubbed (synthetic non-PHI fixtures) and `*.woff2` blocked through CDP, across **three** surfaces — the review page's 14 `.font-mono` elements (rank 8b's own population, reproduced element-for-element: same classes, same rendered texts), the `ReflectionCanvas` toolbar glyph (three `font-mono text-xs` spans, reached through the real `/practice/:id` page) and the chart-tooltip consumer (`components/ui/chart.tsx:236`, mounted on a throwaway `/fontprobe` route because no shipped route renders a chart): **loaded state unchanged — 18/18 monospaced at Geist Mono's 96px/96px in both builds**; **blocked state fixed — 0/18 monospaced before (47.84px/203.22px, Arial through the shim) → 18/18 monospaced after (87.97px/87.97px, the stack's own `ui-monospace` tail)**, with `document.fonts.check('16px "Geist Mono"')` False and the shim still *present* in the blocked AFTER run yet no longer reached — which is the point: it is out of the chain, so the generic keyword takes effect on the webfont-failure path for the first time. **The trade, stated plainly:** Next's metric-adjusted fallback is what prevents layout shift while the webfont loads; a literal family list gives up that adjustment in exchange for a genuinely monospaced failure state — the shim's own metrics are exactly what squashed Arial's 87.97px tail onto 47.84px/203.22px. That trade is the whole cost: **1 line, 1 file, ~3 minutes of measurement**, which is the honest answer to "how much work is this" — the change is trivial and the decision was the work. Nothing else moved: the harness route was deleted before the commit and is absent from the shipped build, the route list is byte-identical to rank 8h's 13 routes (md5 `bab5456e751481302dfcd14942ada88c`, empty diff), `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15 = 62/62, `npm run lint` **unchanged at 0 errors / 4 warnings on the same 120 linted files** (the four retained `set-state-in-effect` sites, no rule moved), `npm run docs:check` exit 0. Evidence: `debug_reports/font_8i_css_before_after_20261010.txt` (both rules, both `@font-face` inventories, the variable class), `font_8i_measure_{before,after}_20261010.json` (per-element computed family + the advance test, both states, all three surfaces), `tsc_8i_20261010.txt`, `test_8i_20261010.txt`, `build_8i_20261010.txt`, `routes_8i_after_20261010.txt`, `lint_8i_20261010.txt`. Executed under the delegation protocol: **`agy` (Antigravity CLI, `Gemini 3.1 Pro (High)` — no Claude engine) authored both edits** — the one-line token change and the throwaway probe route — from two written briefs; the reviewing agent wrote the briefs, renamed the probe folder out of App Router's private `_`-prefix namespace (which would otherwise have excluded it from routing), drove the CDP measurement on both builds, deleted the harness, re-ran every gate on the shipped tree, and made the commit. **Rank 3 of that plan — rank 8c, card `t_a948efaf` — was executed on 2026-10-10** and touched one file, `components/canvas/ReflectionCanvas.tsx`. (1) **B16**: `const [historyLen, setHistoryLen] = useState(strokesRef.current.length)` was a ref read on the render path — React evaluates the initialiser argument on *every* render and discards all but the first result — and is now `useState(() => initialData?.strokes?.length ?? 0)`, reading the same prop the ref is seeded from. (2) **B1**: the `useImperativeHandle` dependency array was `[background]`, so the handle closed over the `clientId` / `submissionId` props as of the last `background` change; `uploadReflection()` falls back to those closed-over props when called with no arguments (`submissionIdParam || submissionId`), so a caller relying on the fallback could attach a reflection image to a **stale client or submission**. The array is now `[background, clientId, submissionId]`. Both sites carry an in-place comment; no caller and no test scaffolding were added for `uploadReflection()` — it still has **zero callers**, and the change removes the latent path rather than exercising it. `npm run lint` on that tree is **0 errors / 69 warnings** (71 − 2, exactly the two intended findings). `react-hooks/refs` is now at **zero** sites, which is why the `react-hooks/refs` → `warn` downgrade above is dead and is proposed for deletion at rank 8f: removing it restores the rule to the **`error`** severity that `eslint-plugin-react-hooks` 7.0.0's `recommended-latest` config assigns (`eslint --print-config` on a probe config without the exception block reports severity 2, against 1 with it). `react-hooks/exhaustive-deps` goes 2 → **1** site and **is not a local override at all** — it is the upstream `warn` that `eslint-config-next` inherits from the plugin's `recommended` config, so rank 8c's second acceptance question has no config change to propose for it; the one remaining site is register row B10 (`components/main-content.tsx:89`, missing `fetchVignettes`). Both changes were verified in a real Chromium harness (`scratch/rc-harness`, untracked) that mounts the shipping component beside the pre-fix source extracted verbatim from `git show HEAD:components/canvas/ReflectionCanvas.tsx`, with `window.fetch` stubbed and synthetic non-PHI fixtures: the **A/B seed value is identical** (3 seeded strokes → `Undo (3)` / `Redo (0)` / "3 strokes" on both builds; no `initialData` → `Undo (0)` on both), all four mutation→counter pairs hold under real CDP mouse input (commit → `Undo (n+1)`, `Redo (0)`; undo → `Undo (n−1)`, `Redo (1)`; redo → back to `Undo (n)`, `Redo (0)`; commit after an undo discards the redo branch → `Redo (0)`; clear → `Undo (0)`, `Redo (0)`, Undo/Redo/Clear all disabled and the placeholder restored) with the DOM counters matching `exportVectorData().strokes.length` and `hasContent()` at every step, and the **B1 A/B is decisive**: after re-rendering both variants with `clientId=client-NEW` / `submissionId=submission-NEW` and `background` unchanged, a no-argument `uploadReflection()` posts `client_id=client-NEW` + `submission_id=submission-NEW` from the fixed build and the **stale** `client-OLD` / `submission-OLD` from the pre-fix build — the mis-attribution path reproduced and closed. Evidence: `debug_reports/gates_lint_8c_20261010.txt`, `lint_8c_{before,after}_20261010.txt`, `test_8c_20261010.txt`, `build_8c_after_20261010.txt`, `routes_8c_diff_20261010.txt` (empty — the route list is byte-identical to rank 8b's 13 routes), `lint_8c_reflectioncanvas_diff_20261010.txt` and `lint_8c_harness_evidence_20261010.json`. The register's adjacent §5.2 observation — that the canvas never re-syncs `strokesRef` if `initialData` changes after mount — is recorded as a **deliberate limitation, not a defect**: `initialData` is read once, at mount (as is `background`, from the same prop), because the undo/redo stacks are per-session state and adopting new props mid-session would silently discard the user's in-progress strokes; a parent that needs to load a different document remounts the component with a `key`. Neither current call site passes `initialData` (`app/practice/[sessionId]/page.tsx:208` passes no props at all; `components/vignette-generator.tsx:692` passes only `clientId` / `submissionId`), so no caller needs the behaviour. **Rank 4 of that plan — rank 8d, card `t_eaef274e` — was executed on 2026-10-10**: `components/ui/sidebar.tsx` (register row B4) and `components/ui/carousel.tsx` (B5) were deleted after a per-file reference proof of their own — the basename searched case-insensitively across every tracked file and again across the whole working tree, static `@/components/ui/...` and relative import forms, dynamic `import()` / `next/dynamic`, the repo's only two barrels (`components/canvas/index.ts`, `components/tasks/index.ts` — neither reaches `ui/`), `tsconfig.json` paths, `components.json`, `eslint.config.mjs`, the Tailwind `@source` globs (`../app`, `../components`, `../lib`, `../hooks`, `../stores` under `source(none)`) and every Markdown file. The only hits outside `debug_reports/` prose were this row's own predecessor text, the stale `eslint.config.mjs` comment, and `package.json`'s `embla-carousel-react` entry. Raw searches: `debug_reports/lint_8d_refs_20261010.txt`. `npm run lint` goes **69 → 67**, exactly the two intended findings — `react-hooks/purity` 1 → 0 (`Math.random()` in `SidebarMenuSkeleton`) and `react-hooks/set-state-in-effect` 12 → 11 (the carousel's `onSelect(api)` effect) — with `no-explicit-any` (50), `react/no-unescaped-entities` (2) and `react-hooks/exhaustive-deps` (1) unchanged and no new or increased finding; `eslint .` matches 120 files, down from 122 (both counted with `-f json`; the 130 in the gate-install note below is that older tree's count, not this one's). The stale comment at `eslint.config.mjs:30` that named `components/ui/sidebar.tsx` as the `Math.random` site was corrected to record the zero-site state and to hand the dead downgrade to rank 8f; the rule itself is untouched, because config changes are 8f's scope (its `react-hooks/set-state-in-effect` comment still says "14 sites across 13 files" against a measured 12 → 11 — also left for 8f). The Tailwind build is the load-bearing check, and it was measured rather than assumed: deleting the files shrinks the emitted stylesheet from 152 763 to 141 957 bytes (104 individual selectors, all utilities whose only occurrences were in the two deleted files), while a token-by-token cross-check of all 7 483 class candidates in the 118 remaining live files found **zero** tokens whose rule existed before the deletion and is missing after it — the live sidebar's `focus-visible:ring-sidebar-ring`, `border-sidebar-border`, `h-9`, `bg-sidebar` and friends all survive, so nothing live was leaning on the deleted kit. `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15, `npm run build` exit 0 with a byte-identical 13-route list (md5 `8dca323846944e45a21742d7a25eac1d` on both sides). Three follow-on findings recorded rather than actioned, because the register's ranked plan has no slot for them and dependencies/dead-code adjudication is an operator call: `components/ui/skeleton.tsx`, `components/ui/tooltip.tsx` and `hooks/use-mobile.ts` each had exactly one importer before this change — the deleted `components/ui/sidebar.tsx` — so all three are now unreferenced (the shell was already documented as not using `use-mobile`, §8.5), and `embla-carousel-react` (`package.json`) has lost its only importer. Evidence: `debug_reports/gates_lint_8d_20261010.txt`, `lint_8d_{before,after}_20261010.txt`, `build_8d_after_20261010.txt`, `routes_8d_diff_20261010.txt` (empty) and `css_8d_before_after_20261010.txt`. **Rank 5 of that plan — rank 8e, card `t_e0250fe4`, the `any` sweep — was executed on 2026-10-10** as ten local, unpushed commits on `alan` (`7341097` through `b2f3aa9`), dropping the gate from 67 to **25 warnings** (0 errors, the same 120 linted files; `debug_reports/lint_8e_{before,after}_20261010.txt`). The sweep cleared **42 of the 50** `@typescript-eslint/no-explicit-any` occurrences — the register's projected 51 minus the one that rank 8a removed incidentally — with every other rule byte-identical (`set-state-in-effect` 11, `no-unescaped-entities` 2, `import/no-anonymous-default-export` 2, `no-unused-expressions` 1, `exhaustive-deps` 1). One commit per file, `npx tsc --noEmit` re-run and exiting 0 after each: `stores/useClientNavStore.ts` (`0957c16`), `components/vignette-generator.tsx` (`f292139`), `workers/mcp-gateway/src/index.ts` (`77e5010`), `app/practice/[sessionId]/page.tsx` (`f542313`), `app/dashboard/page.tsx` (`77c2917`), `components/ClientLanding.tsx` (`2740ba8`), `app/signup/page.tsx` (`ae98c24`), `app/api/analyze/session/route.ts` (`817f321`), `components/client-view.tsx` (`ff9168a`), `components/main-content.tsx` (`b2f3aa9`). Structurally: the store gained local wire-row types (`RawSessionRow`, `RawCaseRow`, `RawClientTree`) and an `errorMessage()` helper, and its three generation actions now return `NonNullable<Session["analysis"]>`, a local `VignetteResult`, and the shared `PracticePackage`; `vignette-generator.tsx` gained a `StoredPracticeTask` union of `StructuredTask` and `PracticePackage`; the MCP gateway gained a local `Env` type whose service binding is typed structurally, so no `workers-types` dependency was assumed; the practice page's local `PracticePackage` shadow was replaced by `Pick<PracticePackage, "homework">`, because the page builds a partial package and the full shared type would demand the `scenario` and `quiz` members that route never sends; and `client-view.tsx` gained two type predicates (`isStructuredTask`, `isRenderableTask`) each of which proves exactly what it claims. **The 8 sites that remained after rank 8e were recorded findings, not omissions — all eight were resolved at rank 8h, whose record closes this row.** Seven are in `components/vignette-generator.tsx` (lines 216, 412, 422, 423, 500, 509, 510) — the four `as any` bridges, two of which are the `setPracticePackage(enrichedTaskData as any)` and `formData: enrichedTaskData as any` pair inside each of the two generate handlers. Removing them is not a typing exercise: `practice_package` is written by the Worker in **two** incompatible shapes — a `StructuredTask` from `/generate/structured-task` and a `PracticePackage` from `/generate/practice-package` (`backend/CloudFlare.js:2427`, `:2445`) — while `Session.practicePackage` is typed `PracticePackage` only; and `FormData` (`@/types/tasks`) has **no** `reflection_prompt` member (it carries `behavioural_experiment` instead) while requiring `answers` and `reflection` for `two_choice_worksheet`, neither of which the generated two-choice task carries. The `tsc` output of the honest attempt — 25 errors across the two handlers' save paths — is the deliverable for that finding (`debug_reports/tsc_8e_d2_probe_errors_20261010.txt`, and the run log `debug_reports/agy_8e_d2_20261010.txt`). The eighth is `components/tasks/DynamicTaskForm.tsx:109` (`initialData?: any`), the funnel through which three payload shapes reach the form; typing it against the fields its own seeding code reads surfaced three call-site errors — `app/practice/[sessionId]/page.tsx(213,17)` `error TS2559`, `components/client-view.tsx(97,9)` `error TS2322` (`reflection_prompt` outside `TaskVariant`) and `components/vignette-generator.tsx(714,19)` `error TS2322` (`StoredPracticeTask` including `null`) — so it was restored and reported (`debug_reports/agy_8e_d9_d11_20261010.txt`). Two honest-narrowing edits touched expression text rather than only types, and both are recorded: the practice page's `getTaskLabel` now wraps its first-truthy label lookup in `String(...)` (renders identically for every value the Worker can put there), and the gateway's `errorMessage(err)` returns a `string` or `undefined` so a non-`Error` throw still yields the old `err?.message` result. One new assertion was introduced, in `isTaskVariant` — `(TASK_VARIANTS as readonly string[]).includes(v)` — mirroring the widen-for-`includes` idiom already in the repo at `app/practice/[sessionId]/page.tsx:31`; no `any`, no `@ts-expect-error` and no `as unknown as` appears in any added line of the ten commits (`git diff` over all ten). The sweep also corrected one of its own first attempts: the initial `client-view.tsx` guard claimed an `Extract<StructuredTask, …>` narrowing whose body only proved `"task_type" in pkg`, so it was replaced before commit by the two sound predicates above. Final tree: `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15 = 62/62, `npm run build` exit 0 with a byte-identical 13-route list (md5 `bab5456e751481302dfcd14942ada88c`, empty diff). Evidence: `debug_reports/gates_lint_8e_20261010.txt`, `lint_8e_{before,after}_20261010.txt`, `lint_8e_before.json`, `lint_8e_after.json`, `test_8e_20261010.txt`, `build_8e_after_20261010.txt`, `routes_8e_after_20261010.txt`, `routes_8e_diff_20261010.txt`, `tsc_8e_d2_probe_errors_20261010.txt` and the seven `agy_8e_*.txt` run logs. The sweep ran under the operator's new delegation protocol: **`agy` (Antigravity CLI, Gemini engines only — `Gemini 3.1 Pro (High)` and `Gemini 3.8 Flash (High)`) authored the source edits, the probe runs and the draft report text; the reviewing agent wrote each spec, reviewed every hunk, re-ran `tsc`, the linter, the suites and the build on the committed tree, and made the ten commits.** One `agy` run reported edits that were not on disk — its own `git diff` came back empty and the file was byte-identical to HEAD — which was caught by re-verifying the tree and repaired with a pinned continuation brief; the probe output of the false run was kept and is the source of `tsc_8e_d2_probe_errors_20261010.txt`. **Rank 6 of that plan — rank 8f, card `t_93ebcaa7` — was executed on 2026-10-10** and cleared exactly the five intended findings, `npm run lint` going **25 → 20 warnings** (0 errors, the same **120** linted files, findings-bearing files 14 → 10): `react/no-unescaped-entities` 2 → **0** (`app/forgot-password/page.tsx:63` now `we&apos;ll`, `components/tasks/ThreeCsForm.tsx:314` now `don&apos;t`), `@typescript-eslint/no-unused-expressions` 1 → **0** (`components/canvas/ReflectionCanvas.tsx:495`, `e.shiftKey ? handleRedo() : handleUndo();` → `if (e.shiftKey) handleRedo();` / `else handleUndo();` — register row D14 is explicit that the ternary worked, both branches having side effects, so this is readability only and no behaviour changed), and `import/no-anonymous-default-export` 2 → **0** (`backend/CloudFlare.js:190`, `workers/mcp-gateway/src/index.ts:12`; the register cites that Worker entry as `:1` because the `export default` sat on line 1 until rank 8e typed the file above it). Every other rule is byte-identical across the two runs (`no-explicit-any` 8, `set-state-in-effect` 11, `exhaustive-deps` 1) and no new finding appeared. The two Worker findings were cleared by a **scoped** rule config, not a global downgrade: `{ files: ["backend/**/*.js", "workers/**/*.ts"], rules: { "import/no-anonymous-default-export": ["warn", { allowObject: true }] } }`. `allowObject: true` was verified behaviourally rather than assumed — two throwaway probes under `backend/` were created, linted and deleted (`git status` clean afterwards): the object-literal `export default { async fetch() {} }` passed cleanly while `export default function () {}` still reported `Unexpected default export of anonymous function`, raw output in `debug_reports/lint_8f_allowobject_probe_20261010.txt` — so the `wrangler` entry shape is exempted by its *shape*, and every other anonymous default export in those globs still warns. The globs match four files in total (`backend/CloudFlare.js` plus `workers/mcp-gateway/src/{index,context,tools}.ts`) and no shipped Worker code was edited. The dead `@typescript-eslint/no-require-imports` override for `patch-cloudflare.js` / `patch-tasks.js` / `patch-vignette.js` was deleted in the same config edit — five lines (its two comment lines and the `files` / `languageOptions` / `rules` properties) whose target files no longer exist; it clears **0 findings by design** and is not counted in the five. The stale counts the register flagged in §6.3 were corrected as of this commit: `no-explicit-any` "51 sites across 11 files" → "8 sites across 2 files", `react-hooks/set-state-in-effect` "14 sites across 13 files" → **"11 sites across 10 files"** (the register's own "12 across 11" was pre-rank-8d; the comment now names rank 8g as the card that will move it again), `react-hooks/refs` "1 site" → 0 (since rank 8c), and `react/no-unescaped-entities` "2 sites, left for a follow-up" → 0. Two things this card did **not** carry, recorded as open operator decisions rather than silently actioned: (a) the `react-hooks/refs` and `react-hooks/purity` downgrades are both dead (0 sites since ranks 8c and 8d) and both this row and the config comments previously said their deletion belonged to rank 8f, but the register's actual rank-6 scope (§7.1) names only E1/E2 and the `patch-*.js` override — deleting a downgrade restores the plugin's `error` severity, i.e. it is a rule change, so the two were left in place and their comments corrected to say so; (b) `npm run build` rewrites the tracked `next-env.d.ts` route-types import between its `dev` and build variants, so it was restored to HEAD and the commit carries only the four intended files. Gates on the committed tree: `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15 = 62/62, `npm run build` exit 0 with a byte-identical 13-route list (md5 `bab5456e751481302dfcd14942ada88c`, empty diff). Evidence: `debug_reports/gates_lint_8f_20261010.txt`, `lint_8f_{before,after}_20261010.txt`, `lint_8f_allowobject_probe_20261010.txt`, `lint_8f_diff_20261010.txt`, `tsc_8f_20261010.txt`, `test_8f_20261010.txt`, `build_8f_20261010.txt`, `routes_8f_after_20261010.txt` and `routes_8f_diff_20261010.txt`. Executed under the operator's delegation protocol: **`agy` (Antigravity CLI, `Gemini 3.1 Pro (High)` — no Claude engine, no Claude Code, no `claude` CLI) authored the source and config edits, ran the `allowObject` probe and drafted the report text; the reviewing agent wrote the brief, reviewed every hunk, re-ran `tsc`, the linter, the suite and the build on the committed tree, and made the commit.** **Rank 7 of that plan — rank 8g, card `t_2d4d0225`, the `set-state-in-effect` programme — started on 2026-10-10 with bucket 6b, the four fetch-derived sites, one commit per bucket as the card requires.** `npm run lint` goes **20 → 15 warnings** (0 errors, the same **120** linted files, findings-bearing files 10 → 6): `react-hooks/set-state-in-effect` **11 → 7** and `react-hooks/exhaustive-deps` **1 → 0** (row B10). The bucket's premise came from register §5.4, and it was measured before any source edit rather than trusted: for a loader declared in the **component scope** (a `useCallback`, or a plain `const fn = async () => {}`) the rule attaches the finding to the **call inside the effect** and it survives the removal of that function's synchronous pre-sets, because the rule fires whenever a function called synchronously from an effect body can reach a `setState` — *including one that sits after an `await`*. `void load()` is still flagged once its pre-sets are gone, and so is `load().catch(…)`; two shapes are clean: an effect-local async task (`void (async () => { await load(); })();`) and an `async` function declared inside the effect body. Raw probe output: `scratch/probe-8g.tsx`, `probe2-8g.tsx`, `probe3-8g.tsx` (untracked throwaways, run with `npx eslint --no-ignore`). **The register's rows B6, B7 and B9 are corrected here**: "drop the two synchronous pre-sets" is necessary but not sufficient — each site also had to call its loader from the effect's own async task. Per site: `app/practitioner/tasks/[id]/review/page.tsx` (`fetchBundle` loses `setFetchError(null)` / `setLoading(true)`, both bail-outs on mount since `loading` starts `true`; a new `handleRetry` re-establishes them for the Retry button, the loader's only non-effect caller); `components/ClientLanding.tsx` (`fetchClients` loses `setLoading(true)`, a mount bail-out, and becomes a `useCallback` so the effect can depend on a stable identity — with `setLoading(true)` restored explicitly at the two callers that need a spinner, the create-client success path and the refresh button); `components/client-view.tsx` (`setIsLoading(true)` deleted outright: `isLoading` initialises `true` and the effect is the loader's only caller); `components/main-content.tsx` (the one site the register got wrong — `isLoading` starts **`false`** and `setError(null)` was the only thing that ever cleared a previous failure, so neither pre-set was a bail-out; loading and the failure banner are now derived from a `requestKey` of `client.id:selectedSessionId`, with `loadedKey` recording the settled request and the banner keyed to the request that failed, so a response or failure for a key that is no longer current is never shown — and `fetchVignettes` becoming a `useCallback` also clears row B10's missing dependency). Behaviour notes: no loader lost a spinner it needed (the review page's Retry and ClientLanding's create/refresh paths set it in the handler, where a synchronous `setState` is correct), and `main-content`'s initial state changes from a one-frame "No data yet" to the spinner, which is the loading state the effect was already producing. Evidence: `debug_reports/lint_8g_b_after.json`, `lint_8g_b_after_20261010.txt`, `agy_8g_6b_lint.txt` (agy's own self-check), `tsc_8g_b_20261010.txt`, `test_8g_b_20261010.txt` (`npm test` 35/35 + 12/12 + 15/15, the hydration suite's 15 checks named in the raw log), `build_8g_b_20261010.txt`, `routes_8g_b_20261010.txt` (md5 `bab5456e751481302dfcd14942ada88c`, byte-identical to ranks 8e/8f) and the empty diff `routes_8g_b_diff_20261010.txt`. Executed under the operator's delegation protocol: **`agy` (Antigravity CLI, `Gemini 3.1 Pro (High)` — no Claude engine, no Claude Code, no `claude` CLI) authored the four source edits from a written brief; the reviewing agent wrote that brief, reviewed every hunk against it, re-ran the linter (`-f json`), `tsc`, the suite and the build on the tree, and made the commit.** **Bucket 6a — the four props-derived sites — was the same card's second commit.** `npm run lint` goes **15 → 14 warnings** (0 errors, the same **120** linted files): one site cleared (`react-hooks/set-state-in-effect` 7 → 6) and three retained with a written reason in the source, because each retained row needed more than the register allowed. `components/dashboard-shell.tsx` is the cleared one: `useEffect(() => setDrawerOpen(false), [selectedClientId, selectedSessionId])` is now a `useClientNavStore.subscribe((state, prev) => …)` — a real store subscription whose callback fires only on an actual selection change and closes the drawer in the same update that navigates, so the drawer can never render over the region it just navigated to (the two selectors the effect used are deleted, since nothing else read them). The store is the zustand v5 object created in `stores/useClientNavStore.ts`, so `subscribe` returns the unsubscribe the effect hands back as its cleanup; the shape was probe-verified clean before the edit (`scratch/probe4-8g.tsx`). The three retained sites each carry an in-code `DELIBERATELY RETAINED (lint rank 8g, register row …)` comment: **B11** `components/tasks/DynamicTaskForm.tsx:355` (the `externalSubmissionId` mirror) — the register called it redundant, and that holds at mount and for the two call sites that pass no submission id, but `components/vignette-generator.tsx:715` passes `submissionId={generatedSubmissionId}` and `handleRegenerateExplicit` sets a new draft id (`:513`) **without changing `step`**, so the form stays mounted and the prop changes underneath it; this effect is the only thing that re-points the mounted form at the new draft row, so deleting it would leave `performSave` (`id: submissionId ?? null`) writing into the previous row while the new draft keeps the newly generated payload. A `key` remount would fix the id but unmount the form and drop a pending autosave debounce, and a derived id diverges in the same post-save case — so the finding is kept visible instead of forced; **B13** `components/vignette-generator.tsx:168` (the session-hydration latch) — the register's own sanctioned outcome: the guard's behaviour is what `tests/hydration-guard.test.mjs`'s 15 checks pin, and computing the phase from the store during render would re-derive on every store write (blur-saves, renames, the PATCH echo) and bounce the clinician out of their phase with unsaved notes; **B15** `hooks/use-clinical-workspace.ts:40` (the guarded derived-default `useLayoutEffect`) — correct today, and left alone because the hook has **zero importers** in this repo (the live workspace model is the store, §8.2), so a restructure could not be verified against any caller; wiring it up or deleting the file is an operator dead-code decision. Evidence: `debug_reports/lint_8g_a_after.json`, `lint_8g_a_after_20261010.txt`, `test_8g_a_20261010.txt` (35/35 + 12/12 + 15/15), `tsc_8g_a_20261010.txt`, `build_8g_a_20261010.txt`, `routes_8g_a_20261010.txt` (md5 `bab5456e751481302dfcd14942ada88c`, byte-identical to ranks 8e/8f) and the empty diff `routes_8g_a_diff_20261010.txt`. Executed under the delegation protocol: **`agy` (Antigravity CLI, `Gemini 3.1 Pro (High)`) authored all four 6a edits** — the one behavioural change plus the three comment-only retentions — from the brief; the reviewing agent wrote the brief, reviewed every hunk, collapsed a whitespace artefact left by deleting the two unused selectors, re-ran the linter (`-f json`), `tsc`, the suites and the build, and made the commit.** **Bucket 6c/6d was the card's third commit — "decide, do not force".** `npm run lint` goes **14 → 12 warnings** (0 errors, the same **120** linted files, findings-bearing files 5 → 3): `react-hooks/set-state-in-effect` **6 → 4**, i.e. the four retained sites and nothing else. **B2** `components/canvas/ReflectionCanvas.tsx` migrated its dark-mode read — the mount effect that mirror-imaged `matchMedia` into state is now `useSyncExternalStore(subscribeDarkMode, getDarkModeSnapshot, getDarkModeServerSnapshot)` with the three helpers at module scope (so `subscribe` keeps a stable identity across renders) and `getServerSnapshot` returning the same `false` the old `useState(false)` initial state held; `isDark` is still a boolean with the same value and timing (still read at `:300`/`:322`, still in the `[background, isDark]` dependency array). **B3** `hooks/use-mobile.ts` migrated the same way and **preserves the hydration property the card required**: `getServerSnapshot()` returns `undefined`, so the server render and the hydration render still agree (`!!isMobile` → `false`), and the subscription still watches `(max-width: 767px)` while the snapshot reads `window.innerWidth < 768`, exactly as the old hook did. **B12** `components/tasks/DynamicTaskForm.tsx` (the debounced autosave) is **retained and documented** rather than scoped: the card allowed clearing it with a scoped `eslint-disable`, declined here because every other downgrade in this config is deliberately left in the totals — the autosave and its 1200 ms debounce must not be removed, so the honest record is a retained finding with its reason in the source. **Final state of the card's 12 targets: 8 cleared, 4 retained with written reasons (B11, B12, B13, B15) — every one accounted for**, and the three commits are local only (`9c54005`, `3ade9ba` and this one; nothing pushed). The gates hold on the final tree: `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15 = 62/62 with all fifteen hydration checks named in the raw log, `npm run build` exit 0 with a byte-identical 13-route list (md5 `bab5456e751481302dfcd14942ada88c`, empty diff), `npm run docs:check` exit 0. Behaviour was verified rather than asserted, in a real Chromium harness (throwaway, outside the repo so `tsconfig.json`'s `**/*.tsx` include does not type-check it; sources and raw observations in `debug_reports/harness_8g_20261010.md`) that mounts the SHIPPING `DashboardShell` and `MainContent` against the real zustand store and a stubbed `fetch` with synthetic non-PHI fixtures: the mobile drawer opens (`[role="dialog"]`, `data-state="open"`, the sidebar inside) and is **gone from the DOM** after a selection write — the same store write `components/sidebar/SessionNode.tsx:112` and `app/dashboard/page.tsx:43` perform — and the History tab shows the spinner during a refetch, the failure banner after a failed one, and **no sticky banner** once the request key changes, with the previous rows kept. The card's `react-hooks/set-state-in-effect` exception comment in `eslint.config.mjs` was corrected from rank 8f's "11 sites across 10 files" marker to the final **4 sites across 3 files**, all four deliberately retained, so the downgrade stays (a rule may only stop being downgraded when no site remains); `no-explicit-any` is untouched at 8 sites, and the two unrelated dead downgrades (`react-hooks/refs`, `react-hooks/purity`) remain open operator decisions from rank 8f. **This completes the register's ranked fix plan (§7.1, ranks 1–7).** What remains from it, as a handover rather than an action: the four retained `set-state-in-effect` sites (the eight `no-explicit-any` sites it listed were resolved at rank 8h, below), the now-dead `@typescript-eslint/no-explicit-any` downgrade, and the decisions the register handed to the operator — the dead `react-hooks/refs` / `react-hooks/purity` / `react/no-unescaped-entities` downgrades, `getDefaultActivity`'s client-side modality→activity mapping if it is ever wanted, the unreferenced `hooks/use-mobile.ts` / `components/ui/skeleton.tsx` / `components/ui/tooltip.tsx` and the now-unused `embla-carousel-react` dependency, the stale `pnpm-lock.yaml`, and rank 8b's Geist Mono fallback-family call — which the operator answered at **rank 8i** (card `t_eebc2dbb`): the mono token now names the literal family and the metric-adjusted fallback is out of the chain, so this row's open-decision list no longer holds it (see the rank-8i record above). Evidence: `debug_reports/lint_8g_cd_after.json`, `lint_8g_cd_after_20261010.txt`, `test_8g_cd_20261010.txt`, `tsc_8g_cd_20261010.txt`, `build_8g_cd_20261010.txt`, `routes_8g_cd_20261010.txt`, `harness_8g_20261010.md`, `agy_8g_6cd_run.txt` and `agy_8g_6cd_lint.txt`. Executed under the delegation protocol: **`agy` (Antigravity CLI, `Gemini 3.1 Pro (High)` — no Claude engine, no Claude Code, no `claude` CLI) authored all three 6c/6d edits** — the two `useSyncExternalStore` migrations and the B12 retention comment — from the brief; the reviewing agent wrote the brief, reviewed every hunk, built and drove the Chromium harness, re-ran the linter (`-f json`), `tsc`, the suites and the build, corrected the config exception comment, and made the commit. **The last eight findings from that plan — card `t_75b9c1b0`, rank 8h — were resolved on 2026-10-10**, `npm run lint` going **12 → 4 warnings** (0 errors, the same **120** linted files, findings-bearing files 3 → 3): all eight `@typescript-eslint/no-explicit-any` findings cleared, the four retained `set-state-in-effect` sites untouched, no other rule's count moved. **The decision — the operator delegated it ("Kuro to make the call, do not leave it as is"): model both columns as the unions the app already writes and narrow with sound type predicates. No Worker change, no Supabase change, no request-contract change, no runtime behaviour change.** `practice_package` was stored in two incompatible shapes while `Session.practicePackage` was typed as one, so `lib/practice-package.ts` now owns the model and exports `StoredPracticeTask = StructuredTask | PracticePackage` plus `isStructuredTask(value): value is StructuredTask` (`"task_type" in value` — the discriminant the structured shape always carries and the package shape never does); `Session` and `RawSessionRow` (`stores/useClientNavStore.ts`), `vignette-generator.tsx`'s local state and the PDF export's three parameters (`lib/export-practice-pdf.ts`) all take that union, and the export's `collectHomeworkTasks` narrows with `"homework" in pkg` because both shapes can carry the list it reads. `types/tasks.ts` gains `SubmissionFormData = FormData | StructuredTask`, because `form_data` holds either a completed submission or the **seed** a clinician's generator upserts as a draft — which is the whole of the `FormData` / `reflection_prompt` mismatch: the seed carries no `answers` / `reflection` for `two_choice_worksheet` (the client supplies them) and may be a `reflection_prompt` task, a canvas handout `FormData` does not model at all. `components/tasks/DynamicTaskForm.tsx`'s `initialData?: any` becomes the exported `DynamicTaskInitialData` — an all-optional bag of exactly the members the form's own seeding code reads, plus `task_type` and `homework`, the members its three producers have in common (without one of those, an all-optional target is not even assignable from the signed-link page's projection or from the stored package — the exact `TS2559` rank 8e recorded). **Alternatives rejected**: a *tagged wrapper* (`{ kind, payload }`) or a *split column* would change what the deployed Worker writes into `practice_package` and orphan every existing row — a contract change on a card whose premise is "this is a typing problem", and no Worker file was touched; widening the read sites to `unknown` / `Record<string, unknown>` would have moved the laundering rather than resolved it; and relaxing `TwoChoiceWorksheetFormData.answers` / `reflection` to optional would have weakened the *completed* submission contract to accommodate the seed while still failing to describe the `reflection_prompt` member. Two boundary assertions are deliberate and disclosed: `JSON.parse(genText) as StructuredTaskResponse` in each generate handler, where the declared bag covers all three bodies the route can return (the structured task, the `?allowDegraded=1` placeholder and the `{ error }` / `{ detail }` envelope, since `res.ok` is tested *after* the parse), and the shared `isStructuredTask` guard. **No behaviour change, measured rather than asserted.** An esbuild emit diff of all seven changed files against their HEAD emit (`debug_reports/emit_diff_8h_20261010.txt`) shows `components/tasks/DynamicTaskForm.tsx`, `stores/useClientNavStore.ts` and `types/tasks.ts` **byte-identical**, `components/vignette-generator.tsx` differing only in its import line and the hydration guard — with **the emitted JavaScript of both generate handlers byte-identical to HEAD** (`handleAnalyzeAndGenerate` in full, and `handleRegenerateExplicit` through EOF, which is where every request body those paths build is stringified) — and `components/client-view.tsx` differing only by moving its (identical) predicate into the shared module. A runtime A/B probe against the real modules (`debug_reports/probe_8h_20261010.txt`) then measures the only changed runtime expressions: `collectHomeworkTasks` returns identical lists for **10 / 10** fixtures (string homework, object rows, the enriched structured task, absent / empty / non-array homework, `null`), and `buildPracticePackagePdf` produces byte-identical PDFs for the package, the enriched structured task and `null` once jsPDF's own per-instance fields (its `/CreationDate` stamp and its random trailer `/ID`) are normalised; the hydration guard agrees with the legacy `if (pkg.task_type)` on **12 / 13** fixtures and **diverges on exactly one** — a hand-written row carrying a *falsy* `task_type`, where a shape test says "structured" and truthiness said "no". That divergence is unreachable through any writer (every generated variant's `task_type` is a non-empty literal, and the package shape has none) and is recorded rather than papered over. Gates on the committed tree: `npx tsc --noEmit` exit 0, `npm test` 35/35 + 12/12 + 15/15 = 62/62 with all fifteen hydration checks named in the raw log, `npm run build` exit 0 with a byte-identical 13-route list (md5 `bab5456e751481302dfcd14942ada88c`, empty diff), `npm run docs:check` exit 0. Evidence: `debug_reports/lint_8h_{before,after}_20261010.txt`, `emit_diff_8h_20261010.txt`, `probe_8h_20261010.txt`, `test_8h_20261010.txt`, `build_8h_20261010.txt`, `routes_8h_after_20261010.txt`, `routes_8h_diff_20261010.txt` (empty), `agy_8h_fix1.txt` and `agy_8h_transcript.txt`. The `@typescript-eslint/no-explicit-any` exception comment in `eslint.config.mjs` was corrected to the measured zero sites (comment only — the `warn` severity is deliberately left in place, since deleting a downgrade is an operator decision), and the build's rewrite of `next-env.d.ts` was restored to HEAD. Executed under the operator's delegation protocol: **`agy` (Antigravity CLI, model `gemini-3.1-pro-high` — no Claude engine, no Claude Code, no `claude` CLI) authored all the source edits in two runs from two written briefs** (the second completing the response type after the first stopped honestly on the `detail` / `error` reads rather than weakening them); the reviewing agent wrote both briefs, reviewed every hunk against them, probed the assignability questions with throwaway `.ts` probes before writing the brief, ran the emit diff and the runtime A/B probe, re-ran `tsc`, the linter, the suites, the build and the route diff on the tree, wrote this record and made the commit. **Result: 8 of 8 sites cleared, none of them needed a Worker or schema decision, and no added `as any` / `as unknown as` / `@ts-expect-error` / `: any` appears in any added source line (`git diff -U0` over the seven files, `debug_reports/` excluded).** |
| Type errors not gated | `next.config.mjs` sets `typescript.ignoreBuildErrors: true`; run `npx tsc --noEmit` manually |
| Two lockfiles | `package-lock.json` and `pnpm-lock.yaml` are both tracked. npm is the operative manager for this clone — `node_modules/.package-lock.json` exists, there is no `node_modules/.pnpm/` or `.modules.yaml`, `pnpm` is not on PATH, and no `.npmrc`/`packageManager` field pins one — so the 2026-10-10 eslint install updated `package-lock.json` only. `pnpm-lock.yaml` is therefore stale and does not list the eslint toolchain; deciding which one to keep (and deleting the other) is an operator call, not a worker's |
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
6. Introduce lint/type/test gates in CI, then delete the dead code listed in §13.3. (The lint gate
   itself now exists and runs locally — §13.4; only the CI wiring is outstanding.)
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
| ### 13.8 Closure record — Modality Multi-Select & Analyze Resilience (2026-10-10)

| Item | Detail |
| --- | --- |
| Symptom 1 | Clinicians unable to select more than 2 modalities (capped at 2 instead of 3 in Step 1) |
| Cause 1 | Lowercase modality values in DB or inferred session state (`"cbt"`) caused casing mismatch with uppercase constants (`"CBT"`). As a result, `"cbt"` did not match `"CBT"`, rendering button unselected while counting towards `length`. Clicking added `"CBT"`, creating invisible duplicates that capped visible selections at 2 |
| Fix 1 | Strict canonical uppercase normalisation in `ModalitySelector` and `vignette-generator.tsx` hydration via a dedicated parser and Set deduplication, supporting full 1-3 modality multi-select |
| Symptom 2 | `POST /analyze/session` failing with invalid request error during analysis |
| Cause 2 | Reasoning model tokens (`<think>...</think>`) polluted JSON extraction when curly braces appeared within reasoning text. Furthermore, direct uncaught generation errors failed hard instead of leveraging the degraded graceful fallback |
| Fix 2 | Stripped `<think>...</think>` tags in `stripMarkdown`, passed `?allowDegraded=1` on analyze and generate endpoints to guarantee graceful fallback degraded payloads, and deployed live worker version `54c03287-95c4-43fe-be7f-134409664e1c` |
| Evidence | `npx tsc --noEmit` exit 0; `npm test` all 61 checks green (34 worker, 12 PDF, 15 hydration); Worker deployed to Cloudflare production |

### 13.9 Closure record — Client Link Homework Task Display (2026-10-10)

| Item | Detail |
| --- | --- |
| Symptom | Opening the signed client link (`/practice/:sessionId?exp=…&sig=…`) rendered "No practice tasks available." even after structured tasks were generated |
| Causes | 1. In `vignette-generator.tsx`, `saveSessionContent` was called without `practicePackage` or `homework`, leaving the session row in Supabase devoid of practice package content.<br>2. In `CloudFlare.js`, `GET /client-homework/:sessionId` only read `row.practice_package.homework` as an array. When structured tasks (`two_choice_worksheet`, `thought_record`, `activity_log`, `reflection_prompt`) were present without an explicit `.homework` array, it defaulted to `[]` and ignored `row.homework` and `practice_task_submissions`.<br>3. In `app/practice/[sessionId]/page.tsx`, the client page strictly expected `data.practiceHomework` and did not fall back to `data.homework`, and lacked interactive task completion. |
| Fix | 1. In `vignette-generator.tsx`, enriched generated tasks with `homework` arrays via `extractHomeworkList`, persisting `practicePackage` and `homework` during both initial generation and regeneration, and restored step 2 hydration on existing sessions.<br>2. In `CloudFlare.js`, implemented `extractHomeworkFromPracticePackage` to extract human-readable task items from structured task schemas, with cascading fallbacks to `row.homework` and `practice_task_submissions` records.<br>3. In `app/practice/[sessionId]/page.tsx`, added cascading fallback to `data.homework`, structured object task formatting, and an interactive client checkbox tracker with progress bar. |
| Evidence | `npx tsc --noEmit` exit 0; `npm test` all 61 checks green (34 worker, 12 PDF, 15 hydration); `npm run docs:check` exit 0 |

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












