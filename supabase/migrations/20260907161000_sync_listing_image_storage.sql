-- Reproducible/idempotent baseline for listing image Storage metadata.
-- Safe to run against an existing database: no listing image rows are deleted.

alter table public.listing_images
  add column if not exists storage_path text;

create unique index if not exists listing_images_listing_id_sort_order_key
  on public.listing_images (listing_id, sort_order);

-- Existing public URLs may predate storage_path. Keep them intact; only the
-- new upload/edit flow requires storage_path for objects owned by the partner.

comment on column public.listing_images.storage_path is
  'Supabase Storage object path in listing-images; null is allowed for legacy/external images.';
