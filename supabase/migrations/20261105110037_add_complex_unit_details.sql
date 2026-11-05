begin;

alter table public.complex_units
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.complex_units.details is
  'Optional apartment characteristics and payment terms entered by the developer.';

commit;
