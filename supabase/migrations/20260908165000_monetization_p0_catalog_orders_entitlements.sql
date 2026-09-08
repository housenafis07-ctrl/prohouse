-- Prohouse Monetization P0: catalog + order/payment abstraction + entitlements.
-- No payment gateway is connected in this phase. Existing listing/wallet data is preserved.

alter table public.monetization_products
  add column if not exists product_type text,
  add column if not exists audience text not null default 'all',
  add column if not exists unit text not null default 'one',
  add column if not exists quantity integer not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.monetization_products
  drop constraint if exists monetization_products_product_type_check;
alter table public.monetization_products
  add constraint monetization_products_product_type_check
  check (product_type is null or product_type in ('extra_listing','top','up','highlight','premium','subscription','lead_package','advertising'));

alter table public.monetization_products
  drop constraint if exists monetization_products_audience_check;
alter table public.monetization_products
  add constraint monetization_products_audience_check
  check (audience in ('all','individual','realtor','agency','developer'));

alter table public.monetization_products
  drop constraint if exists monetization_products_unit_check;
alter table public.monetization_products
  add constraint monetization_products_unit_check
  check (unit in ('one','day','listing','credit','month','lead'));

update public.monetization_products
set product_type = case
  when code like 'top_%' then 'top'
  when code = 'featured_7' then 'highlight'
  when code = 'premium_14' then 'premium'
  else coalesce(product_type,'premium')
end
where product_type is null;

-- Product catalog is data, not application logic. Prices remain editable from the catalog/admin layer.
insert into public.monetization_products
  (code,name,description,price_uzs,duration_days,boost_rank,badge,product_type,audience,unit,quantity,active)
values
 ('extra_listing','Qo‘shimcha e’lon','Individual uchun 3 ta bepul limitdan keyingi bitta e’lon.',0,1,0,null,'extra_listing','individual','listing',1,false),
 ('top_1','TOP 1 kun','E’lonni qidiruv natijalarida yuqoriga ko‘tarish.',0,1,30,'TOP','top','all','day',1,false),
 ('top_3','TOP 3 kun','E’lonni qidiruv natijalarida yuqoriga ko‘tarish.',0,3,30,'TOP','top','all','day',1,false),
 ('top_7','TOP 7 kun','E’lonni qidiruv natijalarida yuqoriga ko‘tarish.',0,7,30,'TOP','top','all','day',1,false),
 ('top_14','TOP 14 kun','E’lonni qidiruv natijalarida yuqoriga ko‘tarish.',0,14,30,'TOP','top','all','day',1,false),
 ('top_30','TOP 30 kun','E’lonni qidiruv natijalarida yuqoriga ko‘tarish.',0,30,30,'TOP','top','all','day',1,false),
 ('up','UP / Bump','E’lonni bir marta yangi pozitsiyaga ko‘tarish.',0,1,20,'UP','up','all','one',1,false),
 ('highlight','Highlight','E’lonni ajratib ko‘rsatish.',0,7,10,'Highlight','highlight','all','day',1,false),
 ('premium','Premium','E’lon uchun premium ko‘rinish va ustuvor joylashuv.',0,7,100,'Premium','premium','all','day',1,false)
on conflict (code) do update set
  product_type=excluded.product_type,
  audience=excluded.audience,
  unit=excluded.unit,
  quantity=excluded.quantity,
  metadata=excluded.metadata,
  updated_at=now();

create table if not exists public.monetization_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','awaiting_payment','paid','failed','cancelled','refunded')),
  currency text not null default 'UZS' check (currency='UZS'),
  subtotal_uzs numeric(18,2) not null default 0 check (subtotal_uzs >= 0),
  provider text not null default 'unconfigured',
  provider_order_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);

create index if not exists monetization_orders_user_idx on public.monetization_orders(user_id,created_at desc);
create index if not exists monetization_orders_provider_idx on public.monetization_orders(provider,provider_order_id);

create table if not exists public.monetization_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.monetization_orders(id) on delete cascade,
  product_code text not null references public.monetization_products(code),
  listing_id uuid references public.listings(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_uzs numeric(18,2) not null check (unit_price_uzs >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monetization_order_items_order_idx on public.monetization_order_items(order_id);
create index if not exists monetization_order_items_listing_idx on public.monetization_order_items(listing_id);

create table if not exists public.monetization_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null references public.monetization_products(code),
  order_item_id uuid references public.monetization_order_items(id) on delete set null,
  listing_id uuid references public.listings(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','expired','revoked','consumed')),
  quantity_total integer not null default 1 check (quantity_total > 0),
  quantity_remaining integer not null default 1 check (quantity_remaining >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists monetization_entitlements_user_idx on public.monetization_entitlements(user_id,status,ends_at desc);
create index if not exists monetization_entitlements_listing_idx on public.monetization_entitlements(listing_id,status,ends_at desc);

alter table public.monetization_orders enable row level security;
alter table public.monetization_order_items enable row level security;
alter table public.monetization_entitlements enable row level security;

drop policy if exists monetization_orders_select_own on public.monetization_orders;
create policy monetization_orders_select_own on public.monetization_orders
for select to authenticated using (user_id=(select auth.uid()));

drop policy if exists monetization_order_items_select_own on public.monetization_order_items;
create policy monetization_order_items_select_own on public.monetization_order_items
for select to authenticated using (exists(select 1 from public.monetization_orders o where o.id=order_id and o.user_id=(select auth.uid())));

drop policy if exists monetization_entitlements_select_own on public.monetization_entitlements;
create policy monetization_entitlements_select_own on public.monetization_entitlements
for select to authenticated using (user_id=(select auth.uid()));

-- Payment abstraction: order creation does not charge anything. A future provider adapter will transition the order to paid.
create or replace function public.create_monetization_order(
  p_product_code text,
  p_listing_id uuid default null,
  p_quantity integer default 1,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  p public.monetization_products%rowtype;
  order_id uuid;
  item_total numeric(18,2);
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
  if p.audience <> 'all' and not exists(select 1 from public.profiles where id=uid and account_type=p.audience) then raise exception 'PRODUCT_NOT_ALLOWED'; end if;
  if p_listing_id is not null and not exists(select 1 from public.listings where id=p_listing_id and owner_id=uid) then raise exception 'LISTING_NOT_OWNED'; end if;
  if p_idempotency_key is not null then
    select id into order_id from public.monetization_orders where user_id=uid and idempotency_key=p_idempotency_key;
    if order_id is not null then return order_id; end if;
  end if;
  item_total := p.price_uzs * p_quantity;
  insert into public.monetization_orders(user_id,status,subtotal_uzs,provider,idempotency_key)
  values(uid,'awaiting_payment',item_total,'unconfigured',p_idempotency_key)
  returning id into order_id;
  insert into public.monetization_order_items(order_id,product_code,listing_id,quantity,unit_price_uzs)
  values(order_id,p.code,p_listing_id,p_quantity,p.price_uzs);
  return order_id;
end;
$$;

revoke all on function public.create_monetization_order(text,uuid,integer,text) from public;
grant execute on function public.create_monetization_order(text,uuid,integer,text) to authenticated;

-- Existing wallet promotion RPCs remain available for backward compatibility, but the new P0 checkout path is catalog/order based.
