-- Run in Supabase SQL editor if columns are missing on `sessions`.
alter table public.sessions
  add column if not exists session_notes text,
  add column if not exists vignette text,
  add column if not exists homework jsonb default '[]'::jsonb,
  add column if not exists quiz jsonb default '[]'::jsonb,
  add column if not exists analysis jsonb,
  add column if not exists modality text;
