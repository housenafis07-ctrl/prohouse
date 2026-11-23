alter table public.listings
  add column if not exists title_ru text;

create index if not exists listings_title_ru_idx on public.listings using gin (to_tsvector('simple', coalesce(title_ru, '')));
