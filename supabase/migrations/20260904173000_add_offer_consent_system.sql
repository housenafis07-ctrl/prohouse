create table if not exists public.offer_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  title text not null default 'Ommaviy oferta',
  content text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(version)
);

create unique index if not exists offer_versions_active_idx
  on public.offer_versions (is_active)
  where is_active = true;

create table if not exists public.offer_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  phone text,
  offer_version integer not null,
  consented_at timestamptz not null default now()
);

create index if not exists offer_consents_user_id_idx on public.offer_consents(user_id);
create index if not exists offer_consents_phone_idx on public.offer_consents(phone);

alter table public.offer_versions enable row level security;
alter table public.offer_consents enable row level security;

create policy "Anyone can read active offer"
on public.offer_versions for select
using (is_active = true);

create policy "Authenticated users can record own offer consent"
on public.offer_consents for insert to authenticated
with check (user_id = auth.uid());

create policy "Users can read own offer consents"
on public.offer_consents for select to authenticated
using (user_id = auth.uid());

insert into public.offer_versions (version, title, content, is_active)
select 1, 'Ommaviy oferta', 'Ommaviy oferta matni bu yerga admin panel orqali kiritiladi.', true
where not exists (select 1 from public.offer_versions);
