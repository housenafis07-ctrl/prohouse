begin;

create table if not exists public.property_viewing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','declined','cancelled','completed')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_viewing_requests_distinct_parties check (requester_id <> owner_id)
);

create index if not exists property_viewing_requests_owner_status_idx
  on public.property_viewing_requests(owner_id, status, requested_at);
create index if not exists property_viewing_requests_requester_idx
  on public.property_viewing_requests(requester_id, created_at desc);
create index if not exists property_viewing_requests_listing_time_idx
  on public.property_viewing_requests(listing_id, requested_at);

alter table public.property_viewing_requests enable row level security;
revoke all on public.property_viewing_requests from anon, authenticated;
grant all on public.property_viewing_requests to service_role;

create or replace function public.touch_property_viewing_request_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_viewing_requests_touch_updated_at on public.property_viewing_requests;
create trigger property_viewing_requests_touch_updated_at
before update on public.property_viewing_requests
for each row execute function public.touch_property_viewing_request_updated_at();

commit;
