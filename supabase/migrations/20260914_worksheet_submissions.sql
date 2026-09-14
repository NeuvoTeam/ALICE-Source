-- Run in the Supabase SQL editor if `worksheet_submissions` is missing.
-- The Worker writes with the service-role key (bypasses RLS), matching the
-- existing sessions migration, so no policies are defined here.
create table if not exists public.worksheet_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists worksheet_submissions_client_id_idx
  on public.worksheet_submissions (client_id);

create index if not exists worksheet_submissions_session_id_idx
  on public.worksheet_submissions (session_id);
