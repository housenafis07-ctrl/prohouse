-- Royalhouse Dacha / Bronla-inspired booking foundation.
-- Keeps the existing listings/taxonomy pipeline intact and adds a dedicated
-- availability + reservation layer for rent_dacha listings.

create extension if not exists btree_gist;

-- Bronla-style dacha fields. The existing listing wizard already renders
-- category_attributes dynamically, so these fields become available without
-- replacing the working wizard.
insert into public.category_attributes
  (category_code, code, name_uz, name_ru, data_type, options, unit, is_required, sort_order, is_active)
values
  ('rent_dacha','max_guests','Mehmonlar soni','Количество гостей','number','[]','kishi',true,10,true),
  ('rent_dacha','bedrooms','Yotoqxonalar soni','Количество спален','number','[]','ta',true,20,true),
  ('rent_dacha','beds','Yotoqlar soni','Количество спальных мест','number','[]','ta',true,30,true),
  ('rent_dacha','guest_types','Kimlar uchun mo‘ljallangan?','Для кого предназначено?','multiselect','["Oila","Erkaklar kollektivi","Ayollar kollektivi","Korporativ"]',null,true,40,true),
  ('rent_dacha','pool_type','Hovuz turi','Тип бассейна','select','["Yo‘q","Ochiq hovuz","Yopiq hovuz","Ochiq va yopiq hovuz"]',null,false,50,true),
  ('rent_dacha','pets_allowed','Uy hayvonlari mumkinmi?','Можно с домашними животными?','boolean','[]',null,false,60,true),
  ('rent_dacha','alcohol_allowed','Spirtli ichimliklar mumkinmi?','Разрешён алкоголь?','boolean','[]',null,false,70,true),
  ('rent_dacha','marriage_certificate','Nikoh guvohnomasi talabi','Требуется свидетельство о браке','text','[]',null,false,80,true),
  ('rent_dacha','check_in_time','Kirish vaqti','Время заезда','text','[]',null,true,90,true),
  ('rent_dacha','check_out_time','Ketish vaqti','Время выезда','text','[]',null,true,100,true),
  ('rent_dacha','quiet_hours','Sokin soatlar','Тихие часы','text','[]',null,false,110,true),
  ('rent_dacha','landmark','Orientir','Ориентир','text','[]',null,false,120,true),
  ('rent_dacha','second_phone','Ikkinchi telefon raqami','Второй номер телефона','text','[]',null,false,130,true),
  ('rent_dacha','amenities','Qo‘shimcha qulayliklar','Дополнительные удобства','multiselect','["Wi-Fi","Avtoturargoh","Oshxona","Barbekyu","Mangal","Karaoke","PlayStation","Bilyard","Stol tennisi","Finskaya sauna","Turk hammomi","Rus hammomi","Jakuzi","Ochiq oshxona","Tapchan","Televizor","Konditsioner"]',null,false,140,true),
  ('rent_dacha','weekday_price','Ish kuni narxi','Цена в будни','number','[]',null,false,150,true),
  ('rent_dacha','weekend_price','Dam olish kuni narxi','Цена в выходные','number','[]',null,false,160,true)
on conflict(category_code,code) do update set
  name_uz=excluded.name_uz,
  name_ru=excluded.name_ru,
  data_type=excluded.data_type,
  options=excluded.options,
  unit=excluded.unit,
  is_required=excluded.is_required,
  sort_order=excluded.sort_order,
  is_active=true;

create table if not exists public.dacha_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  currency text not null default 'UZS' check (currency in ('UZS','USD')),
  commission_rate numeric(5,4) not null default 0.1500 check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed')),
  guest_note text,
  owner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (check_out - check_in <= 90)
);

create index if not exists dacha_bookings_listing_dates_idx
  on public.dacha_bookings(listing_id, check_in, check_out);
create index if not exists dacha_bookings_guest_idx
  on public.dacha_bookings(guest_id, created_at desc);
create index if not exists dacha_bookings_status_idx
  on public.dacha_bookings(status, check_in);

-- Prevent two active reservations from taking the same dacha/date range.
alter table public.dacha_bookings
  drop constraint if exists dacha_bookings_no_overlap;
alter table public.dacha_bookings
  add constraint dacha_bookings_no_overlap
  exclude using gist (
    listing_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('pending','confirmed'));

create table if not exists public.dacha_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  check (end_date - start_date <= 366)
);
create index if not exists dacha_blocked_dates_listing_idx
  on public.dacha_blocked_dates(listing_id,start_date,end_date);

alter table public.dacha_bookings enable row level security;
alter table public.dacha_blocked_dates enable row level security;

drop policy if exists dacha_bookings_guest_read on public.dacha_bookings;
create policy dacha_bookings_guest_read on public.dacha_bookings
  for select to authenticated
  using (guest_id = (select auth.uid()));

drop policy if exists dacha_bookings_owner_read on public.dacha_bookings;
create policy dacha_bookings_owner_read on public.dacha_bookings
  for select to authenticated
  using (exists(select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

drop policy if exists dacha_bookings_guest_insert on public.dacha_bookings;
create policy dacha_bookings_guest_insert on public.dacha_bookings
  for insert to authenticated
  with check (
    guest_id = (select auth.uid())
    and exists(
      select 1 from public.listings l
      where l.id = listing_id
        and l.status = 'active'
        and l.taxonomy_code = 'rent_dacha'
        and l.owner_id <> (select auth.uid())
    )
  );

drop policy if exists dacha_bookings_guest_update on public.dacha_bookings;
create policy dacha_bookings_guest_update on public.dacha_bookings
  for update to authenticated
  using (guest_id = (select auth.uid()))
  with check (guest_id = (select auth.uid()));

drop policy if exists dacha_blocked_dates_owner_all on public.dacha_blocked_dates;
create policy dacha_blocked_dates_owner_all on public.dacha_blocked_dates
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists(select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()) and l.taxonomy_code = 'rent_dacha')
  );

-- Telegram identity foundation. The bot uses this to associate a Telegram
-- account with a Royalhouse account without storing the bot token in the DB.
create table if not exists public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  user_id uuid references auth.users(id) on delete set null,
  username text,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists telegram_accounts_user_idx on public.telegram_accounts(user_id);

alter table public.telegram_accounts enable row level security;
revoke all on public.telegram_accounts from anon, authenticated;

comment on table public.dacha_bookings is 'Royalhouse dacha reservations; platform commission defaults to 15%. Payment gateway can be connected later.';
comment on table public.dacha_blocked_dates is 'Owner-controlled unavailable periods for dacha calendars.';
comment on table public.telegram_accounts is 'Maps Telegram identities to Royalhouse accounts for bot and Mini App flows.';
