-- Royalhouse rental booking foundation.
-- Applies only to rental listings; sale/new-building listings are unaffected.
create table if not exists public.listing_rental_profiles (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  max_guests integer,
  bedrooms integer,
  beds_single integer,
  beds_double integer,
  checkin_time time,
  checkout_time time,
  quiet_hours_start time,
  quiet_hours_end time,
  corporate_allowed boolean not null default false,
  alcohol_allowed boolean not null default false,
  pets_allowed boolean not null default false,
  children_allowed boolean not null default true,
  smoking_allowed boolean not null default false,
  marriage_certificate_required boolean not null default false,
  amenities jsonb not null default '[]'::jsonb,
  house_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.listing_booking_reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  check_in date not null,
  check_out date not null,
  nights integer not null,
  total_amount numeric not null check (total_amount >= 0),
  advance_amount numeric not null check (advance_amount >= 0),
  currency text not null default 'UZS' check (currency in ('UZS','USD')),
  status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','cancelled','expired','completed')),
  payment_provider text check (payment_provider in ('payme','click','manual')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded')),
  payment_order_id text,
  customer_name text,
  customer_phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (nights = (check_out - check_in))
);
create index if not exists listing_booking_reservations_listing_dates_idx on public.listing_booking_reservations(listing_id, check_in, check_out);

alter table public.listing_rental_profiles enable row level security;
alter table public.listing_booking_days enable row level security;
alter table public.listing_booking_settings enable row level security;
alter table public.listing_booking_reservations enable row level security;

create policy "Public can view rental profile for active rental listings"
on public.listing_rental_profiles for select
using (exists (select 1 from public.listings l where l.id = listing_rental_profiles.listing_id and l.status = 'active' and l.listing_type = 'rent'));
create policy "Owner can manage own rental profile"
on public.listing_rental_profiles for all to authenticated
using (exists (select 1 from public.listings l where l.id = listing_rental_profiles.listing_id and l.owner_id = auth.uid()))
with check (exists (select 1 from public.listings l where l.id = listing_rental_profiles.listing_id and l.owner_id = auth.uid()));

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

create policy "Customer can create own booking reservation"
on public.listing_booking_reservations for insert to authenticated
with check (customer_id = auth.uid() and exists (select 1 from public.listings l where l.id = listing_booking_reservations.listing_id and l.status = 'active' and l.listing_type = 'rent'));
create policy "Customer can view own booking reservations"
on public.listing_booking_reservations for select to authenticated using (customer_id = auth.uid());
create policy "Owner can view booking reservations for own listing"
on public.listing_booking_reservations for select to authenticated using (exists (select 1 from public.listings l where l.id = listing_booking_reservations.listing_id and l.owner_id = auth.uid()));
