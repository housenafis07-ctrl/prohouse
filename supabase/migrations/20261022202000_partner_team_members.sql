begin;

create table if not exists public.partner_team_members (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (partner_user_id, member_user_id),
  check (role in ('member','manager')),
  check (partner_user_id <> member_user_id)
);

create index if not exists partner_team_members_partner_idx
  on public.partner_team_members(partner_user_id, created_at desc);

alter table public.partner_team_members enable row level security;

drop policy if exists partner_team_members_owner_read on public.partner_team_members;
create policy partner_team_members_owner_read
on public.partner_team_members
for select to authenticated
using (partner_user_id = auth.uid() or member_user_id = auth.uid());

-- Writes are performed by the protected API using service_role after checking
-- the active BUSINESS entitlement and its employee seat limit.
revoke insert, update, delete on public.partner_team_members from authenticated, anon;
grant select on public.partner_team_members to authenticated;

grant all on public.partner_team_members to service_role;

commit;
