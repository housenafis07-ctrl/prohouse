-- Developer CRM professional foundation (additive only).
-- Existing public lead intake remains on developer_lead_requests.
-- All new CRM tables are server-accessed through authenticated Next.js APIs.

alter table public.developer_lead_requests
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists priority text not null default 'normal',
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists budget_min numeric(14,2),
  add column if not exists budget_max numeric(14,2),
  add column if not exists preferred_rooms integer[],
  add column if not exists preferred_area_min numeric(10,2),
  add column if not exists preferred_area_max numeric(10,2),
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists closed_at timestamptz;

alter table public.developer_lead_requests
  add constraint developer_lead_requests_priority_check
    check (priority in ('low','normal','high','urgent')),
  add constraint developer_lead_requests_budget_check
    check (budget_min is null or budget_min >= 0)
    not valid,
  add constraint developer_lead_requests_budget_range_check
    check (budget_max is null or budget_min is null or budget_max >= budget_min)
    not valid,
  add constraint developer_lead_requests_area_range_check
    check ((preferred_area_min is null or preferred_area_min > 0)
       and (preferred_area_max is null or preferred_area_max > 0)
       and (preferred_area_min is null or preferred_area_max is null or preferred_area_max >= preferred_area_min))
    not valid;

create table if not exists public.developer_team_members (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sales_agent'
    check (role in ('owner','admin','sales_manager','sales_agent','marketing','analyst')),
  status text not null default 'active'
    check (status in ('invited','active','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (developer_id, user_id)
);

create table if not exists public.developer_lead_assignments (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  lead_id uuid not null references public.developer_lead_requests(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assignment_reason text,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

create unique index if not exists developer_lead_assignments_one_current_idx
  on public.developer_lead_assignments(lead_id)
  where unassigned_at is null;

create table if not exists public.developer_tasks (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  lead_id uuid references public.developer_lead_requests(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  task_type text not null default 'follow_up'
    check (task_type in ('call','message','meeting','follow_up','document','other')),
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text,
  due_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.developer_appointments (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  lead_id uuid references public.developer_lead_requests(id) on delete set null,
  complex_id uuid references public.residential_complexes(id) on delete set null,
  unit_id uuid references public.complex_units(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  appointment_type text not null default 'viewing'
    check (appointment_type in ('viewing','office_meeting','phone','other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_appointments_time_range_check
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists developer_team_members_user_status_idx
  on public.developer_team_members(user_id, status);
create index if not exists developer_lead_requests_developer_assigned_status_idx
  on public.developer_lead_requests(developer_id, assigned_to, status, created_at desc);
create index if not exists developer_lead_requests_follow_up_idx
  on public.developer_lead_requests(developer_id, next_follow_up_at)
  where next_follow_up_at is not null;
create index if not exists developer_lead_assignments_lead_history_idx
  on public.developer_lead_assignments(lead_id, assigned_at desc);
create index if not exists developer_tasks_assignee_due_idx
  on public.developer_tasks(developer_id, assigned_to, status, due_at);
create index if not exists developer_appointments_calendar_idx
  on public.developer_appointments(developer_id, starts_at, status);

-- These tables are accessed only through server-side routes using service_role.
-- Do not add broad authenticated policies; membership authorization is checked in API code.
alter table public.developer_team_members enable row level security;
alter table public.developer_lead_assignments enable row level security;
alter table public.developer_tasks enable row level security;
alter table public.developer_appointments enable row level security;

revoke all on public.developer_team_members from public, anon, authenticated;
revoke all on public.developer_lead_assignments from public, anon, authenticated;
revoke all on public.developer_tasks from public, anon, authenticated;
revoke all on public.developer_appointments from public, anon, authenticated;
grant all on public.developer_team_members to service_role;
grant all on public.developer_lead_assignments to service_role;
grant all on public.developer_tasks to service_role;
grant all on public.developer_appointments to service_role;

comment on table public.developer_team_members is 'Company-scoped developer employees and their CRM roles.';
comment on table public.developer_lead_assignments is 'Immutable assignment history for developer CRM leads; one current assignment per lead.';
comment on table public.developer_tasks is 'Follow-up tasks and reminders owned by a developer company.';
comment on table public.developer_appointments is 'Developer sales-office meetings and apartment viewings.';

-- Keep the current assignee and the assignment audit trail in one transaction.
create or replace function public.assign_developer_lead(
  p_developer_id uuid,
  p_lead_id uuid,
  p_assigned_to uuid,
  p_assigned_by uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead_id uuid;
  v_owner_user_id uuid;
begin
  select l.id into v_lead_id
  from public.developer_lead_requests l
  where l.id = p_lead_id and l.developer_id = p_developer_id
  for update;
  if v_lead_id is null then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  select p.user_id into v_owner_user_id
  from public.developer_profiles d
  join public.partner_profiles p on p.id = d.partner_profile_id
  where d.id = p_developer_id;

  if p_assigned_to is not null and p_assigned_to is distinct from v_owner_user_id
     and not exists (
       select 1 from public.developer_team_members m
       where m.developer_id = p_developer_id
         and m.user_id = p_assigned_to and m.status = 'active'
     ) then
    raise exception 'ASSIGNEE_NOT_ACTIVE' using errcode = '23514';
  end if;

  update public.developer_lead_assignments
  set unassigned_at = now()
  where developer_id = p_developer_id and lead_id = p_lead_id and unassigned_at is null;

  update public.developer_lead_requests
  set assigned_to = p_assigned_to,
      updated_by = p_assigned_by,
      updated_at = now()
  where id = p_lead_id and developer_id = p_developer_id;

  if p_assigned_to is not null then
    insert into public.developer_lead_assignments(
      developer_id, lead_id, assigned_to, assigned_by, assignment_reason
    ) values (p_developer_id, p_lead_id, p_assigned_to, p_assigned_by, nullif(left(p_reason, 500), ''));
  end if;

  return p_lead_id;
end;
$$;

revoke all on function public.assign_developer_lead(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_developer_lead(uuid, uuid, uuid, uuid, text) to service_role;
