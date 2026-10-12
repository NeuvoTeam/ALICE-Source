-- ALICE — Phase 2 schema: one submission per session unique index.
--
-- Source of truth:
--   docs/design/2026-10-11 - Client Submit-for-Review UX Spec.md (§4.1, §4.3)
--   docs/design/2026-10-11 - Practitioner Review Queue Spec.md (§6.3, §6.4)
-- Ruling: Aya ruled (b) one submission per session, in every state (not one open draft).
--
-- Why it matters:
--   The client surface can hold no id (no token; localStorage/sessionStorage are forbidden
--   by an architectural guardrail), so the {id, status} receipt lives only in memory and
--   the SESSION is the resume handle. Keying uniqueness to session_id gives server-side
--   save-and-return and idempotent submission retries without any browser storage.
--
-- Known gap:
--   The index only constrains rows that CARRY a session_id. Clinician-authored rows
--   and historical pre-migration rows (session_id = NULL) are invisible to it and remain
--   unconstrained. Postgres treats NULLs as distinct in a unique index, which is deliberate.
--
-- Documented precondition (the operator runs this FIRST, separately):
--   select session_id, count(*) as n, array_agg(id) as ids, array_agg(status) as statuses
--   from public.practice_task_submissions
--   where session_id is not null
--   group by session_id
--   having count(*) > 1;
--
-- Expect ZERO rows. If it returns rows, STOP — do not auto-resolve. A duplicate row may carry
-- client_reflections and status_audit_log children; which one survives is a clinical-record
-- decision, not a cleanup step. Stop and escalate with the rows listed.
--
-- Why the expectation is safe — on a falsifiable basis rather than an assumption:
--   The only writer of session_id is the client-link INSERT, and no local worker bundle ever
--   contained that route. The only two bundles under backend/.wrangler/tmp/ (bundle-xWvLN1,
--   dev-881WdO) are both dated 2026-10-09 — two days before the route landed on 2026-10-11
--   13:42 — and neither contains the string "client-submissions".
--   Falsifier: any newer bundle containing that route would make this leg live. There isn't one.
--   Prefer this over "no wrangler dev is running": that form is falsified in appearance by any
--   harmless local listener (there is one on 127.0.0.1:8788), so it is the weaker evidence.

begin;

-- In-file guard, so dirty data can never apply silently
do $$
declare d uuid;
begin
  select session_id into d from public.practice_task_submissions
  where session_id is not null group by session_id having count(*) > 1 limit 1;
  if d is not null then
    raise exception 'duplicate session_id rows exist - resolve before creating the unique index';
  end if;
end $$;

-- Enforce one submission per session across all states.
-- Deliberately a plain unique index (not partial): NULL session_id stays unconstrained.
-- DO NOT use CREATE UNIQUE INDEX CONCURRENTLY — it cannot run inside a transaction block.
create unique index if not exists practice_task_submissions_session_unique
  on public.practice_task_submissions (session_id);

-- Drop the redundant plain index created in 20261011_task_submissions_queue.sql.
-- The unique index serves identical lookups without duplicate write overhead.
drop index if exists practice_task_submissions_session_id_idx;

commit;

-- Verification block, AFTER commit;:
-- indexdef MUST contain UNIQUE. `if not exists` is a silent no-op if an index of that name
-- already exists but is NOT unique — so this query, not the absence of an error, is the proof.
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'practice_task_submissions'
  and indexname = 'practice_task_submissions_session_unique';

-- confirm the redundant plain index is gone
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'practice_task_submissions' order by indexname;
