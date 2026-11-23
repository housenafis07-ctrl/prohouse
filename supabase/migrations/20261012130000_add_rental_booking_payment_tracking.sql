begin;

alter table public.rental_bookings
  add column if not exists provider_payment_id text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_expires_at timestamptz;

create unique index if not exists rental_bookings_provider_payment_id_key
  on public.rental_bookings(provider_payment_id)
  where provider_payment_id is not null;

commit;
