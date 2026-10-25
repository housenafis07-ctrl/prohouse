begin;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  lead_id uuid not null unique references public.listing_leads(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','agreed','completed','cancelled')),
  buyer_agreed_at timestamptz,
  seller_agreed_at timestamptz,
  buyer_completed_at timestamptz,
  seller_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists service_orders_listing_idx
  on public.service_orders(listing_id, updated_at desc);
create index if not exists service_orders_buyer_idx
  on public.service_orders(buyer_id, updated_at desc);
create index if not exists service_orders_seller_idx
  on public.service_orders(seller_id, updated_at desc);

create or replace function public.set_service_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_orders_updated_at on public.service_orders;
create trigger service_orders_updated_at
before update on public.service_orders
for each row execute function public.set_service_orders_updated_at();

alter table public.service_orders enable row level security;

drop policy if exists service_orders_participants_read on public.service_orders;
create policy service_orders_participants_read
on public.service_orders for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists service_orders_participants_insert on public.service_orders;
create policy service_orders_participants_insert
on public.service_orders for insert
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists service_orders_participants_update on public.service_orders;
create policy service_orders_participants_update
on public.service_orders for update
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- A service order is authoritative for review eligibility. Keep the existing
-- lead status in sync so older reporting and review flows still understand
-- that the service was completed.
create or replace function public.sync_service_lead_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.listing_leads
       set status = 'closed', updated_at = now()
     where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_sync_lead on public.service_orders;
create trigger service_orders_sync_lead
after update on public.service_orders
for each row execute function public.sync_service_lead_on_completion();

commit;
