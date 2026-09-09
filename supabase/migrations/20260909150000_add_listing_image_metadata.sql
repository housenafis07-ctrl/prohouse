alter table public.listing_images
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists size_bytes bigint,
  add column if not exists mime_type text;
