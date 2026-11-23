begin;

-- Keep the public listing projection aligned with the homepage query.
-- Active paid promotions are authoritative for TOP/HIGHLIGHT/PREMIUM;
-- UP is a one-day bump and must not be treated as a TOP promotion.
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
  l.land_area,
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
    when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day') then 'UP'::text
    else null::text
  end as effective_promotion_badge,
  l.is_trusted_seller,
  -- Append new columns to preserve the existing view's column order.
  l.primary_image_url,
  (
    greatest(
      coalesce(active_promotion.boost_rank, 0),
      case
        when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day')
          then 20
        else 0
      end
    ) >= 60
  ) as effective_is_featured
from public.listings l
left join lateral (
  select mp.boost_rank, mp.badge
  from public.listing_promotions lp
  join public.monetization_products mp on mp.code = lp.product_code
  where lp.listing_id = l.id
    and lp.status = 'active'
    and mp.active = true
    and lp.starts_at <= now()
    and lp.ends_at is not null
    and lp.ends_at > now()
    and mp.product_type in ('top', 'highlight', 'premium')
  order by mp.boost_rank desc, lp.starts_at desc, lp.id desc
  limit 1
) active_promotion on true
where l.status = 'active';

grant select on public.listing_search to anon, authenticated;
revoke insert, update, delete on public.listing_search from anon, authenticated;

commit;
