-- Realtor growth + referral promotion-credit program.
-- Promotion credits are separate from user-funded wallet balance and cannot be withdrawn/transferred.

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

alter table public.wallet_accounts
  add column if not exists bonus_balance numeric(18,2) not null default 0 check (bonus_balance >= 0);

update public.profiles
set referral_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
where referral_code is null;

create unique index if not exists profiles_referral_code_key on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null unique references public.profiles(id) on delete cascade,
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  amount_uzs numeric(18,2) not null default 15000 check (amount_uzs = 15000),
  status text not null default 'credited' check (status in ('credited','reversed')),
  created_at timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_created_idx on public.referral_rewards(referrer_id, created_at desc);

create table if not exists public.wallet_bonus_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet_accounts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  balance_after numeric(18,2) not null check (balance_after >= 0),
  type text not null check (type in ('referral_reward','promotion_purchase','adjustment','reversal')),
  description text not null,
  referral_reward_id uuid references public.referral_rewards(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_bonus_transactions_user_idx on public.wallet_bonus_transactions(user_id, created_at desc);
alter table public.referral_rewards enable row level security;
alter table public.wallet_bonus_transactions enable row level security;
drop policy if exists referral_rewards_read_own on public.referral_rewards;
create policy referral_rewards_read_own on public.referral_rewards for select to authenticated using (referrer_id = auth.uid());
drop policy if exists wallet_bonus_transactions_read_own on public.wallet_bonus_transactions;
create policy wallet_bonus_transactions_read_own on public.wallet_bonus_transactions for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.referral_rewards from anon, authenticated;
revoke insert, update, delete on public.wallet_bonus_transactions from anon, authenticated;

-- A referral code can be attached once, only to a different user.
create or replace function public.claim_referral_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into referrer from public.profiles where referral_code = upper(trim(p_code));
  if referrer is null then raise exception 'REFERRAL_CODE_INVALID'; end if;
  if referrer = uid then raise exception 'REFERRAL_SELF_NOT_ALLOWED'; end if;
  if exists(select 1 from public.profiles where id=uid and referred_by is not null) then
    raise exception 'REFERRAL_ALREADY_CLAIMED';
  end if;
  update public.profiles set referred_by=referrer where id=uid and referred_by is null;
  if not found then raise exception 'REFERRAL_ALREADY_CLAIMED'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.claim_referral_code(text) from public, anon;
grant execute on function public.claim_referral_code(text) to authenticated;

-- Credit referrer once the invited user has their first listing approved and active.
create or replace function public.reward_referral_on_first_active_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  referrer uuid;
  wallet_row public.wallet_accounts%rowtype;
  reward_id uuid;
  next_balance numeric(18,2);
  monthly_count integer;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then return new; end if;
  select referred_by into referrer from public.profiles where id=new.owner_id;
  if referrer is null or referrer = new.owner_id then return new; end if;
  if exists(select 1 from public.referral_rewards where invitee_id=new.owner_id) then return new; end if;

  select count(*) into monthly_count from public.referral_rewards
    where referrer_id=referrer and status='credited'
      and created_at >= date_trunc('month', now());
  if monthly_count >= 5 then return new; end if;

  insert into public.wallet_accounts(user_id) values(referrer) on conflict(user_id) do nothing;
  select * into wallet_row from public.wallet_accounts where user_id=referrer and status='active' for update;
  if not found then return new; end if;

  next_balance := wallet_row.bonus_balance + 15000;
  insert into public.referral_rewards(referrer_id,invitee_id,listing_id,amount_uzs)
    values(referrer,new.owner_id,new.id,15000) returning id into reward_id;
  update public.wallet_accounts set bonus_balance=next_balance where id=wallet_row.id;
  insert into public.wallet_bonus_transactions(wallet_id,user_id,amount,balance_after,type,description,referral_reward_id)
    values(wallet_row.id,referrer,15000,next_balance,'referral_reward','Do‘st taklif qilgani uchun bonus',reward_id);
  return new;
end;
$$;

drop trigger if exists listings_reward_referral on public.listings;
create trigger listings_reward_referral after insert or update of status on public.listings
for each row execute function public.reward_referral_on_first_active_listing();

-- Verified realtors receive 20 free active listings; other individual accounts retain the existing configured limit.
create or replace function public.enforce_individual_free_listing_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_count integer;
  v_limit integer := 3;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  select verification_status into v_realtor_status from public.realtor_profiles where user_id=new.owner_id limit 1;

  if coalesce(v_account_type,'individual') = 'individual' then
    new.seller_type := 'owner';
    if v_realtor_status = 'verified' then v_limit := 20;
    else
      select individual_free_listing_limit into v_limit from public.listing_pricing_settings where id=1;
      v_limit := coalesce(v_limit,3);
    end if;
    if new.status='active' and coalesce(new.is_free_listing,true) then
      select count(*) into v_count from public.listings
        where owner_id=new.owner_id and status='active' and is_free_listing=true and id is distinct from new.id;
      if v_count >= v_limit then
        raise exception 'LISTING_LIMIT_REACHED: Bepul faol e’lon limiti tugagan (%).', v_limit using errcode='check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
  realtor_status text;
begin
  select p.account_type into account_type_value from public.profiles p where p.id=new.owner_id;
  select verification_status into realtor_status from public.realtor_profiles where user_id=new.owner_id limit 1;

  if account_type_value='individual' and new.status='active' then
    select individual_free_listing_limit,individual_listing_fee_uzs,paid_listing_enabled
      into free_limit,fee,paid_enabled from public.listing_pricing_settings where id=1;
    if realtor_status='verified' then free_limit:=20; end if;
    select count(*) into used_free from public.listings l
      where l.owner_id=new.owner_id and l.status='active' and l.is_free_listing=true and l.id is distinct from new.id;
    if used_free < coalesce(free_limit,3) then
      new.is_free_listing:=true; new.billing_status:='free'; new.listing_fee_uzs:=0;
    elsif coalesce(new.billing_status,'free')='paid' then
      new.is_free_listing:=false; new.listing_fee_uzs:=coalesce(fee,30000);
    elsif coalesce(paid_enabled,false) then
      new.is_free_listing:=false; new.billing_status:='payment_required'; new.listing_fee_uzs:=coalesce(fee,30000);
    else
      raise exception 'LISTING_LIMIT_REACHED: Bepul e’lon limiti tugagan.' using errcode='check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Promotion checkout spends eligible bonus credit first, then user-funded balance.
create or replace function public.purchase_listing_promotion(p_listing_id uuid, p_product_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  w public.wallet_accounts%rowtype;
  p public.monetization_products%rowtype;
  current_end timestamptz;
  new_end timestamptz;
  tx_id uuid;
  bonus_used numeric(18,2);
  cash_used numeric(18,2);
  bonus_after numeric(18,2);
  cash_after numeric(18,2);
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.listings where id=p_listing_id and owner_id=uid) then raise exception 'LISTING_NOT_OWNED'; end if;
  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  select * into w from public.wallet_accounts where user_id=uid and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  bonus_used:=least(w.bonus_balance,p.price_uzs);
  cash_used:=p.price_uzs-bonus_used;
  if w.balance < cash_used then raise exception 'INSUFFICIENT_BALANCE'; end if;
  bonus_after:=w.bonus_balance-bonus_used;
  cash_after:=w.balance-cash_used;

  update public.wallet_accounts set balance=cash_after,bonus_balance=bonus_after where id=w.id;
  if bonus_used>0 then
    insert into public.wallet_bonus_transactions(wallet_id,user_id,amount,balance_after,type,description)
      values(w.id,uid,bonus_used,bonus_after,'promotion_purchase','E’lonni ilgari surish: '||p.name);
  end if;
  if cash_used>0 then
    insert into public.wallet_transactions(wallet_id,user_id,listing_id,type,amount,balance_after,description,status,provider)
      values(w.id,uid,p_listing_id,'purchase',cash_used,cash_after,'Promotion: '||p.name,'completed','wallet')
      returning id into tx_id;
  end if;

  select promoted_until into current_end from public.listings where id=p_listing_id;
  new_end:=greatest(coalesce(current_end,now()),now())+make_interval(days=>p.duration_days);
  update public.listings set promoted_until=new_end,promotion_rank=greatest(promotion_rank,p.boost_rank),promotion_badge=p.badge,is_featured=(p.boost_rank>=60) where id=p_listing_id;
  insert into public.listing_promotions(user_id,listing_id,product_code,price_paid_uzs,starts_at,ends_at,status,transaction_id)
    values(uid,p_listing_id,p.code,p.price_uzs,now(),new_end,'active',tx_id);
  return jsonb_build_object('ok',true,'ends_at',new_end,'balance',cash_after,'bonus_balance',bonus_after,'transaction_id',tx_id);
end;
$$;
revoke all on function public.claim_referral_code(text) from public, anon;
grant execute on function public.claim_referral_code(text) to authenticated;
revoke all on function public.purchase_listing_promotion(uuid,text) from public;
grant execute on function public.purchase_listing_promotion(uuid,text) to authenticated;
