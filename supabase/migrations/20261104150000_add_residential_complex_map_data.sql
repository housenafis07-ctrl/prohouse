alter table public.residential_complexes
  add column if not exists map_data jsonb not null default '{"type":"FeatureCollection","features":[]}'::jsonb;

comment on column public.residential_complexes.map_data is
  'GeoJSON FeatureCollection containing the residential complex boundary and individual building footprints.';
