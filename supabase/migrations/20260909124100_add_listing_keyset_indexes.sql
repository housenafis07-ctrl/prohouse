-- Keyset pagination indexes for the public active-listings search.
-- Partial indexes keep drafts, rejected and archived listings out of the index.
create index if not exists listings_active_published_id_keyset_idx
  on public.listings (published_at desc, id desc)
  where status = 'active';

create index if not exists listings_active_price_id_asc_keyset_idx
  on public.listings (price asc, id asc)
  where status = 'active';

create index if not exists listings_active_price_id_desc_keyset_idx
  on public.listings (price desc, id desc)
  where status = 'active';
