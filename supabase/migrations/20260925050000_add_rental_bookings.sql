create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  currency text not null default 'UZS',
  total_amount numeric(14,2) not null default 0,
  deposit_percent numeric(5,2) not null default 15,
  deposit_amount numeric(14,2) not null default 0,
  payment_provider text not null default 'pending',
  payment_status text not null default 'pending',
  status text not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_bookings_dates_check check (check_out > check_in)
);
create index if not exists rental_bookings_listing_dates_idx on public.rental_bookings(listing_id, check_in, check_out);
create index if not exists rental_bookings_guest_idx on public.rental_bookings(guest_id, created_at desc);
alter table public.rental_bookings enable row level security;
drop policy if exists rental_bookings_guest_select on public.rental_bookings;
create policy rental_bookings_guest_select on public.rental_bookings for select using (auth.uid() = guest_id);
drop policy if exists rental_bookings_owner_select on public.rental_bookings;
create policy rental_bookings_owner_select on public.rental_bookings for select using (exists (select 1 from public.listings l where l.id = rental_bookings.listing_id and l.owner_id = auth.uid()));
