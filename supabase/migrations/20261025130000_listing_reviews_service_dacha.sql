begin;

-- Reviews are available only for service listings and dacha rentals.
-- A reviewer can leave one review per listing.
create unique index if not exists listing_reviews_listing_author_uidx
  on public.listing_reviews(listing_id, author_id)
  where listing_id is not null;

create index if not exists listing_reviews_published_listing_idx
  on public.listing_reviews(listing_id, created_at desc)
  where status = 'published';

-- Add rating information to the public search view and give highly rated
-- service/dacha listings a modest organic ranking boost.
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
  l.primary_image_url,
  l.is_mortgage_available,
  l.is_verified,
  l.is_featured,
  l.published_at,
  l.taxonomy_code,
  l.promoted_until,
  l.promotion_rank,
  l.promotion_badge,
  l.bumped_at,
  coalesce(rating_summary.average, 0)::numeric as rating_average,
  coalesce(rating_summary.count, 0)::integer as rating_count,
  greatest(
    coalesce(active_promotion.boost_rank, 0),
    case when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day') then 20 else 0 end,
    case when coalesce(l.is_trusted_seller, false) then 10 else 0 end,
    case
      when (coalesce(category.entity_type, '') = 'service' or l.taxonomy_code = 'rent_dacha')
        and coalesce(rating_summary.count, 0) >= 3
      then least(15, round(coalesce(rating_summary.average, 0) * 3)::integer)
      else 0
    end
  ) as effective_promotion_rank,
  case
    when active_promotion.badge is not null then active_promotion.badge
    when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day') then 'UP'
    when coalesce(l.is_trusted_seller, false) then 'Ishonchli'
    else null
  end as effective_promotion_badge,
  (
    greatest(
      coalesce(active_promotion.boost_rank, 0),
      case when l.bumped_at is not null and l.bumped_at > (now() - interval '1 day') then 20 else 0 end,
      case when coalesce(l.is_trusted_seller, false) then 10 else 0 end,
      case
        when (coalesce(category.entity_type, '') = 'service' or l.taxonomy_code = 'rent_dacha')
          and coalesce(rating_summary.count, 0) >= 3
        then least(15, round(coalesce(rating_summary.average, 0) * 3)::integer)
        else 0
      end
    ) >= 60
  ) as effective_is_featured,
  l.is_trusted_seller
from public.listings l
left join public.listing_categories category on category.code = l.taxonomy_code
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
  order by mp.boost_rank desc, lp.ends_at desc
  limit 1
) active_promotion on true
left join lateral (
  select
    round(avg(lr.rating)::numeric, 1) as average,
    count(*)::integer as count
  from public.listing_reviews lr
  where lr.listing_id = l.id
    and lr.status = 'published'
) rating_summary on true
where l.status = 'active'
  and coalesce(l.public_visibility, true) = true;

grant select on public.listing_search to anon, authenticated;
revoke insert, update, delete on public.listing_search from anon, authenticated;

commit;
