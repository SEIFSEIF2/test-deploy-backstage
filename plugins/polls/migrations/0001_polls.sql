-- Team Polls plugin. Tenancy is app-level (no RLS in this codebase):
-- every query in server.ts scopes .eq('company_id', ...).
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  created_by uuid not null,
  question text not null,
  options jsonb not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists polls_company_id_idx
  on public.polls (company_id, created_at desc);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  member_id uuid not null,
  option_index integer not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, member_id)
);
