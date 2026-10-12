-- ALICE — Phase 2 schema for the client submit-for-review surface.
--
-- Source of truth:
--   docs/design/2026-10-11 - Client Submit-for-Review UX Spec.md   (§4.1)
--   docs/design/2026-10-11 - Practitioner Review Queue Spec.md     (indexes, sort key)
-- Ruling: Rook, bundled schema decision on HEAD 924d57a — nullable session_id with NO
--         backfill, submitted_at as the single submitted-time source, and DROP NOT NULL
--         on both actor columns (which is what removes the need for a schema dump as a gate).
--
-- Run in the Supabase SQL editor: the Worker holds no DDL path and the MCP gateway
-- (alice-mcp /tools) exposes no schema tool.
-- Idempotent — safe to re-run; every statement is a no-op if it is already applied.
--
-- NO BACKFILL, BY DESIGN. Existing rows keep session_id = NULL ("session unknown,
-- pre-migration") and submitted_at = NULL ("wait unknown"). Inferring either from
-- client_id + created_at proximity puts a guess on a clinical record; an absent value is
-- the honest one. Historical rows sort last in the queue and render an unknown wait.

begin;

-- 1. The session that issued the link, and the queue's sort key.
alter table public.practice_task_submissions
  add column if not exists session_id uuid references public.sessions (id) on delete set null,
  add column if not exists submitted_at timestamptz;

-- 2. The client-link path carries no user identity, so the actor is honestly null.
--    DROP NOT NULL is idempotent: a no-op when the column is already nullable, and it
--    makes the client-link insert valid either way.
alter table public.practice_task_submissions
  alter column practitioner_id drop not null;

alter table public.status_audit_log
  alter column changed_by_user_id drop not null;

-- 3. Indexes. Authorisation scopes through clinician_clients -> client_id IN (...), so the
--    useful shape is client-scoped; a (practitioner_id, ...) index would be dead weight
--    once statement 2 nulls that column.
create index if not exists practice_task_submissions_session_id_idx
  on public.practice_task_submissions (session_id);

create index if not exists practice_task_submissions_client_status_updated_idx
  on public.practice_task_submissions (client_id, status, updated_at desc);

create index if not exists practice_task_submissions_pending_idx
  on public.practice_task_submissions (client_id, submitted_at)
  where status = 'pending_practitioner_review';

commit;

-- 4. Verify. Expect is_nullable = YES on all four columns, and all three indexes present.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (   (table_name = 'practice_task_submissions'
           and column_name in ('session_id', 'submitted_at', 'practitioner_id'))
       or (table_name = 'status_audit_log'
           and column_name = 'changed_by_user_id'))
order by table_name, column_name;

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'practice_task_submissions'
order by indexname;

-- The existing is_nullable checks are necessary but NOT sufficient, because a
-- CHECK constraint, a column DEFAULT, or a BEFORE INSERT trigger can each still
-- block or override a NULL actor after DROP NOT NULL. All three returning empty
-- rows is what actually proves the client-link insert is unblocked.
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.practice_task_submissions'::regclass, 'public.status_audit_log'::regclass) and contype = 'c';

select column_name, column_default from information_schema.columns where table_schema = 'public' and ((table_name = 'practice_task_submissions' and column_name = 'practitioner_id') or (table_name = 'status_audit_log' and column_name = 'changed_by_user_id'));

select tgname, tgrelid::regclass from pg_trigger where not tgisinternal and tgrelid = 'public.practice_task_submissions'::regclass;
