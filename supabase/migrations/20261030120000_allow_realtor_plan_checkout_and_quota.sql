-- Make realtor plans purchasable by verified realtor profiles even though their
-- underlying RoyalHouse account_type remains "individual".
create or replace function public.create_monetization_order(
  p_product_code text,
  p_listing_id uuid default null,
  p_quantity integer default 1,
  p_idempotency_key text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  p public.monetization_products%rowtype;
  order_id uuid;
  item_total numeric(18,2);
  is_verified_realtor boolean := false;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  if p.audience='realtor' then
    select exists(select 1 from public.realtor_profiles rp where rp.user_id=uid and rp.verification_status='verified')
      into is_verified_realtor;
    if not is_verified_realtor then raise exception 'PRODUCT_NOT_ALLOWED'; end if;
  elsif p.audience <> 'all' and not exists(select 1 from public.profiles where id=uid and account_type=p.audience) then
    raise exception 'PRODUCT_NOT_ALLOWED';
  end if;

  if p_listing_id is not null and not exists(select 1 from public.listings where id=p_listing_id and owner_id=uid) then
    raise exception 'LISTING_NOT_OWNED';
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

-- Keep all quota surfaces aligned: free verified realtors receive 10 active listings;
-- active PRO/BUSINESS entitlements raise that limit to their catalog metadata value.
create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
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

  select verification_status into v_realtor_status from public.realtor_profiles where user_id=p_user_id limit 1;
  if v_realtor_status='verified' then
    free_limit := 20;
    select e.product_code,greatest(coalesce((mp.metadata->>'listing_limit')::integer,20),20)
      into plan_code,free_limit
    from public.monetization_entitlements e
    join public.monetization_products mp on mp.code=e.product_code
    where e.user_id=p_user_id and e.status='active' and mp.product_type='subscription'
      and mp.audience='realtor' and mp.active=true and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
    free_limit := coalesce(free_limit,20);
  else
    select individual_free_listing_limit into free_limit from public.listing_pricing_settings where id=1;
    free_limit := coalesce(free_limit,3);
  end if;

  select count(*)::integer into used_free_count from public.listings l
  where l.owner_id=p_user_id and l.status in ('moderation','active','reserved') and coalesce(l.is_free_listing,true)=true;

  select coalesce(sum(e.quantity_remaining),0)::integer into extra_remaining
  from public.monetization_entitlements e where e.user_id=p_user_id and e.product_code='extra_listing'
    and e.status='active' and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail=jsonb_build_object('used',used_free_count,'free_limit',free_limit,'remaining',0,'extra_listing_remaining',0,'product_code',plan_code)::text;
  end if;
  return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',true,'used',used_free_count,'free_limit',free_limit,'remaining',greatest(free_limit-used_free_count,0),'extra_listing_remaining',extra_remaining,'product_code',plan_code);
end;
$$;
revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated,service_role;

-- The existing trigger still handles regular individuals; for verified realtors its
-- plan-specific cap is enforced by trg_realtor_subscription_listing_limit.
