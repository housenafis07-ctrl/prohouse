-- Safe foundation for seller-role independence and individual listing monetization.
-- Existing listing ownership/status data is preserved.

alter table public.listings
  add column if not exists seller_role text;

alter table public.listings
  drop constraint if exists listings_seller_role_check;
alter table public.listings
  add constraint listings_seller_role_check
  check (seller_role is null or seller_role in ('owner','seller','realtor','agency','developer','company','service_provider'));

-- Preserve the current semantic value for existing rows without changing seller_type.
update public.listings
set seller_role = seller_type
where seller_role is null
  and seller_type in ('owner','seller','realtor','agency','developer','company','service_provider');

create index if not exists listings_seller_role_idx on public.listings(seller_role);

alter table public.listings
  add column if not exists billing_status text not null default 'free',
  add column if not exists listing_fee_uzs numeric(18,2) not null default 0,
  add column if not exists is_free_listing boolean not null default true;

alter table public.listings
  drop constraint if exists listings_billing_status_check;
alter table public.listings
  add constraint listings_billing_status_check
  check (billing_status in ('free','payment_required','paid','waived'));

alter table public.listings
  drop constraint if exists listings_listing_fee_uzs_check;
alter table public.listings
  add constraint listings_listing_fee_uzs_check
  check (listing_fee_uzs >= 0);

create index if not exists listings_billing_status_idx on public.listings(owner_id, billing_status);

create table if not exists public.listing_pricing_settings (
  id integer primary key check (id = 1),
  individual_free_listing_limit integer not null default 3 check (individual_free_listing_limit >= 0),
  individual_listing_fee_uzs numeric(18,2) not null default 30000 check (individual_listing_fee_uzs >= 0),
  currency text not null default 'UZS' check (currency = 'UZS'),
  paid_listing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.listing_pricing_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.set_listing_pricing_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_pricing_settings_updated_at on public.listing_pricing_settings;
create trigger listing_pricing_settings_updated_at
before update on public.listing_pricing_settings
for each row execute function public.set_listing_pricing_settings_updated_at();

alter table public.listing_pricing_settings enable row level security;
drop policy if exists listing_pricing_settings_select_authenticated on public.listing_pricing_settings;
create policy listing_pricing_settings_select_authenticated
on public.listing_pricing_settings
for select to authenticated using (true);

-- Server-side enforcement: first 3 active/pending individual listings are free.
-- Paid listings remain disabled until a real payment provider/wallet checkout is connected.
create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
begin
  select p.account_type into account_type_value
  from public.profiles p
  where p.id = new.owner_id;

  if account_type_value = 'individual' then
    select individual_free_listing_limit, individual_listing_fee_uzs, paid_listing_enabled
      into free_limit, fee, paid_enabled
    from public.listing_pricing_settings
    where id = 1;

    select count(*) into used_free
    from public.listings l
    where l.owner_id = new.owner_id
      and l.is_free_listing = true
      and l.status in ('draft','moderation','active','reserved','rejected');

    if used_free < coalesce(free_limit, 3) then
      new.is_free_listing := true;
      new.billing_status := 'free';
      new.listing_fee_uzs := 0;
    elsif coalesce(new.billing_status, 'free') <> 'paid' then
      if coalesce(paid_enabled, false) then
        new.is_free_listing := false;
        new.billing_status := 'payment_required';
        new.listing_fee_uzs := coalesce(fee, 30000);
      else
        raise exception using errcode = 'P0001', message = 'INDIVIDUAL_LISTING_LIMIT';
      end if;
    else
      new.is_free_listing := false;
      new.listing_fee_uzs := coalesce(fee, 30000);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_prepare_billing on public.listings;
create trigger listings_prepare_billing
before insert on public.listings
for each row execute function public.prepare_listing_billing();
