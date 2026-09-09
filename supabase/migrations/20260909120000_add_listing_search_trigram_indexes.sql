-- Scale-safe search indexes for the public listing search endpoint.
-- Keeps the existing ILIKE search contract while avoiding a full active-listing
-- scan for common substring searches as the catalog grows.

create extension if not exists pg_trgm;

create index if not exists listings_active_title_trgm_idx
  on public.listings using gin (title gin_trgm_ops)
  where status = 'active';

create index if not exists listings_active_title_ru_trgm_idx
  on public.listings using gin (title_ru gin_trgm_ops)
  where status = 'active';
