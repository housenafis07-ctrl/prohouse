-- Listing search only needs the primary image (sort_order = 0).
-- Keep this index narrow so the 100k+ listing search path does not scan
-- secondary image rows just to render cards.
create index if not exists listing_images_primary_lookup_idx
  on public.listing_images (listing_id)
  where sort_order = 0;

comment on index public.listing_images_primary_lookup_idx is
  'Fast lookup of the primary listing image for search/listing cards.';
