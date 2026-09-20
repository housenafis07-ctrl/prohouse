begin;

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

  start_time := now();

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
      when p.duration_days is null or p.duration_days <= 0 then null
      else start_time + make_interval(days => p.duration_days)
    end;

    insert into public.monetization_entitlements(
      user_id, product_code, order_item_id, listing_id,
      status, quantity_total, quantity_remaining,
      starts_at, ends_at, metadata
    )
    values(
      o.user_id, item.product_code, item.id, item.listing_id,
      'active', greatest(item.quantity, 1), greatest(item.quantity, 1),
      start_time, end_time, jsonb_build_object('order_id', o.id)
    )
    returning * into e;

    activated_count := activated_count + 1;

    if p.product_type in ('top', 'highlight', 'bump') and item.listing_id is not null then
      insert into public.listing_promotions(
        user_id, listing_id, product_code, price_paid_uzs,
        starts_at, ends_at, status
      )
      values(
        o.user_id, item.listing_id, item.product_code,
        item.unit_price_uzs * greatest(item.quantity, 1),
        start_time, coalesce(end_time, start_time), 'active'
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

commit;
