-- Backfill legacy rent_dacha attributes into the structured rental_booking payload.
-- This keeps the current booking/detail UI compatible with older personal-cabinet listings
-- without changing the existing listings schema or booking architecture.

update public.listings
set draft_data = jsonb_set(
  coalesce(draft_data, '{}'::jsonb),
  '{attributes,rental_booking}',
  jsonb_build_object(
    'max_guests', coalesce(nullif(draft_data->'attributes'->>'max_guests',''), nullif(draft_data->'attributes'->>'included_guests',''), ''),
    'included_guests', coalesce(nullif(draft_data->'attributes'->>'included_guests',''), nullif(draft_data->attributes->>'max_guests',''), ''),
    'extra_guest_fee', coalesce(
      nullif(draft_data->'attributes'->>'extra_guest_fee',''),
      nullif(draft_data->'attributes'->>'september_extra_guest_price',''),
      nullif(draft_data->'attributes'->>'october_extra_guest_price',''),
      ''
    ),
    'bedrooms', coalesce(nullif(draft_data->'attributes'->>'bedrooms',''), ''),
    'single_beds', coalesce(nullif(draft_data->'attributes'->>'single_beds',''), ''),
    'double_beds', coalesce(nullif(draft_data->'attributes'->>'double_beds',''), ''),
    'bathrooms', coalesce(nullif(draft_data->'attributes'->>'bathrooms',''), ''),
    'check_in', coalesce(nullif(draft_data->'attributes'->>'check_in',''), ''),
    'check_out', coalesce(nullif(draft_data->'attributes'->>'check_out',''), ''),
    'quiet_hours', coalesce(nullif(draft_data->'attributes'->>'quiet_hours',''), ''),
    'policies', '[]'::jsonb,
    'amenities', (
      select coalesce(jsonb_agg(a order by a), '[]'::jsonb)
      from jsonb_array_elements_text(
        jsonb_build_array(
          case when lower(coalesce(draft_data->>'description','')) like '%wi-fi%' or lower(coalesce(draft_data->>'description','')) like '%wifi%' then 'wifi' end,
          case when lower(coalesce(draft_data->>'description','')) like '%karaoke%' then 'karaoke' end,
          case when lower(coalesce(draft_data->>'description','')) like '%bilyard%' then 'billiard' end,
          case when lower(coalesce(draft_data->>'description','')) like '%stol tennisi%' then 'tennis' end,
          case when lower(coalesce(draft_data->>'description','')) like '%yozgi oshxona%' then 'kitchen' end,
          case when lower(coalesce(draft_data->>'description','')) like '%barbekyu%' then 'bbq' end,
          case when lower(coalesce(draft_data->>'description','')) like '%jakuzi%' then 'jacuzzi' end,
          case when lower(coalesce(draft_data->>'description','')) like '%basseyn%' then 'pool' end
        )
      ) as a
      where a is not null
    ),
    'deposit_percent', coalesce(nullif(draft_data->'attributes'->>'deposit_percent',''), '15'),
    'blocked_dates', '[]'::jsonb,
    'date_prices', '{}'::jsonb,
    'weekday_price', coalesce(
      nullif(draft_data->'attributes'->>'weekday_price',''),
      nullif(draft_data->'attributes'->>'september_weekday_price',''),
      nullif(draft_data->'attributes'->>'october_weekday_price',''),
      ''
    ),
    'weekend_price', coalesce(
      nullif(draft_data->'attributes'->>'weekend_price',''),
      nullif(draft_data->'attributes'->>'september_weekend_price',''),
      nullif(draft_data->'attributes'->>'october_weekend_price',''),
      ''
    )
  ),
  true
)
where taxonomy_code = 'rent_dacha'
  and coalesce(draft_data->'attributes'->'rental_booking', '{}'::jsonb) = '{}'::jsonb
  and draft_data is not null;
