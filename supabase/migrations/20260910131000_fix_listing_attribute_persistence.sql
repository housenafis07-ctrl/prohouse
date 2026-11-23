-- Fix listing attribute persistence for the canonical listing pipeline.
-- Keep dynamic attributes as the source of truth while mirroring common
-- searchable card fields onto listings for fast public queries.

alter table public.listings
  add column if not exists land_area numeric;

create index if not exists listings_land_area_idx
  on public.listings(land_area)
  where land_area is not null;

-- Backfill existing listings created before canonical attribute persistence.
update public.listings
set
  area_m2 = coalesce(area_m2, nullif(draft_data->'attributes'->>'area_m2','')::numeric),
  rooms = coalesce(rooms, nullif(draft_data->'attributes'->>'rooms','')::numeric),
  floor = coalesce(floor, nullif(draft_data->'attributes'->>'floor','')::numeric),
  floors_total = coalesce(floors_total, nullif(draft_data->'attributes'->>'floors_total','')::numeric),
  land_area = coalesce(land_area, nullif(draft_data->'attributes'->>'land_area','')::numeric)
where jsonb_typeof(draft_data->'attributes') = 'object';
