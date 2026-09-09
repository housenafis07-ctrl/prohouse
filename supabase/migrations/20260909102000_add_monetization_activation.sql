alter table public.monetization_entitlements
  add column if not exists consumed_at timestamptz;

create or replace function public.activate_monetization_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  p record;
  e record;
  start_time timestamptz;
  end_time timestamptz;
begin
  select * into o from public.monetization_orders where id = p_order_id for update;
  if not found then raise exception using errcode='P0002', message='ORDER_NOT_FOUND'; end if;
  if o.status <> 'paid' then raise exception using errcode='P0001', message='ORDER_NOT_PAID'; end if;

  select * into p from public.monetization_products where id = o.product_id;
  if not found then raise exception using errcode='P0002', message='PRODUCT_NOT_FOUND'; end if;

  select * into e from public.monetization_entitlements where order_id = o.id;
  if found then return jsonb_build_object('entitlement_id',e.id,'already_active',true); end if;

  start_time := coalesce(o.paid_at, now());
  end_time := case when p.duration_days is null then null else start_time + make_interval(days => p.duration_days) end;

  insert into public.monetization_entitlements(user_id,listing_id,product_id,order_id,status,starts_at,ends_at)
  values(o.user_id,o.listing_id,o.product_id,o.id,'active',start_time,end_time)
  returning * into e;

  if p.product_type in ('top','highlight','bump') and o.listing_id is not null then
    insert into public.listing_promotions(listing_id,entitlement_id,promotion_type,starts_at,ends_at)
    values(o.listing_id,e.id,p.product_type,start_time,end_time);
  end if;

  return jsonb_build_object('entitlement_id',e.id,'already_active',false);
end;
$$;

-- Allow a paid extra-listing entitlement to be consumed exactly once when the
-- next listing is created. This keeps the quota server-side and idempotent.
create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
  extra_entitlement_id uuid;
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
    else
      select e.id into extra_entitlement_id
      from public.monetization_entitlements e
      join public.monetization_products p on p.id=e.product_id
      where e.user_id=new.owner_id and e.status='active' and e.consumed_at is null
        and p.product_type='extra_listing' and (e.ends_at is null or e.ends_at > now())
      order by e.created_at asc limit 1 for update skip locked;
      if extra_entitlement_id is not null then
        update public.monetization_entitlements set consumed_at=now() where id=extra_entitlement_id;
        new.is_free_listing := false; new.billing_status := 'paid'; new.listing_fee_uzs := 0;
      elsif coalesce(paid_enabled,false) then
        new.is_free_listing := false; new.billing_status := 'payment_required'; new.listing_fee_uzs := coalesce(fee,30000);
      else
        raise exception using errcode='P0001', message='INDIVIDUAL_LISTING_LIMIT';
      end if;
    end if;
  end if;
  return new;
end;
$$;
