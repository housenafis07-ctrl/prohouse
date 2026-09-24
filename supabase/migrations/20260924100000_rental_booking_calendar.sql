-- Royalhouse rental booking foundation: availability calendar, 15% deposit and future Payme/Click support.
create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  nights integer generated always as ((check_out - check_in)) stored,
  currency text not null default 'UZS',
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  deposit_percent numeric(5,2) not null default 15 check (deposit_percent > 0 and deposit_percent <= 100),
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  payment_provider text not null default 'pending' check (payment_provider in ('pending','payme','click','manual')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','cancelled','expired')),
  provider_transaction_id text,
  guest_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_bookings_dates_check check (check_out > check_in)
);

create index if not exists rental_bookings_listing_dates_idx on public.rental_bookings(listing_id, check_in, check_out);
create index if not exists rental_bookings_guest_idx on public.rental_bookings(guest_id, created_at desc);
create index if not exists rental_bookings_status_idx on public.rental_bookings(listing_id, status, payment_status);

alter table public.rental_bookings enable row level security;
drop policy if exists rental_bookings_guest_read on public.rental_bookings;
create policy rental_bookings_guest_read on public.rental_bookings for select to authenticated using (guest_id = (select auth.uid()));
drop policy if exists rental_bookings_owner_read on public.rental_bookings;
create policy rental_bookings_owner_read on public.rental_bookings for select to authenticated using (exists(select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));
drop policy if exists rental_bookings_guest_insert on public.rental_bookings;
create policy rental_bookings_guest_insert on public.rental_bookings for insert to authenticated with check (guest_id = (select auth.uid()));

-- Booking payment data is provider-neutral so Payme/Click callbacks can be connected later without changing the booking model.
