-- P1 monetization checkout foundation.
-- No real payment gateway is connected yet. Orders remain pending until a
-- trusted provider callback marks them paid.

create table if not exists public.monetization_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_uz text not null,
  name_ru text,
  product_type text not null check (product_type in ('extra_listing','top','bump','highlight')),
  price_uzs numeric(18,2) not null check (price_uzs >= 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  quantity integer not null default 1 check (quantity > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.monetization_products (code,name_uz,name_ru,product_type,price_uzs,duration_days,sort_order) values
('extra_listing_1','Qo‘shimcha e’lon','Дополнительное объявление','extra_listing',30000,null,10),
('top_1d','TOP 1 kun','TOP на 1 день','top',10000,1,20),
('top_3d','TOP 3 kun','TOP на 3 дня','top',25000,3,21),
('top_7d','TOP 7 kun','TOP на 7 дней','top',50000,7,22),
('top_14d','TOP 14 kun','TOP на 14 дней','top',90000,14,23),
('top_30d','TOP 30 kun','TOP на 30 дней','top',150000,30,24),
('bump','UP / Bump','UP / Bump','bump',5000,null,30),
('highlight','Highlight','Highlight','highlight',15000,7,40)
on conflict (code) do update set
  name_uz=excluded.name_uz,name_ru=excluded.name_ru,product_type=excluded.product_type,
  duration_days=excluded.duration_days,sort_order=excluded.sort_order,updated_at=now();

create table if not exists public.monetization_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  product_id uuid not null references public.monetization_products(id),
  amount_uzs numeric(18,2) not null check (amount_uzs >= 0),
  currency text not null default 'UZS' check (currency='UZS'),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  payment_provider text,
  provider_payment_id text,
  idempotency_key text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists monetization_orders_user_idx on public.monetization_orders(user_id,created_at desc);
create index if not exists monetization_orders_listing_idx on public.monetization_orders(listing_id);

create table if not exists public.monetization_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  product_id uuid not null references public.monetization_products(id),
  order_id uuid not null unique references public.monetization_orders(id) on delete restrict,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists monetization_entitlements_user_idx on public.monetization_entitlements(user_id,status);
create index if not exists monetization_entitlements_listing_idx on public.monetization_entitlements(listing_id,status);

create table if not exists public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  entitlement_id uuid not null unique references public.monetization_entitlements(id) on delete cascade,
  promotion_type text not null check (promotion_type in ('top','bump','highlight')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists listing_promotions_active_idx on public.listing_promotions(listing_id,promotion_type,starts_at,ends_at);

alter table public.monetization_products enable row level security;
create policy monetization_products_select_active on public.monetization_products for select to authenticated using (is_active = true);

alter table public.monetization_orders enable row level security;
create policy monetization_orders_select_own on public.monetization_orders for select to authenticated using (user_id = auth.uid());

alter table public.monetization_entitlements enable row level security;
create policy monetization_entitlements_select_own on public.monetization_entitlements for select to authenticated using (user_id = auth.uid());

alter table public.listing_promotions enable row level security;
create policy listing_promotions_select_listing_owner on public.listing_promotions for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);

-- Correct the P0 quota trigger: rejected/draft rows must not consume the free quota.
create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
begin
  select p.account_type into account_type_value from public.profiles p where p.id = new.owner_id;
  if account_type_value = 'individual' then
    select individual_free_listing_limit, individual_listing_fee_uzs, paid_listing_enabled
      into free_limit, fee, paid_enabled from public.listing_pricing_settings where id = 1;
    select count(*) into used_free from public.listings l
      where l.owner_id = new.owner_id and l.is_free_listing = true
      and l.status in ('moderation','active','reserved');
    if used_free < coalesce(free_limit,3) then
      new.is_free_listing := true; new.billing_status := 'free'; new.listing_fee_uzs := 0;
    elsif coalesce(new.billing_status,'free') <> 'paid' then
      if coalesce(paid_enabled,false) then
        new.is_free_listing := false; new.billing_status := 'payment_required'; new.listing_fee_uzs := coalesce(fee,30000);
      else
        raise exception using errcode='P0001', message='INDIVIDUAL_LISTING_LIMIT';
      end if;
    else
      new.is_free_listing := false; new.listing_fee_uzs := coalesce(fee,30000);
    end if;
  end if;
  return new;
end;
$$;
