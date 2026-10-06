begin;

-- Monetization hardening:
-- 1) effective promotion is calculated from active promotion rows, so higher
--    promotions can expire/downgrade without leaving stale denormalized fields.
-- 2) the individual free quota counts only free listings.
-- 3) a paid extra_listing entitlement is a one-time server-side capacity credit.
-- 4) extra_listing does not expire.
-- 5) the public search projection exposes effective promotion fields.

update public.monetization_products
set
  price_uzs = 30000,
  duration_days = 1,
  active = true,
  name = 'Qo‘shimcha e’lon',
  description = 'Individual uchun 3 ta bepul limitdan keyingi bitta e’lon.',
  product_type = 'extra_listing',
  audience = 'individual',
  unit = 'listing',
  quantity = 1,
  metadata = jsonb_build_object(
    'benefits', jsonb_build_array('3 ta bepul e’lon limitidan keyin 1 ta qo‘shimcha e’lon'),
    'expires', false
  ),
  updated_at = now()
where code = 'extra_listing';

-- Free quota check: paid extra listings must not consume the 3 free slots.
create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_type text;
  used_free_count integer;
  free_limit integer := 3;
  extra_remaining integer := 0;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select p.account_type into account_type
  from public.profiles p
  where p.id = p_user_id;

  if coalesce(account_type, '') <> 'individual' then
    return jsonb_build_object(
      'allowed', true,
      'account_type', account_type,
      'is_individual', false,
      'used', 0,
      'free_limit', free_limit,
      'remaining', null
    );
  end if;

  select count(*)::integer into used_free_count
  from public.listings l
  where l.owner_id = p_user_id
    and l.status in ('moderation', 'active', 'reserved')
    and coalesce(l.is_free_listing, true) = true;

  select coalesce(sum(e.quantity_remaining), 0)::integer
    into extra_remaining
  from public.monetization_entitlements e
  where e.user_id = p_user_id
    and e.product_code = 'extra_listing'
    and e.status = 'active'
    and e.quantity_remaining > 0
    and (e.ends_at is null or e.ends_at > now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail = jsonb_build_object(
        'used', used_free_count,
        'free_limit', free_limit,
        'remaining', 0,
        'extra_listing_remaining', 0
      )::text;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'account_type', account_type,
    'is_individual', true,
    'used', used_free_count,
    'free_limit', free_limit,
    'remaining', greatest(free_limit - used_free_count, 0),
    'extra_listing_remaining', extra_remaining
  );
end;
$$;

revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated;

-- Final server-side quota guard. A paid extra listing is allowed and does not
-- consume one of the three free slots.
create or replace function public.enforce_individual_free_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_type text;
  v_count integer;
  v_extra_remaining integer;
begin
  select account_type into v_account_type
  from public.profiles
  where id = new.owner_id;

  if coalesce(v_account_type, 'individual') = 'individual' then
    new.seller_type := 'owner';

    if new.status in ('moderation','active','reserved') then
      select count(*)::integer into v_count
      from public.listings
      where owner_id = new.owner_id
        and status in ('moderation','active','reserved')
        and coalesce(is_free_listing, true) = true
        and id is distinct from new.id;

      if v_count >= 3 then
        select coalesce(sum(e.quantity_remaining), 0)::integer
          into v_extra_remaining
        from public.monetization_entitlements e
        where e.user_id = new.owner_id
          and e.product_code = 'extra_listing'
          and e.status = 'active'
          and e.quantity_remaining > 0
          and (e.ends_at is null or e.ends_at > now());

        if v_extra_remaining <= 0 then
          raise exception 'LISTING_LIMIT_REACHED: 3 ta bepul faol e’lon limitingiz tugagan.'
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- Consume one extra-listing credit exactly when a new individual listing
-- crosses into moderation. Re-submitting an already-paid listing never
-- consumes another credit.
create or replace function public.prepare_listing_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
  extra_entitlement_id uuid;
  extra_remaining integer;
begin
  select p.account_type into account_type_value
  from public.profiles p
  where p.id = new.owner_id;

  -- Drafts are not billable yet.
  if account_type_value <> 'individual' or new.status = 'draft' then
    return new;
  end if;

  -- A listing that already has paid billing must remain paid on resubmission.
  if coalesce(new.billing_status, '') = 'paid' then
    new.is_free_listing := false;
    new.listing_fee_uzs := 0;
    return new;
  end if;

  select individual_free_listing_limit, individual_listing_fee_uzs, paid_listing_enabled
    into free_limit, fee, paid_enabled
  from public.listing_pricing_settings
  where id = 1;

  select count(*)::integer into used_free
  from public.listings l
  where l.owner_id = new.owner_id
    and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing, true) = true
    and l.id is distinct from new.id;

  if used_free < coalesce(free_limit, 3) then
    new.is_free_listing := true;
    new.billing_status := 'free';
    new.listing_fee_uzs := 0;
    return new;
  end if;

  -- Free quota is exhausted. Consume one paid extra-listing entitlement.
  select e.id, e.quantity_remaining
    into extra_entitlement_id, extra_remaining
  from public.monetization_entitlements e
  where e.user_id = new.owner_id
    and e.product_code = 'extra_listing'
    and e.status = 'active'
    and e.quantity_remaining > 0
    and (e.ends_at is null or e.ends_at > now())
  order by e.created_at asc
  limit 1
  for update;

  if extra_entitlement_id is not null then
    update public.monetization_entitlements
    set
      quantity_remaining = quantity_remaining - 1,
      status = case when quantity_remaining - 1 <= 0 then 'consumed' else 'active' end,
      consumed_at = now(),
      listing_id = new.id,
      updated_at = now()
    where id = extra_entitlement_id
      and quantity_remaining > 0;

    if not found then
      raise exception 'EXTRA_LISTING_CONSUME_FAILED'
        using errcode = 'P0001';
    end if;

    new.is_free_listing := false;
    new.billing_status := 'paid';
    new.listing_fee_uzs := 0;
    return new;
  end if;

  -- Keep the legacy paid-listing path intact when it is explicitly enabled.
  if coalesce(paid_enabled, false) then
    new.is_free_listing := false;
    new.billing_status := 'payment_required';
    new.listing_fee_uzs := coalesce(fee, 30000);
    return new;
  end if;

  raise exception 'LISTING_LIMIT_REACHED: 3 ta bepul e’lon limitingiz tugagan.'
    using errcode = 'check_violation';
end;
$function$;

drop trigger if exists trg_individual_free_listing_limit on public.listings;
create trigger trg_individual_free_listing_limit
before insert or update of status on public.listings
for each row execute function public.enforce_individual_free_listing_limit();

drop trigger if exists listings_prepare_billing on public.listings;
create trigger listings_prepare_billing
before insert or update of status on public.listings
for each row execute function public.prepare_listing_billing();

-- Extra-listing is a one-time capacity credit, not a time-limited promotion.
create or replace function public.activate_monetization_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.monetization_orders%rowtype;
  item record;
  p public.monetization_products%rowtype;
  e public.monetization_entitlements%rowtype;
  start_time timestamptz;
  end_time timestamptz;
  activated_count integer := 0;
  existing_count integer := 0;
  promotion_end timestamptz;
begin
  select * into o
  from public.monetization_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if o.status <> 'paid' then
    raise exception 'ORDER_NOT_PAID' using errcode = 'P0001';
  end if;

  start_time := coalesce(o.updated_at, now());

  for item in
    select *
    from public.monetization_order_items
    where order_id = o.id
    order by created_at, id
    for update
  loop
    select * into p
    from public.monetization_products
    where code = item.product_code;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    select * into e
    from public.monetization_entitlements
    where order_item_id = item.id
    limit 1
    for update;

    if found then
      existing_count := existing_count + 1;
      continue;
    end if;

    end_time := case
      when p.product_type = 'extra_listing' then null
      when p.duration_days is null or p.duration_days <= 0 then null
      else start_time + make_interval(days => p.duration_days)
    end;

    insert into public.monetization_entitlements(
      user_id,
      product_code,
      order_item_id,
      listing_id,
      status,
      quantity_total,
      quantity_remaining,
      starts_at,
      ends_at,
      metadata
    )
    values (
      o.user_id,
      item.product_code,
      item.id,
      item.listing_id,
      'active',
      greatest(item.quantity, 1),
      greatest(item.quantity, 1),
      start_time,
      end_time,
      jsonb_build_object('order_id', o.id)
    )
    returning * into e;

    activated_count := activated_count + 1;

    if item.listing_id is not null and p.product_type in ('top','highlight','premium') then
      promotion_end := greatest(
        coalesce(
          (select promoted_until
           from public.listings
           where id = item.listing_id
             and owner_id = o.user_id),
          start_time
        ),
        start_time
      ) + make_interval(days => greatest(p.duration_days, 1));

      update public.listings
      set
        promoted_until = promotion_end,
        promotion_rank = greatest(coalesce(promotion_rank, 0), p.boost_rank),
        promotion_badge = p.badge,
        is_featured = (p.boost_rank >= 60)
      where id = item.listing_id
        and owner_id = o.user_id;

      insert into public.listing_promotions(
        user_id, listing_id, product_code, price_paid_uzs, starts_at, ends_at, status
      )
      values (
        o.user_id,
        item.listing_id,
        item.product_code,
        item.unit_price_uzs * greatest(item.quantity, 1),
        start_time,
        promotion_end,
        'active'
      );
    elsif item.listing_id is not null and p.product_type = 'up' then
      update public.listings
      set
        bumped_at = start_time,
        promotion_rank = greatest(coalesce(promotion_rank, 0), p.boost_rank)
      where id = item.listing_id
        and owner_id = o.user_id;

      insert into public.listing_promotions(
        user_id, listing_id, product_code, price_paid_uzs, starts_at, ends_at, status
      )
      values (
        o.user_id,
        item.listing_id,
        item.product_code,
        item.unit_price_uzs * greatest(item.quantity, 1),
        start_time,
        null,
        'active'
      );
    end if;
  end loop;

  return jsonb_build_object(
    'order_id', o.id,
    'activated_count', activated_count,
    'already_active_count', existing_count
  );
end;
$$;

revoke all on function public.activate_monetization_order(uuid) from public, anon, authenticated;
grant execute on function public.activate_monetization_order(uuid) to service_role;

-- Public search projection: the effective promotion comes from active promotion
-- rows, not from stale denormalized listing fields.
create or replace view public.listing_search as
select
  l.id,
  l.title,
  l.title_ru,
  l.listing_type,
  l.property_type,
  l.status,
  l.price,
  l.currency,
  l.area_m2,
  l.rooms,
  l.floor,
  l.floors_total,
  l.district,
  l.city,
  l.latitude,
  l.longitude,
  l.seller_type,
  l.seller_name,
  l.is_mortgage_available,
  l.is_verified,
  l.is_featured,
  l.published_at,
  l.taxonomy_code,
  l.promoted_until,
  l.promotion_rank,
  l.promotion_badge,
  l.bumped_at,
  greatest(
    coalesce(active_promotion.boost_rank, 0),
    case
      when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day')
        then 20
      else 0
    end
  ) as effective_promotion_rank,
  case
    when active_promotion.badge is not null then active_promotion.badge
    when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day') then 'UP'
    else null
  end as effective_promotion_badge,
  (
    greatest(
      coalesce(active_promotion.boost_rank, 0),
      case
        when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day')
          then 20
        else 0
      end
    ) >= 60
  ) as effective_is_featured,
  l.is_trusted_seller
from public.listings l
left join lateral (
  select
    mp.boost_rank,
    mp.badge
  from public.listing_promotions lp
  join public.monetization_products mp
    on mp.code = lp.product_code
  where lp.listing_id = l.id
    and lp.status = 'active'
    and mp.active = true
    and lp.starts_at <= now()
    and lp.ends_at is not null
    and lp.ends_at > now()
    and mp.product_type in ('top','highlight','premium')
  order by mp.boost_rank desc, lp.starts_at desc, lp.id desc
  limit 1
) active_promotion on true
where l.status = 'active';

grant select on public.listing_search to anon, authenticated;
revoke insert, update, delete on public.listing_search from anon, authenticated;

commit;
