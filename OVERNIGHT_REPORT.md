# Overnight security & correctness fixes — `debug`

**Run:** 2026-09-15, autonomous overnight run
**Branch:** `debug` (verified with `git branch --show-current` before any edit)
**Started at:** `5a85d35` (clean tree) · **Ended at:** `ba00d5f` (+ the report commit)
**Pushed:** **No.** Every commit is local on `debug`; nothing was pushed, so any fix can be
inspected or reverted independently with `git revert <sha>`.

## Result summary

| # | Fix | Status | Commit | Gate evidence |
| --- | --- | --- | --- | --- |
| 1 | Bearer-token auth on `/debug` + `/tools/run` | **Committed** | `4057562` | `node --check` exit 0; `tsc` baseline unchanged |
| 2 | CORS allowlist in the API Worker | **Committed**, TODOs left | `50afc00` | `node --check` exit 0 |
| 3 | `POST /sessions` resolves `client_id` from `caseId` | **Committed** | `a87c8bf` | `node --check` exit 0 |
| 4 | Open redirect in client login | **Committed** (pattern matched) | `8e6e918` | `tsc` baseline unchanged |
| 5 | Optimistic rename rollback | **Committed** | `ba00d5f` | `tsc` baseline unchanged |
| — | This report | **Committed** | `git log --oneline debug` | — |

**No fix was skipped**, no gate failure was caused by these changes, and no retry limit was hit.
The CORS fix (2) is the only one carrying a decision left open, because it needs an origin only
you know (see [TODOs](#todos-left-for-the-clinician)).

## Baseline: `npx tsc --noEmit` is red *before* these changes

`npx tsc --noEmit` exits **2** with **15 errors**, all pre-existing and unrelated:

```
Found 15 errors in 2 files.
Errors  Files
     2  components/clinical-folder-tree.tsx:7     (TS2304 ClinicalFolderTreeProps, TS7006 implicit any)
    13  components/vignette-generator.tsx:495     (TS18047 'practicePackage' is possibly 'null')
```

This was **proven to be the baseline**, not a regression: the two changed files were stashed
(`git stash push -- <paths>`), `npx tsc --noEmit` was re-run against pristine `HEAD`, and it
reported the **same 15 errors at the same file:line positions** (`BASELINE_ERROR_COUNT=15`).
The stash was popped immediately and both files were confirmed restored before committing.

Consequence for the gates: `tsc` was treated as a **delta** check — every TypeScript gate required
the count to stay exactly 15 with **0 errors in the file being committed**. That held for all five
fixes. Per the "no scope creep" rule, those two `components/` files were **not** touched; they remain
out of scope and should be fixed separately (`components/vignette-generator.tsx` is not in
`components/ui/`, so it is fair game for a future change).

---

## Fix 1 — Gateway authentication (`workers/mcp-gateway/src/index.ts`) · `4057562`

**Problem:** `GET /debug` proxied `env.BACKEND.fetch("https://backend/clients")` and
`POST /tools/run` executed create/delete/analyze tools — both reaching a service-role backend with
**no authentication at all**.

**Change:** a private-route guard immediately after `const url = new URL(req.url)`:

```ts
const isPrivateRoute =
  url.pathname === "/debug" ||
  (url.pathname === "/tools/run" && req.method === "POST");

if (isPrivateRoute) {
  const expected = env?.MCP_TOKEN;
  const header = req.headers.get("Authorization") || "";
  const provided = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  // Fail closed: with no configured token the route must not appear to exist,
  // and the 404 is byte-identical to the catch-all so nothing is revealed.
  if (!expected || provided !== expected) {
    return notFound();
  }
}
```

plus a new `notFound()` helper that the guard **and** the final catch-all now both use, so a
guarded route is indistinguishable from an unknown path:

```ts
function notFound() {
  return new Response("Not Found", { status: 404 });
}
```

- Returns **404, not 401** — the route's existence is never revealed.
- Fails **closed**: if `MCP_TOKEN` is unset, both routes 404 rather than opening up.
- Web Fetch API only (`request.headers.get`, `await request.json()` untouched, `new Response`);
  no Express patterns were introduced.
- `/` health check stays public and unchanged. `/context` and `/tools` were **left public** — they
  return only static metadata and were not listed in the brief (see TODOs).
- `workers/mcp-gateway/wrangler.toml` gained a **comment-only** block documenting the secret.
  No secret value was committed.

**Gate:** `node --check workers/mcp-gateway/src/index.ts` → exit **0**; `npx tsc --noEmit` → 15
baseline errors, none in this file.

⚠️ **Auth uses `!==` string comparison** (no constant-time compare). That is consistent with the
rest of this codebase and adequate for a high-entropy random token, but if you want timing-attack
hardening, a `crypto.subtle.timingSafeEqual`-style compare is the follow-up.

## Fix 2 — CORS restriction (`backend/CloudFlare.js`) · `50afc00`

**Problem:** hardcoded `"Access-Control-Allow-Origin": "*"` on every response, letting any website
call the Worker with a browser session.

**Change:** the `cors` object is now built from `env.ALLOWED_ORIGINS`:

```js
const requestOrigin = request.headers.get("Origin")

const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigin =
  requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : null

const cors = {
  ...(allowedOrigin
    ? {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Vary": "Origin",
      }
    : {}),
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer",
}
```

- Matching `Origin` ⇒ echoed back; non-matching or absent ⇒ the header is **omitted entirely**,
  so the browser blocks the response. The `OPTIONS` preflight takes the same path (200, no header).
- `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` are preserved **verbatim**.
- `Vary: Origin` was added because an echoed origin without it is cache-poisonable — without it a
  shared cache could serve an allowlisted origin's response to a different origin.
- No call sites changed: `cors` is still a plain object spread by `respond()` (~90 uses) and passed
  to `new Response(null, { headers: cors })` for `OPTIONS`.
- Strict-only behaviour was your explicit choice; no `*` fallback was added.

**Gate:** `node --check backend/CloudFlare.js` → exit **0**.

⚠️ **This is a breaking cutover.** `ALLOWED_ORIGINS` is not set on `clinical-ai-backend` yet, so
until you set it, browser calls from the dashboard will fail CORS. A `// TODO(clinician):` comment
marks the spot in the code.

## Fix 3 — Session creation `client_id` (`backend/CloudFlare.js`) · `a87c8bf`

**Problem:** `POST /sessions` wrote `client_id: body.clientId`, but the frontend only ever sends
`{ caseId }` — `stores/useClientNavStore.ts` does exactly that both when bootstrapping a new client
(`bootstrapNewClientWorkspace`) and in `createSession`. Every session therefore got a `NULL`
`client_id`, which is why `GET /clients/:id/tree` has to join sessions via cases (there is an
existing comment in the Worker acknowledging this).

**Change:** resolve the owning client from the case before inserting, and 404 if the case is gone:

```js
// ✅ Resolve the owning client from the case: callers often send only caseId.
const caseRes = await fetch(
  `${SUPABASE_URL}/case_formulations?id=eq.${encodeURIComponent(body.caseId)}&select=id,client_id`,
  { headers: HEADERS }
)

if (!caseRes.ok) throw new Error(await caseRes.text())

const caseRows = await caseRes.json()

if (!Array.isArray(caseRows) || caseRows.length === 0) {
  return respond({ error: "Case not found" }, cors, 404)
}

// ✅ The case row is the source of truth for client_id; body.clientId only
// covers legacy case rows whose own client_id is null.
const clientId = caseRows[0].client_id || body.clientId || null
```

…and the insert now sends `client_id: clientId` (was `body.clientId`).

- The **case row is the source of truth**; `body.clientId` is retained only as a fallback for legacy
  cases whose own `client_id` is null, so existing callers that do send both keep working.
- Missing/nonexistent case ⇒ `404 { error: "Case not found" }` (previously it silently created an
  orphan session).
- `encodeURIComponent` is applied to the case id in the new query.
- The session-count/name logic (`Session N`) and the rest of the handler are untouched.

**Gate:** `node --check backend/CloudFlare.js` → exit **0**.

## Fix 4 — Open redirect (`app/client-login/page.tsx`) · `8e6e918`

**Pattern check: matched**, so the fix was applied rather than skipped. The file previously read:

```tsx
const redirect = searchParams.get("redirect") || "/";   // line 10 — unvalidated
...
router.push(redirect);                                  // line 27
```

**Change:** a module-scope validator, and the value now flows through it:

```tsx
// Only same-site relative paths are allowed. Rejects absolute URLs
// ("https://evil.com"), protocol-relative URLs ("//evil.com") and the backslash
// variant ("/\evil.com"), all of which would navigate off the app origin.
function resolveRedirect(target: string | null): string {
  if (!target) return "/";
  if (!target.startsWith("/")) return "/";
  if (target.startsWith("//")) return "/";
  if (target.includes("\\")) return "/";
  return target;
}
```

called as `const redirect = resolveRedirect(searchParams.get("redirect"));`

- Covers the three escape routes: absolute URLs (`!startsWith("/")`), protocol-relative
  (`startsWith("//")`), and the `/\evil.com` backslash variant.
- Nothing else in the component was touched. In particular `handleLogin` still performs **no**
  authentication call — it only pushes. **That is a pre-existing gap, not part of the listed fixes**,
  so it was left alone; see TODOs.

**Gate:** `npx tsc --noEmit` → 15 baseline errors, **0** in this file.

## Fix 5 — Optimistic rename rollback (`stores/useClientNavStore.ts`) · `ba00d5f`

**Problem:** `renameClient`, `renameCase` and `renameSession` each applied an optimistic `set(...)`,
and on PATCH failure only did `set({ error: err.message })` — leaving the UI showing a name the
backend never accepted. The old code even said `// ❌ Optional: rollback if needed`.

**Change:** each method captures the previous state before mutating, and restores it in `catch`:

- `renameClient` — captures `previousClient` **and** `previousClients` (it mutates both the open
  client and the client list), and restores both alongside `error`.
- `renameCase` / `renameSession` — capture `previousClient` and restore it alongside `error`.

```ts
// capture (before the optimistic set)
const previousClient = client
const previousClients = get().clients      // renameClient only

// catch
} catch (err: any) {
  // ❌ Roll back the optimistic rename, then surface the failure
  set({
    client: previousClient,
    clients: previousClients,              // renameClient only
    error: err.message,
  })
}
```

The existing `if (!client) return` guards are untouched, so no new null paths were introduced.

**Gate:** `npx tsc --noEmit` → 15 baseline errors, **0** in this file.

---

## TODOs left for the clinician

1. **`// TODO(clinician):` — set `MCP_TOKEN` on the `alice-mcp` Worker (Fix 1).**
   ```
   npx wrangler secret put MCP_TOKEN --name alice-mcp
   ```
   Until this is set, `/debug` and `/tools/run` return 404 — **by design** (fail closed). Afterwards,
   every MCP client must send `Authorization: Bearer <MCP_TOKEN>`. These two client config files
   currently send **no** header and were deliberately **not** edited (out of scope):
   - `.cursor/config.json` → `https://alice-mcp.neuvoteam.workers.dev/`
   - `ai-config/mcp.json` → `alice-mcp.YOUR-SUBDOMAIN.workers.dev` (placeholder, already stale)

2. **`// TODO(clinician):` — set `ALLOWED_ORIGINS` on the `clinical-ai-backend` Worker (Fix 2).**
   Comma-separated, in `wrangler.jsonc`:
   ```jsonc
   "vars": { "GROQ_MODEL": "openai/gpt-oss-20b", "ALLOWED_ORIGINS": "https://<dashboard-origin>,http://localhost:3000" }
   ```
   I could **not** determine your deployed Next.js origin from the repo — the only origin I could
   verify anywhere is `http://localhost:3000` (`documentation.md:712`, the dev server). **Until this
   is set, the dashboard's browser calls to the Worker get no CORS header and will be blocked**,
   so set it before/with deploying this Worker. `Vary: Origin` is already handled.

3. **Unchanged by design, but worth a decision:** `/context` and `/tools` on the gateway remain
   public (static metadata only). If you want them behind the same bearer token, it is a one-line
   addition to `isPrivateRoute`.

4. **Pre-existing, out of scope:** the 15 `tsc` errors in `components/clinical-folder-tree.tsx` and
   `components/vignette-generator.tsx` (see Baseline). They predate this run and were not touched.

5. **Pre-existing, out of scope:** `app/client-login/page.tsx` `handleLogin` validates only that the
   email/password fields are non-empty, then navigates — it never calls an auth endpoint. The XSS-free
   redirect fix was in scope; implementing real client authentication was not.

6. **Optional hardening:** Fix 1 compares the bearer token with `!==` rather than a constant-time
   comparison; Fix 2's `allowedOrigins.includes(...)` is a plain array scan. Neither is a practical
   issue at this scale.

## Verification evidence

```
$ git log --oneline debug          # (see end of message / command output)
ba00d5f fix(store): roll back optimistic renames when the PATCH fails
8e6e918 fix(client-login): block open redirect via unvalidated redirect param
a87c8bf fix(worker): resolve session client_id from caseId and 404 on missing case
50afc00 fix(worker): restrict CORS to an explicit origin allowlist
4057562 fix(gateway): require bearer token on /debug and /tools/run
5a85d35 (origin/debug) debug ps ran

$ npx tsc --noEmit                # exit 2 — BASELINE, unchanged by this run
components/clinical-folder-tree.tsx:7:85 - error TS2304: Cannot find name 'ClinicalFolderTreeProps'.
components/clinical-folder-tree.tsx:24:33 - error TS7006: Parameter 'client' implicitly has an 'any' type.
components/vignette-generator.tsx:495:24 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:501:72 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:507:62 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:513:62 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:519:30 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:520:29 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:522:34 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:534:30 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:535:29 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:537:34 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:559:24 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:559:48 - error TS18047: 'practicePackage' is possibly 'null'.
components/vignette-generator.tsx:561:28 - error TS18047: 'practicePackage' is possibly 'null'.

Found 15 errors in 2 files.

Errors  Files
     2  components/clinical-folder-tree.tsx:7
    13  components/vignette-generator.tsx:495

$ node --check backend/CloudFlare.js            # exit 0 (after Fix 2 and after Fix 3)
$ node --check workers/mcp-gateway/src/index.ts # exit 0 (after Fix 1)

$ git status --short --branch
## debug                                        # clean; nothing pushed
```

`tsconfig.tsbuildinfo` is tracked and is rewritten by every `tsc` run (`"incremental": true`);
it was restored with `git checkout -- tsconfig.tsbuildinfo` at each gate so it never entered a
commit, and the final tree is clean.

## Commit hygiene

One commit per fix, five fixes, plus this report — `git log --oneline debug` shows exactly:
`4057562`, `50afc00`, `a87c8bf`, `8e6e918`, `ba00d5f`, then `5a85d35` (the pre-existing `debug` tip).
No commit contains more than one fix; `components/ui/` and lockfiles were never touched.

## Appendix — exact post-edit line spans

Printed from the files themselves (not `git diff`) after each commit:

| Fix | File | Post-edit lines |
| --- | --- | --- |
| 1 | `workers/mcp-gateway/src/index.ts` | 5-31 private-route guard · 36 `/debug` handler head · 198 `/` health (unchanged) · 202 catch-all → `notFound()` · 206-213 `notFound()` helper |
| 1 | `workers/mcp-gateway/wrangler.toml` | 13-17 comment-only `MCP_TOKEN` documentation |
| 2 | `backend/CloudFlare.js` | 11-45 origin resolution + conditional spread; `-Methods`/`-Headers` preserved at 43-44 |
| 3 | `backend/CloudFlare.js` | 332-349 case lookup + 404 · 367 `client_id: clientId` |
| 4 | `app/client-login/page.tsx` | 6-18 `resolveRedirect` · 24 call site · 41 `router.push(redirect)` (unchanged) |
| 5 | `stores/useClientNavStore.ts` | 446-449 + 467-472 (`renameClient`) · 481-482 + 500-501 (`renameCase`) · 513-514 + 539-540 (`renameSession`) |
