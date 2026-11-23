begin;

-- A partner subscription is a normal monetization product. Keep order creation
-- strict: partner plans can only be purchased by partner accounts and never
-- require a listing_id, exactly like a subscription rather than TOP/UP/etc.
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
  v_account_type text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;

  select * into p
  from public.monetization_products
  where code = p_product_code and active = true;
  if not found then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  select account_type into v_account_type
  from public.profiles
  where id = uid;

  if p.audience <> 'all' and coalesce(v_account_type, '') <> p.audience then
    raise exception 'PRODUCT_NOT_ALLOWED';
  end if;

  -- Subscriptions never target a listing. Listing promotions do.
  if p.product_type = 'subscription' and p_listing_id is not null then
    raise exception 'LISTING_NOT_ALLOWED_FOR_SUBSCRIPTION';
  end if;

  if p.product_type <> 'subscription' and p.product_type in ('top','up','highlight','premium') and p_listing_id is null then
    raise exception 'LISTING_REQUIRED';
  end if;

  -- PRO/BUSINESS expose promotion tools as a paid-plan benefit. A partner on
  -- the free quota or START cannot bypass that entitlement by calling the RPC.
  if coalesce(v_account_type, '') = 'partner'
     and p.product_type in ('top','up','highlight','premium')
     and not public.partner_plan_has_feature(uid, 'promo_tools') then
    raise exception 'PARTNER_PROMO_TOOLS_REQUIRED: PRO yoki BUSINESS tarifi kerak.'
      using errcode = 'check_violation';
  end if;

  if p_listing_id is not null then
    select status into listing_status
    from public.listings
    where id = p_listing_id and owner_id = uid;

    if not found then raise exception 'LISTING_NOT_OWNED'; end if;
    if listing_status not in ('active','moderation') then
      raise exception 'LISTING_NOT_PURCHASABLE';
    end if;
  end if;

  if p_idempotency_key is not null then
    select id into order_id
    from public.monetization_orders
    where user_id = uid and idempotency_key = p_idempotency_key;
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

revoke all on function public.create_monetization_order(text, uuid, integer, text) from public, anon;
grant execute on function public.create_monetization_order(text, uuid, integer, text) to authenticated;

commit;
