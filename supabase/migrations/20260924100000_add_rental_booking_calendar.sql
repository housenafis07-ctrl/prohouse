-- Royalhouse rental booking foundation.
-- Applies only to rental listings; sale/new-building listings are unaffected.
create table if not exists public.listing_booking_days (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  booking_date date not null,
  status text not null default 'available' check (status in ('available','blocked','reserved','booked')),
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'UZS' check (currency in ('UZS','USD')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, booking_date)
);
create index if not exists listing_booking_days_listing_date_idx on public.listing_booking_days(listing_id, booking_date);

create table if not exists public.listing_booking_settings (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  enabled boolean not null default false,
  advance_percent numeric not null default 15 check (advance_percent >= 0 and advance_percent <= 100),
  booking_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_booking_days enable row level security;
alter table public.listing_booking_settings enable row level security;

create policy "Public can view booking days for rental listings"
on public.listing_booking_days for select
using (exists (select 1 from public.listings l where l.id = listing_booking_days.listing_id and l.status = 'active' and l.listing_type = 'rent'));

create policy "Owner can manage own booking days"
on public.listing_booking_days for all to authenticated
using (exists (select 1 from public.listings l where l.id = listing_booking_days.listing_id and l.owner_id = auth.uid()))
with check (exists (select 1 from public.listings l where l.id = listing_booking_days.listing_id and l.owner_id = auth.uid()));

create policy "Public can view booking settings for rental listings"
on public.listing_booking_settings for select
using (enabled and exists (select 1 from public.listings l where l.id = listing_booking_settings.listing_id and l.status = 'active' and l.listing_type = 'rent'));

create policy "Owner can manage own booking settings"
on public.listing_booking_settings for all to authenticated
using (exists (select 1 from public.listings l where l.id = listing_booking_settings.listing_id and l.owner_id = auth.uid()))
with check (exists (select 1 from public.listings l where l.id = listing_booking_settings.listing_id and l.owner_id = auth.uid()));
