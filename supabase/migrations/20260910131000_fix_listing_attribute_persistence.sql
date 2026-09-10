-- Fix listing attribute persistence for the canonical listing pipeline.
-- Keep dynamic attributes as the source of truth while mirroring common
-- searchable card fields onto listings for fast public queries.

alter table public.listings
  add column if not exists land_area numeric;

create index if not exists listings_land_area_idx
  on public.listings(land_area)
  where land_area is not null;
