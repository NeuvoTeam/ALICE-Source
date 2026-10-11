# ALICE — Practitioner Review Queue UX Spec (Item 3)

> **Anchor convention.** Code references here are cited by **symbol**, not by line number —
> a line number rots with any adjacent edit, so it reads as a fact with no expiry. Resolve a
> symbol with `grep -n '<symbol>' <file>`. If a line number is ever genuinely load-bearing it
> must be stamped `as of <sha>`, never left bare.

Author: Aya (UI/UX architect)
Date: 2026-10-11
Status: SPEC — not implemented. Blocked on a list route (Rook-gated).
Scope: new route `app/practitioner/submissions/page.tsx`, plus the route that feeds it
`backend/CloudFlare.js`.

---

## 1. Ground truth

| Claim | Evidence |
| --- | --- |
| The review gateway exists and is complete | `app/practitioner/tasks/[id]/review/page.tsx` (1 425 lines) |
| It needs a submission id handed to it | `useParams` in the page — `const params = useParams<{ id: string }>()` |
| **Nothing links to it** | `grep -rn "review" app components --include=*.tsx` returns only the page's own header comment — there is no `<Link>`, no `router.push`, no list |
| There is no list or index route | `find app/practitioner -type f -name "*.tsx"` → exactly one file |
| There is no list endpoint | `GET` handlers in `backend/CloudFlare.js`: `/auth/me`, `/clients`, `/client-link/*`, `/client-homework/*`, `/sessions/*`, `/sessions`, `/latest-session`, `/client/history`, `/client/*`, `/ai/*`, and `/tasks/submissions/:id/bundle`. **No collection route for submissions.** |
| Status vocabulary already exists | `types/tasks.ts` `TaskStatus`; presentation in `page.tsx` `STATUS_CONFIG` |
| The true "submitted at" already exists | `backend/CloudFlare.js` writes `status_audit_log { previous_status: "draft", new_status: "pending_practitioner_review", changed_by_user_id, changed_at }` |
| Client names are reachable | `backend/CloudFlare.js` `GET /clients` → `clinician_clients` mapping → `clients(id, full_name)` |
| A submission cannot be attributed to a session | no `session_id` column (the `/client-homework` comment confirms) |

### Two latent defects to fix while in here

**a. `TASK_LABELS` is incomplete** (`app/practitioner/tasks/[id]/review/page.tsx`).
It maps `activity_log`, `thought_record`, `behavioural_experiment` — and **not**
`two_choice_worksheet` or `reflection_prompt`, both of which the signed-link page can
render today (`app/practice/[sessionId]/page.tsx`). Any label lookup must move to
one shared module so the queue and the gateway cannot drift. Proposed source of truth:

```ts
// lib/task-labels.ts
export const TASK_LABELS: Record<string, string> = {
  activity_log: "Weekly Activity Schedule",
  thought_record: "The 3 C's Worksheet",
  two_choice_worksheet: "Two-Choice Worksheet",
  reflection_prompt: "Reflection",
  behavioural_experiment: "Behavioural Experiment",
};
export const taskLabel = (t: string) => TASK_LABELS[t] ?? "Practice task";
```

**b. The gateway has no way back.** Once the queue exists, every terminal action in the
gateway (approve, request revision, notes saved) must return to the queue with the row's
state refreshed — not drop the clinician on a dead page.

---

## 2. The grouping question — my answer

Kuro asked: per client → per session, or flat chronological?

**Hierarchical: Client → Session. But ship level 1 only, and reserve level 2.**

The reasoning, in order:

1. **A review queue is a work list, not a log.** Its job is "what is waiting for me, and
   for whom". The clinical unit is a *person*; a queue sorted by timestamp makes the
   clinician reconstruct the person from a uuid on every row.
2. **Session is the correct second level — but it cannot be honest today.**
   `practice_task_submissions` has no `session_id`, and the commit route does not write
   one. Grouping by session now would mean inferring a session from `client_id` +
   `created_at` proximity, which is a guess. A guess shown to a clinician as a clinical
   grouping is worse than no grouping: it will confidently put Wednesday's worksheet in
   Tuesday's session.
3. **So the right first release is one level: clients, pending first.** That is a strict
   superset of the flat queue (a flat queue is what you get if you ignore the grouping
   headers) and it needs **zero** schema change.
   **Rook's audit upgrades this from a phase to a permanent property.** Existing rows
   carry `client_id` only, and inferring a session from `client_id` + `created_at`
   proximity is exactly the guess refused above — there is no backfill, so historical
   submissions keep `session_id = NULL` forever, meaning *session unknown (pre-migration)*.
   Level 1 is therefore not scaffolding to be thrown away; it is the permanent rendering
   for every pre-migration row, and the session slot must degrade rather than assume.
4. **Design the row so level 2 is additive.** Give the row a session slot that renders
   only when the data carries it (3.4). When Rook lands `session_id` and the commit route
   starts writing it, the same row component grows a session line and the list grows
   session sub-headers — no re-layout, no rewrite.

Do not let anyone scope "group by session" into implementation before `session_id`
exists. If the operator wants it in one step, the honest path is the schema change first
(§6), then this UI with both levels built — not a guessed grouping.

---

## 3. Route and layout

New route: `app/practitioner/submissions/page.tsx` — the practitioner's default landing
surface after login.

```
┌─ Sidebar ─┬──────────────────────────────────────────────────────────────────┐
│           │  Submissions                    [search clients…]              │
│ Dashboard │  ┌ Needs review 3 ┐ All 12 ┐ Drafts 4 ┐ Reviewed 5 ┐            │
│ Clients   │  ─────────────────────────────────────────────────────────────   │
│ Sessions  │                                                                  │
│ ▸ Review 3│  ▾ Ana Ruiz                          3 pending · 5 total         │
│           │  ┌────────────────────────────────────────────────────────────┐  │
│           │  │ Weekly Activity Schedule        Pending Review · 3 days    │  │
│           │  │ <session slot — renders when session_id lands>             │  │
│           │  │ 2 reflections                  15 Oct 2026, 7:42 pm       │  │
│           │  └────────────────────────────────────────────────────────────┘  │
│           │  ┌────────────────────────────────────────────────────────────┐  │
│           │  │ Two-Choice Worksheet                 Approved · 6 Oct      │  │
│           │  └────────────────────────────────────────────────────────────┘  │
│           │                                                                  │
│           │  ▾ Marcus Webb                       0 pending · 7 total         │
│           │  ┌────────────────────────────────────────────────────────────┐  │
│           │  │ The 3 C's Worksheet            Revision requested · 2 d    │  │
│           │  └────────────────────────────────────────────────────────────┘  │
└───────────┴──────────────────────────────────────────────────────────────────┘
```

Page shell uses the existing `DashboardShell` / `MainContent` chrome
(`components/dashboard-shell.tsx`) so the queue does not introduce a second layout
language.

### 3.1 Tabs (filter)

| Tab | Query | Notes |
| --- | --- | --- |
| **Needs review** (default) | `status=pending_practitioner_review` | the work list; count in the label |
| All | no status filter | chronological, newest first |
| Drafts | `status=draft` | clinician-started, not yet submitted by a client |
| Reviewed | `status=in.(reviewed,approved,revision_requested)` | the archive |
| Archived | `status=archived` | hidden behind the last tab, lowest priority |

Tab = `role="tablist"` with `aria-selected`; count badges announce via `aria-label`
("Needs review, 3 submissions").

### 3.2 Sort

- **Needs review: oldest-submitted first (FIFO).** This is the one deliberate inversion
  of "newest first". A review queue is a fairness queue — the client who has waited
  longest is the one at risk of their next session arriving before their homework was
  read. Newest-first systematically starves the oldest.
- All other tabs: newest first by `submitted_at`, tie-broken by `id`.
- Secondary sort control (right-aligned, `Select`): `Waiting longest` · `Newest`.
  Default is tab-dependent; the choice persists in the URL query so a refresh keeps it.
- **`Client A–Z` was in this list and is deliberately withdrawn.** It asked for a keyset
  over a resolved, non-unique join field (`client_name`), which is the worst case for
  cursor pagination — and it was redundant: the default view already groups by client
  under a client-name heading (§3.3), so a row-level client sort duplicated the grouping
  and bought a new query-surface requirement for nothing. Group ordering is client-name
  ascending, which the grouping provides inherently.
- The tie-break is **`id`**, not `client.full_name`. The tie-break must be a real column:
  stable, unique, and available in the row without a join — a resolved name is none of
  those, and a keyset cannot order by it reliably.

### 3.3 Group header (client)

```
▾ Ana Ruiz                                    3 pending · 5 total
```

- Chevron toggles collapse; state persists in the URL (`?collapsed=ana-ruiz`).
- A client with pending work is **expanded by default**; a client with none is
  **collapsed by default** — the queue opens showing only the work.
- Header is a `button` with `aria-expanded`, containing a heading, `h3`, `text-sm font-semibold`.
- Group count in `text-xs text-muted-foreground`.

### 3.4 Row anatomy

One row = one submission. Grid, not flex, so the columns align down the list:

```
Weekly Activity Schedule            Pending Review · waiting 3 days     2 reflections
15 Oct 2026, 7:42 pm · <session slot>
```

```tsx
<Link
  href={`/practitioner/tasks/${s.id}/review`}
  className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1
             rounded-xl border border-border bg-card px-4 py-3
             transition-colors hover:border-primary/40 hover:bg-muted/40
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
             focus-visible:ring-offset-2"
>
  <span className="truncate text-sm font-semibold text-card-foreground">
    {taskLabel(s.taskType)}
  </span>

  <span className="flex shrink-0 items-center gap-1.5">
    <StatusPill status={s.status} />
    <span className="text-xs text-muted-foreground">{relativeWait(s.submittedAt)}</span>
  </span>

  <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
    <span>{formatSubmittedAt(s.submittedAt)}</span>
    {s.sessionLabel && (<><span aria-hidden="true">·</span><span>{s.sessionLabel}</span></>)}
    {s.reflectionCount > 0 && (
      <span className="inline-flex items-center gap-1">
        <ImageIcon className="h-3 w-3" />
        {s.reflectionCount} reflection{s.reflectionCount !== 1 ? "s" : ""}
      </span>
    )}
  </span>
</Link>
```

Field-by-field rationale:

| Slot | Source | Why |
| --- | --- | --- |
| **Activity title** | `task_type` → shared `taskLabel()` | what the work *is*; the only thing that differentiates two rows for the same client |
| **Status pill** | reuse `STATUS_CONFIG` verbatim (`review/page.tsx`) | one visual language; do not invent a second pill. Extract it to `components/status-pill.tsx` so the queue and gateway share it |
| **Waiting time** | `now - submittedAt` | the clinically meaningful number in a review queue. `3 days` in `text-xs`, and escalate the pill treatment past thresholds — see below |
| **Submitted at** | `practice_task_submissions.submitted_at` — a first-class column written transactionally by the commit route | Rook's bundled decision. **Not** `created_at` (that is when the *draft* was created, often days earlier and often by the clinician), and **not** `updated_at` (moves whenever the clinician edits notes). **Not** `status_audit_log` either — see below |
| **Session slot** | `session_id` (Phase 2) | renders only when present; `NULL` = *session unknown (pre-migration)* and must render as **nothing at all** — never a placeholder, and never a guessed session. The reserved level-2 hook (§2, points 3-4) |
| **Attachment count** | count of `client_reflections` for the submission | tells the clinician a canvas is waiting *before* they open the gateway — otherwise they discover it only after loading the bundle |

Waiting-time escalation (colour is never the only signal — the word changes too):

| Waiting | Pill | Treatment |
| --- | --- | --- |
| < 3 days | as-is | no extra element |
| 3–6 days | + `text-amber-700 dark:text-amber-300` on the wait text | "waiting 4 days" |
| ≥ 7 days | row gets `border-amber-300 dark:border-amber-800` | "waiting 8 days — overdue" |

### 3.5 Row → gateway

- The whole row is one `<Link>` to `/practitioner/tasks/{id}/review`. One target, one
  focus stop, no nested interactive elements.
- The row hover raises the border and a chevron appears at the trailing edge
  (`ChevronRight`, `opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100`).
- Keep the gateway's existing left-aligned audit strip (`AuditStrip` in `review/page.tsx`) at the
  top, and add a **back link**: `← Submissions` → `/practitioner/submissions?tab=<tab>`
  so the clinician returns to the filter they came from, not to a reset queue.
- **Make the gateway's "Submitted" label agree with the queue.** `AuditStrip`
  (`review/page.tsx`) already renders an item labelled "Submitted", and it reads
  `submission.createdAt` — the *draft-creation* time, i.e. it is already wrong today. Once
  `submitted_at` exists that label must use it, or the queue and the gateway will show two
  different submission times for the same record. Sweep the gateway for every
  createdAt-as-submitted assumption rather than fixing the one site.
- After a terminal action in the gateway (approve / request revision), the queue row must
  be re-fetched on return. Simplest correct approach: the queue fetches on mount (no
  client-side cache to invalidate); if a cache is added later, invalidate on action.

### 3.6 Empty states — four distinct ones, not one

| Situation | Heading | Body | Action |
| --- | --- | --- | --- |
| No pending, none ever | "Nothing waiting for review" | "Submissions appear here when a client completes an activity." | none |
| No pending, some exist | "You're all caught up" | "3 submissions reviewed. 2 approved, 1 awaiting the client's revision." | Button → **Reviewed** tab |
| Filtered to empty | "No <tab> submissions" | "Nothing matches this filter." | Button → clear filter |
| No clients at all | "No clients yet" | "Add a client to start assigning practice activities." | Button → clients |

"All caught up" is worth the extra state: an empty work list is the one moment a
clinician gets feedback that they are on top of things, and it is cheap.

### 3.7 Loading and error

- **Loading**: 3 skeleton rows per client group (`animate-pulse`, `bg-muted`,
  `rounded-xl h-[68px]`). Never a spinner for a list — the shape must be stable.
- **Error**: one inline `role="alert"` card with `Try again`; do not blank the page.
- **Partial**: a client group whose fetch fails shows an inline "Couldn't load <name>'s
  submissions" row inside its own group, leaving the rest of the list usable. With a
  single collection endpoint this is moot, but design for it: the route may end up
  per-client.

---

## 4. Browser tab / badge

**This is new construction, not a change to existing chrome.** There is no sidebar or
shell badge today — `components/ui/badge.tsx` is only the primitive and nothing in
`components/` renders a pending count. The badge belongs to the **page run**, not to a
shell refactor, and the count it needs already exists as `pending_total` (§6.1).

The queue's nav entry carries a count badge when pending > 0
(`bg-primary text-primary-foreground rounded-full px-1.5 text-xs`). Cap at `9+`. The
badge is the *only* thing that makes the queue discoverable without a notification
channel, so it must be present from day one — the operator's instinct ("no way to pull
submissions up") is largely a **zero-surface-area** problem, and a badge is the fix.

**Its source is `pending_total`, and it must be fetched where the badge renders.** Because
the badge lives outside the queue page, wiring it to the list endpoint alone would leave
it blank on every other page — inverting its purpose, since the moment it matters is when
the clinician is *not* looking at the queue. Fetch it on mount via `count_only=1` (§6.1),
which returns the counts without a row payload.

---

## 5. Accessibility

- The list is a `<ul>`; each group is `<li>` containing an `<h3>` and a nested `<ul>`.
  Do not use `role="grid"` — these are links, not a data grid.
- Group headers are the only interactive non-link elements; they carry
  `aria-expanded` and `aria-controls`.
- Row `Link` has an accessible name that includes the client and activity
  (`aria-label={`Review ${taskLabel(t)} for ${clientName}`}`), because "Weekly Activity
  Schedule" alone is ambiguous across the list.
- Waiting time is text, not a colour-only cue (see the table in 3.4).
- Target size: row padding gives ≥ 44 px height at `py-3` with a single line; verify at
  two lines on mobile.
- Keyboard: Tab visits group headers and rows in DOM order. Do not add `tabIndex` to rows.

---

## 6. API contract (Rook-gated — the blocking dependency)

### 6.1 Endpoint

```
GET /tasks/submissions?status=<csv|in.(...)|omitted>&client_id=<uuid|omitted>
                     &order=<asc|desc>&limit=<int, default 50, max 200>
                     &cursor=<opaque>&count_only=<1|omitted>
```

**Auth:** clinician session only — never token-free, never in `isPublicRoute`. Scoping is
mandatory and query-level: resolve the caller's clients from `clinician_clients` first,
then filter `client_id=in.(...)`. Never fetch-then-filter — with the service-role key
there is no RLS backstop, so a missing filter returns every clinician's rows *and* a
cross-tenant count. See the scoping bullets below.

`count_only=1` returns `{ counts, pending_total }` with **no** `rows` and **no**
`next_cursor`, and applies the **identical tenant resolution and predicate** as the list
path: a count is data, and a cross-tenant count is a leak. It omits the row query, never
the authorisation.

Response:

```json
{
  "rows": [{
    "id": "…", "client_id": "…", "client_name": "Ana Ruiz",
    "task_type": "activity_log", "status": "pending_practitioner_review",
    "submitted_at": "2026-10-15T08:42:11Z",
    "created_at": "…", "updated_at": "…",
    "reflection_count": 2,
    "session_id": null, "session_name": null
  }],
  "counts": { "pending_practitioner_review": 3, "draft": 4, "reviewed": 5, "approved": 3, "revision_requested": 1, "archived": 0 },
  "pending_total": 3,
  "next_cursor": null
}
```

Requirements the audit must confirm:

- **`submitted_at`** is a **first-class column** on `practice_task_submissions`,
  written transactionally by the commit route for **both** author paths (clinician
  commit and client-link commit). Do not derive it from `status_audit_log`. Rook's
  reasoning, which I accept: the audit write is explicitly best-effort —
  `CloudFlare.js` swallows a failed insert as `"non-fatal"`, corroborated by
  `documentation.md` (its API and schema tables) — and a **work-list sort key must not depend on a
  best-effort write with a nullable actor**. Deriving it there makes `submitted_at` null
  for exactly the client submissions the queue exists to show, silently inverting the
  FIFO sort. Do not substitute `updated_at` either: it moves whenever the clinician
  edits notes.
- **Historical rows keep `submitted_at = NULL`.** No backfill (§4.1 of the Item 1 spec).
  The row must render an unknown wait ("submitted date unknown") rather than a
  fabricated one, and the FIFO sort must place nulls **last**, deterministically, not
  wherever the database happens to put them.
- **`counts` and `pending_total` are different scopes, and the difference is load-bearing.**

  | Field | Scope | Drives |
  | --- | --- | --- |
  | `counts` | tenant **and** the active `client_id` | the **tab badges** |
  | `pending_total` | tenant **only** — never `client_id` | the **nav badge** (§4) |

  `counts` must match the tenant+client filter, because a tab labelled "Needs review 3"
  that renders an empty list when clicked is a broken promise. `pending_total` must *not*
  be client-scoped, because its job is "work waiting somewhere in your caseload" — scoping
  it would make the badge vanish exactly when the clinician has filtered to someone else,
  which is when it matters most.

  **Both carry the tenant predicate. Neither carries the status, cursor or limit filters.**
  This split is what stops a later reader from "unifying" the two queries: applying the
  tab's status filter to `counts` makes *every* badge wrong, and that mistake is inviting
  precisely because "counts must run through the same filter as rows" sounds like a safety
  rule. Computing counts client-side from a paginated list is wrong for the same family of
  reasons — a badge that says 3 because only 3 rows were fetched is a bug.
- **`order`** accepts `asc` or `desc` and selects the direction §3.2 specifies per tab;
  **`limit`** is clamped to `[1, 200]`. Both are the endpoint's own decisions, not the
  caller's — an out-of-range value is normalised or rejected, never passed through.
- **The cursor is a position, not an authorisation input.** The tenant predicate is
  resolved and applied on **every** request, including cursor requests, so the cursor
  never carries authority. It decodes as a strict keyset and is used **only** to position
  the window: it may never build, replace, or widen a filter. That sentence is the rule
  worth holding, because the failure mode is not a missing check — it is a naive decoder
  that lets any cursor field reach the query, which turns tampering into filter injection.
  HMAC-signing the cursor is defence in depth *on top of* that, never a substitute for it.
- **The cursor must carry its direction, and a mismatch is a 400.** One tab sorts ascending
  and the rest descending (§3.2), and the tab is a URL param the caller can change while
  holding the same cursor. Silent mispositioning would show a clinician the wrong work
  after a mid-scroll tab change — invisible, and worse than an error.
- **The cursor must cross the `submitted_at IS NULL` block.** Historical rows sort last
  (above), and any comparison with NULL is unknown, so a plain `(submitted_at, id)` keyset
  will either skip that block or loop on it. The ordering is
  `(submitted_at is null), submitted_at, id` with the null-flag carried **inside the
  signed cursor**. Settling this encoding after cursors are in flight invalidates them
  mid-scroll.
- **`client_name`** must be resolved server-side. The alternative (fetch `/clients`, then
  join in the browser) leaks the full client roster into the page payload.
- **Tenant scoping is mandatory at the query level, for rows *and* counts.** Reuse the
  `GET /clients` pattern (`CloudFlare.js`):
  `clinician_clients?clinician_id=eq.<caller>&select=client_id` → then
  `practice_task_submissions?client_id=in.(...)`. **Never fetch-then-filter in the
  handler.** The Worker writes with the service-role key and there is no RLS backstop
  (`supabase/migrations/20260914_worksheet_submissions.sql` states this explicitly,
  and the same note governs this table), so a forgotten filter returns **every
  clinician's submissions**, and — worse, because it is visible on every screen — a
  cross-tenant `counts` object and badge count. `checkClientAccess`
  (`CloudFlare.js`) is the same principle applied per row; a collection endpoint
  must apply it once, in the query.
- **`practitioner_id` is not a scoping key and must not be used as one.** It is `NULL`
  for client-originated submissions (Item 1 spec §4.2), so filtering on it would silently
  drop precisely those rows. Scope by `clinician_clients` → `client_id`, which is what
  authorisation already does.
- **PHI discipline.** The list payload carries activity type, status and timestamps —
  **no `form_data`**. The clinician fetches content only via
  `GET /tasks/submissions/:id/bundle` when they open a row. The existing
  `/client-homework/:id` handler documents exactly this reasoning; hold the
  list to the same rule.
- **Route placement**: declare it above the catch-all `if (method === "POST")` block
  per `.hermes.md` §2 — this is a `GET`, but the same discipline applies to any sibling
  handler added at the same time.

### 6.2 Index

```sql
-- client-scoped, because that is how the endpoint scopes (§6.1). The earlier
-- (practitioner_id, status, updated_at) index is withdrawn: practitioner_id is NULL for
-- client-originated submissions, so it would not serve the queue at all.
create index if not exists practice_task_submissions_client_status_updated_idx
  on public.practice_task_submissions (client_id, status, updated_at desc);

-- partial index for the default tab, which is the hot path
create index if not exists practice_task_submissions_pending_idx
  on public.practice_task_submissions (client_id, submitted_at)
  where status = 'pending_practitioner_review';
```

### 6.3 The session level

Level 1 ships now; level 2 is additive and **only** for rows committed after `session_id`
exists. Order of work: schema → commit route writes `session_id` → `session_name` in the
list payload → session sub-headers in the UI.

Because there is no backfill (§4.1 of the Item 1 spec), **pre-migration rows stay at level
1 permanently** — they have no session and never will. The UI must therefore render a
client group containing a mix of session-grouped and session-less rows without looking
broken, which means the session-less rows sit directly under the client header as a
trailing, unlabelled group. Design for that mixture now; it is the steady state, not a
transient.

**One submission per session — three dimensions, one clinical unit** (settled 2026-10-11
with Item 1 §4.3). A session carries **one** submission in every state, so a
session-grouped queue shows exactly one row
per session: one session → one row → one review → one audit chain in `status_audit_log`. The
weaker "one open draft per session" alternative was withdrawn because it would allow a second
pending row after the first commits, forcing the clinician to approve one clinical unit twice.
Consequence for this queue: there is no aggregation problem to design for at the session
level — but see §6.4 for the one case the unique index cannot see.

### 6.4 Schema (shared with the Item 1 spec — one decision, not two)

```sql
alter table public.practice_task_submissions
  add column if not exists session_id uuid references public.sessions (id) on delete set null;

alter table public.practice_task_submissions
  add column if not exists submitted_at timestamptz;

create index if not exists practice_task_submissions_session_id_idx
  on public.practice_task_submissions (session_id);
```

Plus the two indexes in §6.2, the uniqueness constraint below, and the nullable
`practitioner_id` question raised in §4.5 of the Item 1 spec. No backfill for either column.

```sql
-- ONE SUBMISSION PER SESSION (Item 1 §4.3). Plain, not partial: under this invariant
-- every state is exclusive, so there is no predicate to write. NULL session_id stays
-- unconstrained (Postgres treats NULLs as distinct), which is what keeps pre-migration
-- and clinician-authored rows legitimate.
create unique index if not exists practice_task_submissions_session_unique
  on public.practice_task_submissions (session_id);
```

**The one case this constraint cannot see — flag it, do not paper over it.** The index
constrains rows that *carry* a `session_id`. A clinician-authored submission takes the other
route (`POST /tasks/submissions`, which does not write `session_id` — `CloudFlare.js`),
so it lands with `session_id = NULL` and is invisible to the unique index. If a clinician
"records on behalf of" a client for a session that *also* has a link submission, that session
ends up with two rows and the constraint will not object.

Today that is latent, not live: the clinician path never sets `session_id`, so no session can
currently hold two `session_id`-bearing rows. It becomes real the moment the clinician path
starts writing `session_id` — which it must, if clinician-recorded submissions are ever to join
this queue's session grouping. **Recommendation for that change:** when the clinician path
begins writing `session_id`, it inherits this same unique index, and the record-on-behalf flow
must resolve the session's existing row rather than inserting — i.e. reuse Item 1 §4.3's
resolution contract, not a second insert path. Raise it as a scoped task at that point; it is
not a blocker for the migration being written now.

---

## 7. Regression tests

1. The queue renders `two_choice_worksheet` and `reflection_prompt` rows with real titles,
   not a fallback. (Fails today — `TASK_LABELS` omits both.)
2. "Needs review" sorts oldest-submitted-first.
3. `submitted_at` for a submission whose draft was created 3 days before commit equals the
   commit time, not `created_at`. Assert it is **non-null for a client-link submission**
   specifically — that is the case the audit-derived approach silently lost.
4. Rows with `submitted_at = NULL` (historical) sort **last** and render an unknown wait,
   deterministically and stably under re-sort.
5. Tab badge counts come from `counts`, not from the rendered row count (assert with a
   `limit=1` page against a larger total).
6. Every row's `href` resolves to `/practitioner/tasks/<id>/review`.
7. **The session slot renders nothing when `session_id` is `NULL`** — no placeholder, no
   "session unknown" row text, no empty wrapper element leaking into the DOM. (The row
   itself always renders; only the slot is conditional.)
8. **Cross-tenant isolation (Rook's requirement, rows *and* counts).** Seed clinician A
   with one client and one pending submission, and clinician B with a different client and
   a pending submission. As A, assert the response contains **no row** belonging to B's
   client **and** that `counts` contains **no contribution** from B's submission. Assert
   on the `counts` object separately — a rows-only assertion passes while the badge still
   leaks the other tenant's workload.
9. **The review gateway must not crash on a client-link submission's audit row.**
   `fmtShortId` (`review/page.tsx`) does `id.slice(0, 8)` with no guard, and it is
   called in `AuditLogPanel` for every audit entry. Render the gateway for a submission whose audit
   row has a null actor and assert the page renders (labelling the actor as the client)
   rather than throwing. This test fails today by construction, which is the point.
10. **The `counts` / `pending_total` split (§6.1).** With a `client_id` filter held: assert
   `counts` reflects that client's set **and** `pending_total` does not — and assert both
   carry the tenant predicate, so a second tenant's submissions contribute to neither. A
   rows-only or counts-only assertion passes while the other silently leaks.
11. **`count_only=1` applies the identical tenant predicate.** Same seed as test 8, on the
   count-only path: a cross-tenant count is a leak even though no row is returned. Also
   assert the response carries **no** `rows` and **no** `next_cursor` — the mode omits the
   row query, never the authorisation.
12. **A cursor whose direction disagrees with `order` returns 400.** Fetch a page, then
   replay its cursor against the opposite `order`: expect 400, not a silently mispositioned
   page. Silent mispositioning is the failure this guards, and it renders plausible rows —
   so a shape-only assertion would pass.
13. **The cursor crosses the `submitted_at IS NULL` block.** With historical (NULL) rows
   seeded alongside timestamped ones, page to exhaustion and assert every row appears
   **exactly once** and the NULL block lands last. The failure modes are a skipped row and
   an infinite loop, and neither raises an error.

## 8. Out of scope

- Notifications (email/push) when a submission arrives. The nav badge is the Phase 1
  signal; a notification channel is a separate decision.
- Bulk approve. Clinically, each submission deserves its own read; do not build a
  one-click "approve all".
- Client-side assignment from the queue.
- Redesigning the review gateway itself.

## 9. Handoff

- Blocked on §6. Do not let `agy` build the page against a mocked endpoint and call it
  done — a queue with no route is the same gap in a nicer costume.
- Suggested split once §6 is agreed: (i) endpoint + counts, (ii) group/row components +
  shared `StatusPill` and `taskLabel`, (iii) gateway back-link and return-refresh.
- Implement via `agy`; **commit only, never push**.
- `documentation.md` in the same commit (`.hermes.md` §6).
