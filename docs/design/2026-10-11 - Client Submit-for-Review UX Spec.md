# ALICE — Client Submit-for-Review UX Spec (Item 1)

> **Anchor convention.** Code references here are cited by **symbol**, not by line number —
> a line number rots with any adjacent edit, so it reads as a fact with no expiry. Resolve a
> symbol with `grep -n '<symbol>' <file>`. If a line number is ever genuinely load-bearing it
> must be stamped `as of <sha>`, never left bare.

Author: Aya (UI/UX architect)
Date: 2026-10-11
Status: SPEC — not implemented. Phase 2 is Rook-gated (schema + signed write route).
Scope: `app/practice/[sessionId]/page.tsx`, `components/client-view.tsx`,
`components/tasks/DynamicTaskForm.tsx`

---

## 1. Ground truth (verified by reading the files, not assumed)

| Claim | Evidence |
| --- | --- |
| The approval gate exists | `components/tasks/DynamicTaskForm.tsx` (`ApprovalGate`) — first-person copy in its checkbox label |
| It only renders when there is something to submit to | `DynamicTaskForm`, last-step branch — the last step renders `Submit for review` only in the `isLastStep` (persist) branch |
| The signed link cannot submit | `app/practice/[sessionId]/page.tsx` passes `persist={false}`; that branch then renders "Answers on this page are not saved or sent." |
| A clinician-looking surface shows the client-voice gate | `components/client-view.tsx` passes no `persist` → default `true` → gate + first-person attestation render |
| That surface is a **clinician preview mode**, not a client portal | `app/dashboard/page.tsx` `type ViewMode = "clinician" \| "client"`; the default is `"clinician"`; and `<ClientView client={storeClient} />` is the `"client"` branch of a clinician's own authenticated dashboard, behind `AuthGuard` |
| Server-side submission needs a clinician token | `backend/CloudFlare.js` — `practitioner_id: authUser.id`; and `checkClientAccess(body.client_id)` |
| The commit transition is draft → pending | `backend/CloudFlare.js` and the transition write `status: "pending_practitioner_review"` |
| Submissions cannot be tied to the session that issued the link | `backend/CloudFlare.js` insert body carries `client_id, practitioner_id, task_type, form_data, status, created_at, updated_at` — no `session_id`; the table has none (see the comment in the `/client-homework` handler) |

### The reframe (important — it changes the fix)

The two surfaces are not "client page vs clinician page". They are:

- **(A) Preview-as-client** — a mode inside an authenticated clinician dashboard (`app/dashboard/page.tsx`). The clinician sees a client-voice surface and is invited to attest *as the client*: "I confirm this is my completed work." That is the inversion the operator photographed.
- **(B) The client's signed link** — token-free, currently `persist={false}`, cannot submit at all.

So the defect is not only "the button is on the wrong screen". It is **a voice defect on (A) and a capability gap on (B)**. Both must be fixed, and (A) can be fixed today.

---

## 2. Phase split (state this in the commit; an unstated boundary invites scope creep)

**Phase 1 — ships now, no schema change, no new route.**
1. (A) stops impersonating the client: the gate becomes a third-person "record on behalf of" decision, and the surface is labelled as a preview.
2. (B) gains an honest, well-designed state model for "editable, but nothing is stored yet".

**Phase 2 — blocked on Rook.**
3. (B) gains a real client-side submission. Requires `practice_task_submissions.session_id` and a signed-link write route. Do not build the UI for it before the contract below is agreed.

---

## 3. Phase 1 spec

### 3.1 Surface (A) — `components/client-view.tsx`

Add a persistent preview banner above the form, and keep the clinician's ability to
record work — but in the correct voice.

```
Preview banner (sticky, above the task)
┌───────────────────────────────────────────────────────────────┐
│ 👁  Previewing as <client first name>                         │
│    This is what the client sees on their link. Your entries   │
│    here are recorded against your account, not theirs.        │
└───────────────────────────────────────────────────────────────┘
```

Tailwind (existing tokens only):

```tsx
<div className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 px-4 py-3">
  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
  <div className="space-y-0.5">
    <p className="text-sm font-medium text-foreground">Previewing as {firstName}</p>
    <p className="text-xs text-muted-foreground">
      This is what the client sees on their link. Your entries here are recorded
      against your account, not theirs.
    </p>
  </div>
</div>
```

### 3.2 Surface (A) — the gate copy (`ApprovalGate`, `DynamicTaskForm.tsx`)

Add a `submitContext?: "client" | "practitioner"` prop (default `"client"`).
`ClientView` passes `submitContext="practitioner"`.

| | Client voice (default, unused until Phase 2) | Practitioner voice (Surface A) |
| --- | --- | --- |
| Heading | "Ready to submit for review?" | "Record this submission for {client}?" |
| Body | "Your completed task will be sent to your practitioner for review. You won't be able to edit it after submission." | "You are submitting this on the client's behalf. It will be attributed to you in the audit log and the client will see it as submitted." |
| Checkbox | "I confirm this is my completed work and I'm ready for my practitioner to review it." | "I confirm I am entering these responses on the client's behalf, and the audit log will record me as the submitter." |
| Primary | "Submit for review" | "Record submission" |

Non-negotiable: the practitioner branch must not render first-person client
attestation wording. The audit entry already records the true submitter
(`changed_by_user_id = authUser.id`, `backend/CloudFlare.js`), so the UI must
match what the log will say.

### 3.3 Surface (B) — the client link state model

One state machine, rendered on `app/practice/[sessionId]/page.tsx`. Phase-1 column
says what ships now; Phase-2 column is what the same state becomes.

| # | State | Trigger | Phase 1 rendering | Phase 2 rendering |
| --- | --- | --- | --- | --- |
| S0 | Loading | mount | existing spinner — keep | unchanged |
| S1 | Link invalid/expired | 403 from `/client-homework` | existing error card — keep | unchanged |
| S2 | Nothing assigned | no `practiceTask` **and** empty `homework` | **new empty state** (3.4) | unchanged |
| S3 | Checklist only | no `practiceTask`, `homework.length > 0` | **see 3.5 — the tick boxes are a false affordance and must change** | unchanged |
| S4 | Activity ready | `practiceTask` present | editable form + **LockBadge** (3.6) + "not saved" status (3.7) | editable + "Saved" pill + Save-and-return |
| S5 | In progress (dirty) | first client edit | same as S4, status pill flips to "Unsaved changes" | pill flips to "Saving…" then "Saved" |
| S6 | Reviewing | client presses Submit | *not reachable* | `ApprovalGate`, client voice |
| S7 | Submitting | confirm in S6 | *not reachable* | gate buttons disabled, spinner in primary (`isSubmitting`) |
| S8 | Sent | commit 200 | *not reachable* | **receipt** (3.8) + surface locks |
| S9 | Failed | commit error / offline | *not reachable* | error card in place, work retained, "Try again" |
| S10 | Locked | status `revision_requested` / `approved` | *not reachable* | read-only + clinician feedback block |

Rules that hold in every state:

- **Never lose typed text on a failed request.** S9 must not unmount the form; the
  client's input stays in state and the retry re-sends it.
- **Never claim safety we don't provide.** Phase 1 has no persistence, so it must not
  show "Saved", a cloud icon, or a tick. It says "not sent" in plain words.
- **The link is a capability, not an identity.** No name, no client id, nothing
  beyond the session title renders in the chrome.

### 3.4 S2 — empty state (nothing assigned)

Today: the fallback renders a dashed box "No practice tasks currently assigned for this session."
It is close, but it sits under a page headed "Client Practice Tasks" and offers no
next step. Replace with:

```
                    ┌─────────────┐
                    │   ◷ (icon)  │   muted circle, 56px, bg-muted
                    └─────────────┘
             Nothing to complete yet
   Your clinician hasn't added an activity to this
   session. You'll get a new link when they do.

   ── Session ─────────────────────────────
   <session name>
```

Tailwind:

```tsx
<div className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
    <Clock className="h-6 w-6 text-muted-foreground" />
  </div>
  <h2 className="text-base font-semibold text-foreground">Nothing to complete yet</h2>
  <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
    Your clinician hasn&apos;t added an activity to this session. You&apos;ll get a
    new link when they do.
  </p>
</div>
```

### 3.5 S3 — the checklist tick boxes are a false affordance (bug, not polish)

`app/practice/[sessionId]/page.tsx` renders a `w-full` `<button>` per homework
item that toggles `completed[index]` in local state. Nothing persists (no token, and
`ReflectionCanvas.tsx` records "No localStorage / sessionStorage" as a guardrail).
The button has hover, active-scale and a check-circle — a full interactive promise —
and everything is lost on reload.

Phase 1 fix: keep the list (it is useful information) but make it non-interactive.
Render it as a static checklist with `aria-disabled` raised to a plain list:

```tsx
<ul className="space-y-2">
  {homework.map((item, i) => (
    <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
      <span className="text-sm leading-relaxed text-foreground">{getTaskLabel(item)}</span>
    </li>
  ))}
</ul>
```

Delete the progress bar in Phase 1. A percentage that cannot move is a
lie. It returns in Phase 2, driven by real submission status.

### 3.6 Editable vs locked — the distinction must be legible at a glance

The client must know, without reading a paragraph, that **the clinician chose the
activity** and that **the client may edit their answers**. Two different locks.

Add a **LockBadge** in the task header (signed-link page, above the form):

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
    <Lock className="h-3 w-3" />
    Set by your clinician
  </span>
  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800
                   dark:bg-emerald-950/50 dark:text-emerald-300">
    <PencilLine className="h-3 w-3" />
    You can edit your answers
  </span>
</div>
```

The second badge is stateful:

| Surface state | Badge | Icon | Classes |
| --- | --- | --- | --- |
| editable, untouched | "You can edit your answers" | `PencilLine` | emerald (as above) |
| editable, dirty | "Unsaved changes" | `PencilLine` | amber — `bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300` |
| sent / locked | "Sent — locked" | `Lock` | slate — `bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300` |

When locked (S8/S10): every control gets `disabled`, the wrapper gets
`opacity-60 pointer-events-none` **only on the form body** (never on the receipt or the
clinician's feedback), and `aria-readonly` is set on the region. Do not use
`pointer-events-none` alone — it is invisible to keyboard users; the underlying
inputs must carry `disabled` or `readOnly`.

### 3.7 Phase 1 — the honest "not stored" status

Phase 1 has no persistence, so the status region must say exactly that and nothing
more. Place it in the header row, right-aligned, where `SaveStatusBadge` sits in the
persisting form (`DynamicTaskForm.tsx`).

```tsx
<div role="status" aria-live="polite"
     className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
  <CloudOff className="h-3.5 w-3.5" />
  <span>Not saved yet — keep this tab open</span>
</div>
```

Plus a `beforeunload` guard while any input is dirty (S5), so a stray back-swipe does
not silently destroy a completed worksheet:

```tsx
useEffect(() => {
  if (!dirty) return;
  const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload", h);
  return () => window.removeEventListener("beforeunload", h);
}, [dirty]);
```

And replace the current honest-but-bare line at `DynamicTaskForm.tsx`
("Answers on this page are not saved or sent.") with the same tokens as the status
pill so the two do not contradict each other in tone.

### 3.8 Phase 2 — the "your work is safe" moment (the first one this surface ever has)

The success screen. The existing `committed` screen (`DynamicTaskForm.tsx`) is
close; it needs a receipt, not just a tick.

```
        ┌───────────┐
        │     ✓     │   h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950
        └───────────┘
       Sent to your clinician
  Your <activity title> was submitted on
  <Thu 15 Oct, 7:42 pm>. You'll hear back
  after your clinician reviews it.

  ┌────────────────────────────────────┐
  │ Reference      AX-4F2C             │
  │ Activity       Weekly Activity…     │
  │ Submitted      15 Oct 2026, 7:42pm │
  └────────────────────────────────────┘

  [ View what you sent ]   (secondary)
```

Specifics:

- **Timestamp with a visible timezone-safe format** (`15 Oct 2026, 7:42 pm`). The
  client needs to be able to say "I sent it Tuesday night" in a phone call.
- **A short human reference** — the first 4 hex of the submission UUID, uppercase,
  e.g. `AX-4F2C` from `4f2c…`. Never the full UUID: it is not a security boundary and
  it is unreadable over the phone. Label it "Reference", never "ID".
- **"View what you sent"** opens the read-only view of their **own** submission.
  That is a *client-scoped* read (Phase 2 route) — if it is not built, omit the
  button entirely rather than showing a dead one.
- Do **not** put a countdown, a "your clinician has been notified" claim, or an SLA
  here. We cannot honour a notification promise from the Worker today.

### 3.9 S9 — dropped connection (the state this product does not have yet)

Phase 2 has the first save, so it needs the first failure design. Rules:

1. The client's work stays on screen. The form is never unmounted on failure.
2. The failure is announced: `role="alert"` / `aria-live="assertive"`.
3. The message is specific about what is safe: "We couldn't send your work — you're
   still offline. Your answers are still on this page."
4. One recovery action, repeatable: primary "Try again". Secondary "Copy my answers"
   (`navigator.clipboard.writeText`) as the last-resort escape hatch — a client who
   has spent 40 minutes on a thought record must be able to rescue the text if the
   connection never returns.
5. If `navigator.onLine === false`, say "You're offline" up front rather than after a
   20-second timeout, and listen for `online` to auto-retry once.

```tsx
<div role="alert" aria-live="assertive"
     className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4
                dark:border-rose-900 dark:bg-rose-950/40 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex items-start gap-3">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
    <div>
      <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
        We couldn&apos;t send your work
      </p>
      <p className="mt-0.5 text-xs text-rose-700/80 dark:text-rose-300/80">
        Your answers are still on this page. Try again when you have signal.
      </p>
    </div>
  </div>
  <div className="flex shrink-0 gap-2">
    <Button variant="outline" size="sm" onClick={copyAnswers}>Copy my answers</Button>
    <Button size="sm" onClick={retry} className="gap-1.5">
      <RefreshCw className="h-3.5 w-3.5" /> Try again
    </Button>
  </div>
</div>
```

### 3.10 Save-and-return-later — the honest answer

**Phase 1: no. Phase 2: yes, and it is the single highest-value thing in this spec.**

A reflection or 3 C's worksheet is done at home, at night, over days. Without
save-and-return, a closed tab is a lost task, and the client-facing failure mode is
"my homework vanished" — which damages the therapeutic alliance, not just the UX.

Phase 1 cannot do it: the surface is token-free *and* the canvas component
(`ReflectionCanvas.tsx`) forbids browser storage as an architectural guardrail.
Do not invent a localStorage draft to work around it — that guardrail exists because
this is a clinical surface on shared devices, and a local draft is unencrypted PHI on
a device we do not control.

Phase 2 therefore has a hard prerequisite: a **server-side, signed-link-scoped draft**.
That is the same route as the submission with `status: "draft"`, keyed by the session
in the link. Once it exists, "Save and finish later" is a secondary action beside
Submit, and returning to the same link resumes the draft with a "Welcome back —
we saved your draft from Tuesday" banner.

---

## 4. Phase 2 contract (Rook-gated — do not implement before review)

### 4.1 Schema

Two columns, one decision. Both are needed and they should land together.

```sql
-- (1) the session that issued the link — the whole point of this phase
alter table public.practice_task_submissions
  add column if not exists session_id uuid references public.sessions (id) on delete set null;

-- (2) the queue's sort key, written transactionally by the commit route
--     (Rook, bundled decision on HEAD 924d57a). NOT derived from status_audit_log.
alter table public.practice_task_submissions
  add column if not exists submitted_at timestamptz;

create index if not exists practice_task_submissions_session_id_idx
  on public.practice_task_submissions (session_id);

-- INVARIANT: one submission per session (settled 2026-10-11 — see §4.3).
-- Deliberately a PLAIN unique index, not a partial one: under this invariant every
-- state is exclusive, so there is no predicate to write. Postgres treats NULLs as
-- distinct in a unique index, which is a feature here — historical rows and
-- clinician-authored drafts carry session_id = NULL and stay unconstrained, while
-- link-scoped rows (which always carry session_id) are constrained to one.
-- Confirm NULL-distinctness is the intent rather than reaching for `nulls not distinct`.
create unique index if not exists practice_task_submissions_session_unique
  on public.practice_task_submissions (session_id);

-- Scope is clinician_clients → client_id IN (…), so the useful index is client-scoped.
-- An index on (practitioner_id, …) would be dead weight once §4.2 sets it NULL.
create index if not exists practice_task_submissions_client_status_updated_idx
  on public.practice_task_submissions (client_id, status, updated_at desc);
```

`worksheet_submissions` (`supabase/migrations/20260914_worksheet_submissions.sql`)
already has `session_id` — that is the precedent to follow.

**No backfill. Ever.** Existing rows keep `session_id = NULL`, whose defined meaning is
*session unknown (pre-migration)*. Inferring a session from `client_id` + `created_at`
proximity is the exact guess §2 of the queue spec refuses, and a guessed session on a
clinical record is worse than an absent one. The same applies to `submitted_at` for
historical rows: leave it NULL and render the wait as unknown rather than inventing one.

### 4.2 Route

```
POST /client-submissions/:sessionId?exp=<int>&sig=<hex>

NOT behind requireUser. Verified with the SAME verifyClientLink(sessionId, url.searchParams, env)
that guards GET /client-homework/:id (backend/CloudFlare.js).
```

**Derivation rules — corrected against Rook's audit (this section previously demanded an
actor that does not exist):**

- `client_id` comes from the **session row**, never from the body. The body carries
  `task_type` and `form_data` only.
- `practitioner_id` is **NULL** on this path. The earlier instruction to take it "from
  the session row" was unimplementable: `sessions` has no `practitioner_id` column, and
  the Worker never reads one from that table (`SESSION_FULL_SELECT`,
  `CloudFlare.js`, enumerates every column it knows, and none is an owner).
  Do not substitute `authUser.id` — there is no `authUser` on a token-free route, and
  inventing one would write a fabricator into a clinical audit trail.
  **Consequence:** authorisation is unaffected, because `checkClientAccess`
  (`CloudFlare.js`) is scoped by `clinician_clients(clinician_id, client_id)` and
  never reads `practitioner_id`. Verified, not assumed.
- `session_id` is the path segment — which is the whole point of the column.
- `submitted_at` is written **in the same statement** as the `draft →
  pending_practitioner_review` transition (§4.1), not derived from `status_audit_log`.
- Status may only be `draft` or `pending_practitioner_review`; the route must refuse to
  write any other value, and must refuse to touch a row that is not `draft`.
- Route must be declared **above** the catch-all `if (method === "POST")` AI handler in
  `backend/CloudFlare.js` (`.hermes.md` §2 route precedence).
- **One submission per session — see §4.3.** The earlier wording here said "one link, one
  session, one open draft", which is the *weaker* invariant (a) and is **withdrawn**: it
  would permit a second row once the first commits, leaving a session with two pending
  submissions. The settled invariant is one submission per session, in every state.
- The link grants no read of any other session's rows. Every UPDATE must carry a
  `session_id=eq.<path>` filter as well as the id, or the token-free route is an IDOR.
  (The committed route already does this — `CloudFlare.js`.)

### 4.3 The session invariant, and what it buys (settled 2026-10-11)

**Decision: one submission per session, in every state. Not one open draft.**

Why, from what the product actually models:

1. **A session carries exactly one clinician-chosen activity.** `GET /client-homework/:id`
   returns `practiceTask: projectClientPracticeTask(row.practice_package)` — singular, from
   one `practice_package` object with one `task_type`. No projection renders two. So the
   rationale that favours the weaker invariant ("the client could start another task in that
   session") describes a flow that cannot even be displayed.
2. **A link is one piece of homework for one session, and a short-lived one** — default TTL
   14 days, max 30 (`CloudFlare.js`) — not an open-ended workspace.
3. **The clinical unit and the artefact stay 1:1.** The review gateway reviews one
   submission; `status_audit_log` is keyed on `submission_id`; approval locks immutability on
   it. Two rows for one session means one clinical unit needing two approvals and two audit
   chains. The queue's session grouping is only clean under this invariant — one session,
   one row, one review.
4. **A revision is a state transition on one row, never a new row.** `revision_requested` →
   the client edits → resubmit. The status vocabulary already supports it
   (`types/tasks.ts`). A second row would orphan the first row's audit history and show
   two submissions where the clinical truth is one task revised.
5. **Another reflection is another attachment, not another submission.** This is the most
   plausible-looking counter-case, so it is settled explicitly: `client_reflections` is keyed
   on `submission_id` and already allows many reflections per submission, and the review
   gateway renders `reflections.length` images (`review/page.tsx`). A client wanting to
   add a second drawing adds a reflection, never a submission.

**What the invariant buys — the resume path, for free.** This is the real prize, and it is
why the weaker invariant would have cost more than it looks. The client surface cannot store
an id: there is no token, and `ReflectionCanvas.tsx` forbids `localStorage`/`sessionStorage`
as an architectural guardrail. So the `id` returned by the route survives only in memory, and
after a reload the client cannot reference its own draft. Under a uniqueness constraint scoped
to the session, it no longer needs to: the session **is** the handle. This delivers the
server-side save-and-return that §3.10 requires as a hard Phase 2 prerequisite, with no
client-side storage at all.

**Required route behaviour under this invariant:**

- **The client always POSTs without `id`.** It has no durable way to hold one. The route
  resolves the session's row rather than requiring the caller to name it.
- On a unique violation (`23505`) on `session_id`: scoped `SELECT` by `session_id` and return
  that row with **200** — not an error. The scoped SELECT must never widen to `client_id`,
  which spans sessions (the same rule `/client-homework` documents at `CloudFlare.js`).
- Behaviour by the existing row's status:
  | Existing status | Route does | UI renders |
  | --- | --- | --- |
  | `draft` | update it in place | resumed editing — this is the autosave path |
  | `pending_practitioner_review` | do **not** overwrite; return the row | the "sent" receipt (S8) |
  | `revision_requested` | return the row | locked + clinician feedback (S10) |
  | `approved` / `archived` | return the row | locked (S10) |
- **Never return 409 to a retry.** The committed route returns 409 for a non-draft update
  (`CloudFlare.js`, both 409 gates). To a client who just tapped Submit on a flaky connection,
  409 is indistinguishable from a failure and invites a second attempt. The receipt is
  already `{ id, status }`, so the UI can branch on `status` alone and render the receipt for
  anything committed.
- `body.id` support may stay for compatibility, but must remain scoped by
  `id=eq.<id>&session_id=eq.<path>&status=eq.draft` exactly as it is now.

**Resume-on-load requires a read, not just an idempotent write.** The POST path only helps
once the client submits something. To greet them correctly on arrival — "welcome back, we
saved your draft" — the load call must report the session's submission state. Recommendation:
`GET /client-homework/:id` gains a narrow `submission: { status, submitted_at } | null`
alongside `practiceTask`. Never the id (the client does not need it and omitting it removes
id-passing entirely) and never `form_data` in the list-shaped projection. Resuming the
client's *own* saved answers additionally needs that submission's `form_data` / `canvas_data`,
scoped by `session_id` — a content disclosure to the token-free surface, so **Rook's call**,
not mine. The scoping rule is non-negotiable either way: by `session_id`, never by `client_id`.

### 4.4 Type widening (mandatory, and it is not a one-line change)

`practitioner_id` becoming nullable ripples into four type declarations:

| Type | File:line | Change |
| --- | --- | --- |
| `PracticeTaskSubmissionRow.practitioner_id` | `types/tasks.ts` | `UUID` → `UUID \| null` |
| `NormalisedSubmission.practitionerId` | `types/tasks.ts` | `UUID` → `UUID \| null` |
| `NormalisedAuditLogEntry.changedByUserId` | `types/tasks.ts` | see the dilemma below |
| `StatusAuditLogRow.changed_by_user_id` | `types/tasks.ts` | see the dilemma below |

**Do not widen these two, and this is the trap in a mechanical sweep:** they read as the
same field but are always clinician-authored, so they stay non-null —
`SubmissionPractitionerNoteRow.practitioner_id` (`types/tasks.ts`) and
`NormalisedPractitionerNote.practitionerId`. Widening the latter would immediately
break the one live render site, `review/page.tsx`
(`fmtShortId(n.practitionerId)`), because `fmtShortId` takes a non-nullable string. Widen
only what §4.2 makes nullable.

Audit every read site, not just the declaration. `NormalisedSubmission.practitionerId` is
currently rendered nowhere (the only `practitionerId` render, `review/page.tsx`, is a
**note's** actor, which is always a clinician), so that one is safe to widen. The audit
row is not — see §4.5.

### 4.5 The audit-actor dilemma (this one has no clean branch)

Two verified facts and one fact I could not verify:

1. **Verified** — the audit write is best-effort: `CloudFlare.js` catches and
   logs `"status_audit_log insert failed (non-fatal)"`; `documentation.md` (its API and schema tables)
   both document it as "best-effort, non-fatal".
2. **Verified** — the gateway's render of that column is **unguarded**:
   `fmtShortId(id: string) { return id.slice(0, 8) + "…" }` (`review/page.tsx`),
   called in `AuditLogPanel` for every audit entry and in `AuditStrip` for the approval entry. A `null`
   reaching either site throws a `TypeError` and takes the whole review page down.
3. **Not verified** — whether `changed_by_user_id` is `NOT NULL`. Rook read the live
   schema at HEAD `924d57a`; I could not. There is no DDL for this table in the repo (the
   only two migrations are `20260603_session_clinical_fields.sql` and
   `20260914_worksheet_submissions.sql`), and the schema gateway
   (`https://alice-mcp.neuvoteam.workers.dev/context`, per `.hermes.md` §2) returns only a
   module and tool list — **no column schema**, so it cannot settle this. Rook's
   `NOT NULL` reading stands unchallenged and uninterrogated by me.

Either branch is broken for exactly the client submissions the queue exists to show:

| If `changed_by_user_id` is… | Then the client-link commit's audit insert… | Result |
| --- | --- | --- |
| `NOT NULL` | fails on a null actor | swallowed by the `try/catch` → **no `draft → pending` audit row at all** → the gateway's timeline silently omits the most important event, and any audit-derived sort key is null |
| nullable | succeeds with a null actor | `fmtShortId(null)` at `review/page.tsx` → **the review gateway crashes** |

Rook's recommendation resolves the *sort key* problem completely and I accept it: add
`submitted_at`, keep the audit table as the audit trail. But it does not by itself resolve
what the timeline shows for the client's own transition, so pick one:

- **Preferred (a):** make `changed_by_user_id` nullable, widen the two audit types, and
  **guard every render site** (`entry.changedByUserId ?? ""` → render "the client, via
  their practice link" when absent). The audit then tells the truth: no user did this.
  Note that Rook argued *against* the nullable route; my additional reason for caution is
  fact 2 — today it is a crash, so nullability and the guard ship together or not at all.
- **Fallback (b):** write no audit row on the client path at all, and have the gateway
  render the "submitted" event synthetically from `submitted_at` + `status`, leaving
  `status_audit_log` exclusively for actor-driven transitions.

**Non-negotiable either way:** `fmtShortId` must be guarded before any client-link
submission can exist. That is a two-line change and it is independent of the choice above.

**Open question for Rook, with a named falsifier:** `documentation.md` lists
`practice_task_submissions.practitioner_id` but no constraints. If that column is
`NOT NULL`, then setting it to `NULL` per §4.2 makes the insert fail and Phase 2 has no
storage at all. Verify the constraint before the route is written. If it *is* `NOT NULL`,
the options are (i) drop the constraint — defensible, since the column is now meaningless
for client-originated rows and nothing scopes by it — or (ii) a documented sentinel, which
I would refuse in a clinical audit trail.

---

## 5. Accessibility (WCAG 2.1 AA)

- Status region: `role="status"` + `aria-live="polite"`; failure `role="alert"` +
  `assertive`. Never announce on every keystroke — debounce announcements to state
  transitions.
- Badges carry text, not colour alone. Locked state is conveyed by the word "locked"
  and by `disabled`, not by grey.
- Focus: the sent/locked transition must move focus to the receipt heading
  (`tabIndex={-1}` + `.focus()`), so a screen-reader user is told the outcome.
- All interactive targets ≥ 44×44 CSS px (the existing `ToolbarBtn` is `h-10 w-10` — fine).
- The `beforeunload` guard must not fire when the form is untouched.

## 6. Regression tests (lock the fixes in place)

1. `DynamicTaskForm` with `submitContext="practitioner"` renders **no** first-person
   "I confirm this is my completed work" string. (Fails today.)
2. `ClientView` renders the preview banner and never renders a client-voice submit.
3. The signed-link page with `persist={false}` renders **no** `Submit for review`
   control and **no** "Saved" affordance.
4. Ticking an item on the S3 checklist leaves no state that survives a remount
   (Phase 1: assert the list is non-interactive — no `button` role).
5. `beforeunload` handler is absent when clean and present when dirty.

## 7. Out of scope

- Any change to link minting, TTL, or signature format (`/client-link/:sessionId`).
- Client-side accounts, login, or identity on the signed link. It stays token-free.
- local/session storage drafts — refused on principle (see 3.10).
- Turning `ClientView` into a client-facing portal. It is the clinician's preview mode.

## 8. Handoff

- Implement via `agy` against this spec; **commit only, never push**
  (upstream for `alan` is `origin/debug`, not `origin/alan`).
- Route §4 to Rook for the schema + edge-route audit before Phase 2 is written.
- `documentation.md` must be updated in the same commit as any code change
  (`.hermes.md` §6), or the commit body must carry `DOCS: none` with a reason.
