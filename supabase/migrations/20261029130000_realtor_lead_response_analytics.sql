-- Track first response time for listing leads, so realtor service quality can be measured accurately.
alter table public.listing_leads
  add column if not exists first_responded_at timestamptz;

create or replace function public.track_listing_lead_first_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'contacted' and old.status = 'new' and new.first_responded_at is null then
    new.first_responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists listing_leads_first_response_at on public.listing_leads;
create trigger listing_leads_first_response_at
before update of status on public.listing_leads
for each row execute function public.track_listing_lead_first_response();

create index if not exists listing_leads_owner_status_created_idx
  on public.listing_leads(owner_id, status, created_at desc);
