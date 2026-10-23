alter table public.mortgage_leads
  add column if not exists profile_id uuid null references public.profiles(id) on delete set null;

alter table public.mortgage_leads
drop constraint if exists mortgage_leads_status_check;

alter table public.mortgage_leads
add constraint mortgage_leads_status_check
check (status in ('new','contacted','reviewing','approved','rejected','closed'));

create index if not exists mortgage_leads_profile_idx on public.mortgage_leads(profile_id, created_at desc);
