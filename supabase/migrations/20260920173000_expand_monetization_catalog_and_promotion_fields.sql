begin;

-- Monetization catalog used by seller checkout.
-- Prices are launch tariffs and remain editable from the admin/catalog layer.

alter table public.listings
  add column if not exists promoted_until timestamptz,
  add column if not exists promotion_rank integer not null default 0,
  add column if not exists promotion_badge text,
  add column if not exists bumped_at timestamptz;

create index if not exists listings_promotion_idx
  on public.listings (status, promotion_rank desc, bumped_at desc nulls last, published_at desc nulls last);

update public.monetization_products
set price_uzs = case code
  when 'top_1' then 15000
  when 'top_3' then 35000
  when 'top_7' then 60000
  when 'top_14' then 100000
  when 'top_30' then 180000
  when 'up' then 10000
  when 'highlight' then 25000
  when 'premium' then 60000
  else price_uzs
end,
active = case
  when code in ('top_1','top_3','top_7','top_14','top_30','up','highlight','premium') then true
  else active
end,
metadata = case code
  when 'top_1' then '{"benefits":["Qidiruvda yuqori joylashuv","TOP belgisi"],"recommended":false}'::jsonb
  when 'top_3' then '{"benefits":["3 kun yuqori joylashuv","TOP belgisi"],"recommended":false}'::jsonb
  when 'top_7' then '{"benefits":["7 kun yuqori joylashuv","TOP belgisi"],"recommended":true}'::jsonb
  when 'top_14' then '{"benefits":["14 kun yuqori joylashuv","TOP belgisi"],"recommended":false}'::jsonb
  when 'top_30' then '{"benefits":["30 kun yuqori joylashuv","TOP belgisi"],"recommended":false}'::jsonb
  when 'up' then '{"benefits":["E’lonni qayta yuqoriga ko‘tarish","Bir martalik xizmat"],"recommended":false}'::jsonb
  when 'highlight' then '{"benefits":["Rangli ajratish","Ko‘proq ko‘zga tashlanish"],"recommended":true}'::jsonb
  when 'premium' then '{"benefits":["Premium badge","Ustuvor ko‘rinish","Yuqori promotion rank"],"recommended":true}'::jsonb
  else metadata
end,
updated_at = now()
where code in ('top_1','top_3','top_7','top_14','top_30','up','highlight','premium');

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
  select * into o from public.monetization_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if o.status <> 'paid' then raise exception 'ORDER_NOT_PAID' using errcode = 'P0001'; end if;
  start_time := now();

  for item in select * from public.monetization_order_items where order_id = o.id order by created_at, id for update loop
    select * into p from public.monetization_products where code = item.product_code;
    if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;

    select * into e from public.monetization_entitlements where order_item_id = item.id limit 1 for update;
    if found then
      existing_count := existing_count + 1;
      continue;
    end if;

    end_time := case when p.duration_days is null or p.duration_days <= 0 then null else start_time + make_interval(days => p.duration_days) end;

    insert into public.monetization_entitlements(
      user_id, product_code, order_item_id, listing_id, status,
      quantity_total, quantity_remaining, starts_at, ends_at, metadata
    ) values (
      o.user_id, item.product_code, item.id, item.listing_id, 'active',
      greatest(item.quantity, 1), greatest(item.quantity, 1), start_time, end_time,
      jsonb_build_object('order_id', o.id)
    ) returning * into e;

    activated_count := activated_count + 1;

    if item.listing_id is not null and p.product_type in ('top','highlight','premium') then
      promotion_end := greatest(coalesce((select promoted_until from public.listings where id=item.listing_id and owner_id=o.user_id), start_time), start_time)
        + make_interval(days => greatest(p.duration_days, 1));

      update public.listings
      set promoted_until = promotion_end,
          promotion_rank = greatest(coalesce(promotion_rank, 0), p.boost_rank),
          promotion_badge = p.badge,
          is_featured = (p.boost_rank >= 60)
      where id = item.listing_id and owner_id = o.user_id;

      insert into public.listing_promotions(
        user_id, listing_id, product_code, price_paid_uzs, starts_at, ends_at, status
      ) values (
        o.user_id, item.listing_id, item.product_code,
        item.unit_price_uzs * greatest(item.quantity, 1),
        start_time, promotion_end, 'active'
      );
    elsif item.listing_id is not null and p.product_type = 'up' then
      update public.listings
      set bumped_at = start_time,
          promotion_rank = greatest(coalesce(promotion_rank, 0), p.boost_rank)
      where id = item.listing_id and owner_id = o.user_id;

      insert into public.listing_promotions(
        user_id, listing_id, product_code, price_paid_uzs, starts_at, ends_at, status
      ) values (
        o.user_id, item.listing_id, item.product_code,
        item.unit_price_uzs * greatest(item.quantity, 1),
        start_time, null, 'active'
      );
    end if;
  end loop;

  return jsonb_build_object('order_id', o.id, 'activated_count', activated_count, 'already_active_count', existing_count);
end;
$$;

revoke all on function public.activate_monetization_order(uuid) from public, anon, authenticated;
grant execute on function public.activate_monetization_order(uuid) to service_role;

commit;
