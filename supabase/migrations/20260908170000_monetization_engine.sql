-- Wallet-backed Prohouse Monetization Engine.
-- Adds listing promotion products, secure wallet checkout and paid-listing settlement.

alter table public.listings
  add column if not exists promoted_until timestamptz,
  add column if not exists promotion_rank integer not null default 0,
  add column if not exists promotion_badge text;

create index if not exists listings_promotion_sort_idx
  on public.listings (promotion_rank desc, promoted_until desc, published_at desc);

create table if not exists public.monetization_products (
  code text primary key,
  name text not null,
  description text,
  price_uzs numeric(18,2) not null check (price_uzs >= 0),
  duration_days integer not null check (duration_days > 0),
  boost_rank integer not null default 0 check (boost_rank >= 0),
  badge text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.monetization_products(code,name,description,price_uzs,duration_days,boost_rank,badge)
values
 ('top_7','TOP 7 kun','E’lon qidiruv natijalarida yuqoriroq ko‘rsatiladi.',49000,7,30,'TOP'),
 ('featured_7','Featured 7 kun','Kuchliroq ranking va maxsus Featured belgisi.',79000,7,60,'Featured'),
 ('premium_14','Premium 14 kun','Eng yuqori ranking va Premium belgisi.',149000,14,100,'Premium')
on conflict (code) do update set
  name=excluded.name, description=excluded.description, price_uzs=excluded.price_uzs,
  duration_days=excluded.duration_days, boost_rank=excluded.boost_rank, badge=excluded.badge,
  updated_at=now();

create table if not exists public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  product_code text not null references public.monetization_products(code),
  price_paid_uzs numeric(18,2) not null check (price_paid_uzs >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  transaction_id uuid references public.wallet_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists listing_promotions_user_idx on public.listing_promotions(user_id, created_at desc);
create index if not exists listing_promotions_listing_idx on public.listing_promotions(listing_id, ends_at desc);

alter table public.monetization_products enable row level security;
alter table public.listing_promotions enable row level security;

drop policy if exists monetization_products_read on public.monetization_products;
create policy monetization_products_read on public.monetization_products for select to anon, authenticated using (active = true);

drop policy if exists listing_promotions_read_own on public.listing_promotions;
create policy listing_promotions_read_own on public.listing_promotions for select to authenticated using (user_id = auth.uid());

create or replace function public.purchase_listing_promotion(p_listing_id uuid, p_product_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w public.wallet_accounts%rowtype;
  p public.monetization_products%rowtype;
  current_end timestamptz;
  new_end timestamptz;
  tx_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.listings where id=p_listing_id and owner_id=uid) then raise exception 'LISTING_NOT_OWNED'; end if;
  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  select * into w from public.wallet_accounts where user_id=uid and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if w.balance < p.price_uzs then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.wallet_accounts set balance=balance-p.price_uzs where id=w.id;
  insert into public.wallet_transactions(wallet_id,user_id,listing_id,type,amount,balance_after,description,status,provider)
  values(w.id,uid,p_listing_id,'purchase',p.price_uzs,w.balance-p.price_uzs,'Promotion: '||p.name,'completed','wallet')
  returning id into tx_id;

  select promoted_until into current_end from public.listings where id=p_listing_id;
  new_end := greatest(coalesce(current_end, now()), now()) + make_interval(days => p.duration_days);
  update public.listings
    set promoted_until=new_end,
        promotion_rank=greatest(promotion_rank,p.boost_rank),
        promotion_badge=p.badge,
        is_featured=(p.boost_rank >= 60)
    where id=p_listing_id;

  insert into public.listing_promotions(user_id,listing_id,product_code,price_paid_uzs,starts_at,ends_at,status,transaction_id)
  values(uid,p_listing_id,p.code,p.price_uzs,now(),new_end,'active',tx_id);

  return jsonb_build_object('ok',true,'ends_at',new_end,'balance',w.balance-p.price_uzs,'transaction_id',tx_id);
end;
$$;

create or replace function public.pay_listing_fee(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fee numeric(18,2);
  w public.wallet_accounts%rowtype;
  tx_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select listing_fee_uzs into fee from public.listings
    where id=p_listing_id and owner_id=uid and billing_status='payment_required'
    for update;
  if not found then raise exception 'PAYMENT_NOT_REQUIRED'; end if;
  if fee <= 0 then raise exception 'INVALID_FEE'; end if;
  select * into w from public.wallet_accounts where user_id=uid and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if w.balance < fee then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.wallet_accounts set balance=balance-fee where id=w.id;
  insert into public.wallet_transactions(wallet_id,user_id,listing_id,type,amount,balance_after,description,status,provider)
  values(w.id,uid,p_listing_id,'purchase',fee,w.balance-fee,'E’lon joylashtirish to‘lovi','completed','wallet')
  returning id into tx_id;
  update public.listings set billing_status='paid',is_free_listing=false where id=p_listing_id;
  return jsonb_build_object('ok',true,'balance',w.balance-fee,'transaction_id',tx_id);
end;
$$;

revoke all on function public.purchase_listing_promotion(uuid,text) from public;
revoke all on function public.pay_listing_fee(uuid) from public;
grant execute on function public.purchase_listing_promotion(uuid,text) to authenticated;
grant execute on function public.pay_listing_fee(uuid) to authenticated;
