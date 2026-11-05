begin;

create table if not exists public.developer_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.developer_lead_requests(id) on delete cascade,
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists developer_lead_notes_lead_created_idx
  on public.developer_lead_notes(lead_id, created_at desc);
create index if not exists developer_lead_notes_developer_idx
  on public.developer_lead_notes(developer_id);

create table if not exists public.developer_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.developer_lead_requests(id) on delete cascade,
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in ('call', 'message', 'meeting', 'other')),
  summary text not null check (char_length(summary) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists developer_lead_activities_lead_created_idx
  on public.developer_lead_activities(lead_id, created_at desc);
create index if not exists developer_lead_activities_developer_idx
  on public.developer_lead_activities(developer_id);

alter table public.developer_lead_notes enable row level security;
alter table public.developer_lead_activities enable row level security;

revoke all on public.developer_lead_notes from anon, authenticated;
revoke all on public.developer_lead_activities from anon, authenticated;
grant all on public.developer_lead_notes to service_role;
grant all on public.developer_lead_activities to service_role;

commit;
