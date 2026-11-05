begin;

alter table public.residential_buildings
  add column if not exists technical_details jsonb not null default '{}'::jsonb;

comment on column public.residential_buildings.technical_details is
  'Optional developer-entered technical details for a residential building; existing building fields remain unchanged.';

commit;
