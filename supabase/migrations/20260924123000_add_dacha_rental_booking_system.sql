-- Royalhouse: daily-rental dacha details, availability calendar and 15% advance booking foundation.
-- Additive only: existing listings and non-rental flows are unchanged.

insert into public.category_attributes(category_code,code,name_uz,name_ru,data_type,options,unit,is_required,sort_order)
values
('rent_dacha','accommodation_type','Turar joy turi','Тип размещения','select','["Dacha","Villa","Cottage","Dam olish maskani"]'::jsonb,null,false,5),
('rent_dacha','rooms','Xonalar','Комнаты','number','[]'::jsonb,null,false,10),
('rent_dacha','max_guests','Mehmonlar soni','Количество гостей','number','[]'::jsonb,null,true,20),
('rent_dacha','bedrooms','Yotoqxonalar soni','Спальные комнаты','number','[]'::jsonb,null,false,30),
('rent_dacha','single_beds','Bir kishilik yotoqlar soni','Односпальные кровати','number','[]'::jsonb,'ta',false,40),
('rent_dacha','double_beds','Ikki kishilik yotoqlar soni','Двуспальные кровати','number','[]'::jsonb,'ta',false,50),
('rent_dacha','corporate_allowed','Korporativ mehmonlar','Корпоративные гости','boolean','[]'::jsonb,null,false,60),
('rent_dacha','alcohol_allowed','Spirtli ichimliklarga ruxsat','Разрешён алкоголь','boolean','[]'::jsonb,null,false,70),
('rent_dacha','pets_allowed','Uy hayvonlariga ruxsat','Разрешены домашние животные','boolean','[]'::jsonb,null,false,80),
('rent_dacha','marriage_certificate_required','Nikoh guvohnomasi talab qilinadi','Требуется свидетельство о браке','boolean','[]'::jsonb,null,false,90),
('rent_dacha','checkin_time','Kirish vaqti','Время заезда','text','[]'::jsonb,null,false,100),
('rent_dacha','checkout_time','Chiqish vaqti','Время выезда','text','[]'::jsonb,null,false,110),
('rent_dacha','quiet_hours','Sokin soatlar','Тихие часы','text','[]'::jsonb,null,false,120),
('rent_dacha','guest_types','Mehmonlar turi','Типы гостей','multiselect','["Oila","Ayollar kollektivi","Erkaklar kollektivi","Korporativ"]'::jsonb,null,false,130),
('rent_dacha','amenities','Qulayliklar','Удобства','multiselect','["Wi-Fi","Konditsioner","Ochiq hovuz","Yopiq hovuz","Sauna","Turk hammom","Karaoke","PlayStation","Bilyard","Stol tennisi","Tapchan","Oshxona","Mangal / BBQ","Bolalar maydonchasi"]'::jsonb,null,false,140)
on conflict(category_code,code) do update set name_uz=excluded.name_uz,name_ru=excluded.name_ru,data_type=excluded.data_type,options=excluded.options,unit=excluded.unit,is_required=excluded.is_required,sort_order=excluded.sort_order,is_active=true;

create table if not exists public.rental_listing_settings (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  booking_enabled boolean not null default true,
  advance_percent numeric(5,2) not null default 15 check (advance_percent >= 0 and advance_percent <= 100),
  min_nights integer not null default 1 check (min_nights >= 1),
  checkin_time text,
  checkout_time text,
  currency text not null default 'UZS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_calendar_days (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  day date not null,
  status text not null default 'available' check (status in ('available','blocked','booked')),
  price numeric(14,2),
  currency text not null default 'UZS',
  booking_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id,day)
);
create index if not exists rental_calendar_days_listing_day_idx on public.rental_calendar_days(listing_id,day);

create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  checkin_date date not null,
  checkout_date date not null,
  guests integer not null default 1 check (guests > 0),
  nights integer generated always as ((checkout_date - checkin_date)) stored,
  total_amount numeric(14,2) not null default 0,
  advance_percent numeric(5,2) not null default 15,
  advance_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  currency text not null default 'UZS',
  status text not null default 'pending_payment' check (status in ('pending_payment','payment_processing','paid','confirmed','cancelled','expired','completed')),
  payment_provider text check (payment_provider is null or payment_provider in ('payme','click','paynet')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  payment_reference text,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout_date > checkin_date)
);
create index if not exists rental_bookings_listing_dates_idx on public.rental_bookings(listing_id,checkin_date,checkout_date);
create index if not exists rental_bookings_customer_idx on public.rental_bookings(customer_id,created_at desc);

alter table public.rental_calendar_days
  add constraint rental_calendar_booking_fk foreign key (booking_id) references public.rental_bookings(id) on delete set null;

alter table public.rental_listing_settings enable row level security;
alter table public.rental_calendar_days enable row level security;
alter table public.rental_bookings enable row level security;

create policy rental_settings_public_read on public.rental_listing_settings
  for select using (exists (select 1 from public.listings l where l.id=listing_id and l.status='active' and l.taxonomy_code='rent_dacha'));
create policy rental_settings_owner_manage on public.rental_listing_settings
  for all using (exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()))
  with check (exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()));

create policy rental_calendar_public_read on public.rental_calendar_days
  for select using (exists (select 1 from public.listings l where l.id=listing_id and l.status='active' and l.taxonomy_code='rent_dacha'));
create policy rental_calendar_owner_manage on public.rental_calendar_days
  for all using (exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()))
  with check (exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()));

create policy rental_bookings_customer_read on public.rental_bookings
  for select using (customer_id=auth.uid() or exists (select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()));
create policy rental_bookings_customer_insert on public.rental_bookings
  for insert with check (customer_id=auth.uid());

create or replace function public.ensure_rental_listing_settings()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.taxonomy_code='rent_dacha' then
    insert into public.rental_listing_settings(listing_id,currency)
    values(new.id,coalesce(new.currency,'UZS'))
    on conflict(listing_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_rental_listing_settings on public.listings;
create trigger trg_ensure_rental_listing_settings
after insert or update of taxonomy_code on public.listings
for each row execute function public.ensure_rental_listing_settings();

insert into public.rental_listing_settings(listing_id,currency)
select id,coalesce(currency,'UZS') from public.listings
where taxonomy_code='rent_dacha'
on conflict(listing_id) do nothing;
