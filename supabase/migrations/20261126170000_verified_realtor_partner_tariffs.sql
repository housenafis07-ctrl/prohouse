-- Verified individual realtors may choose the existing, lower-cost partner subscriptions.
-- Until a partner plan is active, the account keeps the standard 3 free-listing allowance.
begin;

create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_realtor_status text;
  used_free_count integer;
  free_limit integer := 3;
  extra_remaining integer := 0;
  plan_code text := null;
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  select account_type into v_account_type from public.profiles where id=p_user_id;
  if coalesce(v_account_type,'') <> 'individual' then
    return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',false,'used',0,'free_limit',free_limit,'remaining',null);
  end if;

  select verification_status into v_realtor_status
  from public.realtor_profiles where user_id=p_user_id limit 1;

  if v_realtor_status='verified' then
    select e.product_code,greatest(coalesce((mp.metadata->>'listing_limit')::integer,3),3)
      into plan_code,free_limit
    from public.monetization_entitlements e
    join public.monetization_products mp on mp.code=e.product_code
    where e.user_id=p_user_id and e.status='active'
      and mp.product_type='subscription' and mp.audience='partner' and mp.active=true
      and mp.code in ('partner_start','partner_pro','partner_business')
      and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
    free_limit := coalesce(free_limit,3);
  else
    select individual_free_listing_limit into free_limit
    from public.listing_pricing_settings where id=1;
    free_limit := coalesce(free_limit,3);
  end if;

  select count(*)::integer into used_free_count
  from public.listings l
  where l.owner_id=p_user_id
    and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing,true)=true;

  select coalesce(sum(e.quantity_remaining),0)::integer into extra_remaining
  from public.monetization_entitlements e
  where e.user_id=p_user_id and e.product_code='extra_listing'
    and e.status='active' and e.quantity_remaining>0
    and (e.ends_at is null or e.ends_at>now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail=jsonb_build_object('used',used_free_count,'free_limit',free_limit,'remaining',0,'extra_listing_remaining',0,'product_code',plan_code)::text;
  end if;
  return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',true,
    'is_verified_realtor',v_realtor_status='verified','used',used_free_count,'free_limit',free_limit,
    'remaining',greatest(free_limit-used_free_count,0),'extra_listing_remaining',extra_remaining,'product_code',plan_code);
end;
$$;
revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated,service_role;

create or replace function public.enforce_individual_free_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_limit integer := 3;
  v_count integer;
  v_extra_remaining integer;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' then return new; end if;

  select verification_status into v_realtor_status
  from public.realtor_profiles where user_id=new.owner_id limit 1;
  if v_realtor_status='verified' then
    select greatest(coalesce((mp.metadata->>'listing_limit')::integer,3),3) into v_limit
    from public.monetization_entitlements e
    join public.monetization_products mp on mp.code=e.product_code
    where e.user_id=new.owner_id and e.status='active'
      and mp.product_type='subscription' and mp.audience='partner' and mp.active=true
      and mp.code in ('partner_start','partner_pro','partner_business')
      and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
    v_limit := coalesce(v_limit,3);
    new.seller_type := 'realtor';
  else
    select individual_free_listing_limit into v_limit from public.listing_pricing_settings where id=1;
    v_limit := coalesce(v_limit,3);
    new.seller_type := 'owner';
  end if;

  if coalesce(new.is_free_listing,true)=false or coalesce(new.billing_status,'') in ('paid','payment_required') then return new; end if;
  if new.status in ('moderation','active','reserved') then
    select count(*)::integer into v_count from public.listings
    where owner_id=new.owner_id and status in ('moderation','active','reserved')
      and coalesce(is_free_listing,true)=true and id is distinct from new.id;
    if v_count>=v_limit then
      select coalesce(sum(e.quantity_remaining),0)::integer into v_extra_remaining
      from public.monetization_entitlements e
      where e.user_id=new.owner_id and e.product_code='extra_listing'
        and e.status='active' and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now());
      if coalesce(v_extra_remaining,0)<=0 then
        raise exception 'LISTING_LIMIT_REACHED' using errcode='check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_listing_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_free_limit integer := 3;
  v_used_free integer;
  v_fee numeric(18,2);
  v_paid_enabled boolean;
  v_extra_entitlement_id uuid;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' or new.status='draft' then return new; end if;

  select verification_status into v_realtor_status
  from public.realtor_profiles where user_id=new.owner_id limit 1;
  select individual_listing_fee_uzs,paid_listing_enabled into v_fee,v_paid_enabled
  from public.listing_pricing_settings where id=1;

  if v_realtor_status='verified' then
    select greatest(coalesce((mp.metadata->>'listing_limit')::integer,3),3) into v_free_limit
    from public.monetization_entitlements e
    join public.monetization_products mp on mp.code=e.product_code
    where e.user_id=new.owner_id and e.status='active'
      and mp.product_type='subscription' and mp.audience='partner' and mp.active=true
      and mp.code in ('partner_start','partner_pro','partner_business')
      and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
    v_free_limit := coalesce(v_free_limit,3);
  else
    select individual_free_listing_limit into v_free_limit from public.listing_pricing_settings where id=1;
    v_free_limit := coalesce(v_free_limit,3);
  end if;

  if coalesce(new.billing_status,'')='paid' then
    new.is_free_listing:=false; new.listing_fee_uzs:=0; return new;
  end if;

  select count(*)::integer into v_used_free from public.listings l
  where l.owner_id=new.owner_id and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing,true)=true and l.id is distinct from new.id;

  if v_used_free<coalesce(v_free_limit,3) then
    new.is_free_listing:=true; new.billing_status:='free'; new.listing_fee_uzs:=0; return new;
  end if;

  select e.id into v_extra_entitlement_id from public.monetization_entitlements e
  where e.user_id=new.owner_id and e.product_code='extra_listing' and e.status='active'
    and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now())
  order by e.created_at asc limit 1 for update;
  if v_extra_entitlement_id is not null then
    update public.monetization_entitlements set quantity_remaining=quantity_remaining-1,
      status=case when quantity_remaining-1<=0 then 'consumed' else 'active' end,
      consumed_at=now(),listing_id=new.id,updated_at=now()
    where id=v_extra_entitlement_id and quantity_remaining>0;
    if not found then raise exception 'EXTRA_LISTING_CONSUME_FAILED' using errcode='P0001'; end if;
    new.is_free_listing:=false; new.billing_status:='paid'; new.listing_fee_uzs:=0; return new;
  end if;

  if coalesce(v_paid_enabled,false) then
    new.is_free_listing:=false; new.billing_status:='payment_required'; new.listing_fee_uzs:=coalesce(v_fee,30000); return new;
  end if;
  raise exception 'LISTING_LIMIT_REACHED: Bepul e’lon limiti tugagan.' using errcode='check_violation';
end;
$$;

create or replace function public.create_monetization_order(
  p_product_code text,
  p_listing_id uuid default null,
  p_quantity integer default 1,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.monetization_products%rowtype;
  order_id uuid;
  item_total numeric(18,2);
  listing_status text;
  is_verified_realtor boolean := false;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;

  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  if p.audience='partner' then
    select exists(select 1 from public.realtor_profiles rp where rp.user_id=uid and rp.verification_status='verified')
      into is_verified_realtor;
    if not is_verified_realtor and not exists(select 1 from public.profiles where id=uid and account_type='partner') then
      raise exception 'PRODUCT_NOT_ALLOWED';
    end if;
  elsif p.audience <> 'all' and not exists(select 1 from public.profiles where id=uid and account_type=p.audience) then
    raise exception 'PRODUCT_NOT_ALLOWED';
  end if;

  if p_listing_id is not null then
    select status into listing_status from public.listings where id=p_listing_id and owner_id=uid;
    if not found then raise exception 'LISTING_NOT_OWNED'; end if;
    if listing_status not in ('active','moderation') then raise exception 'LISTING_NOT_PURCHASABLE'; end if;
  end if;

  if p_idempotency_key is not null then
    select id into order_id from public.monetization_orders where user_id=uid and idempotency_key=p_idempotency_key;
    if order_id is not null then return order_id; end if;
  end if;

  item_total := p.price_uzs * p_quantity;
  insert into public.monetization_orders(user_id,status,subtotal_uzs,provider,idempotency_key)
    values(uid,'awaiting_payment',item_total,'unconfigured',p_idempotency_key) returning id into order_id;
  insert into public.monetization_order_items(order_id,product_code,listing_id,quantity,unit_price_uzs)
    values(order_id,p.code,p_listing_id,p_quantity,p.price_uzs);
  return order_id;
end;
$$;
revoke all on function public.create_monetization_order(text,uuid,integer,text) from public;
grant execute on function public.create_monetization_order(text,uuid,integer,text) to authenticated;

commit;
