create sequence if not exists public.prohouse_listing_seq;
create sequence if not exists public.prohouse_wallet_seq;
create sequence if not exists public.prohouse_transaction_seq;

alter table public.listings
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists listing_code text;

update public.listings
set listing_code = 'PH-' || lpad(nextval('public.prohouse_listing_seq')::text, 8, '0')
where listing_code is null;

alter table public.listings
  alter column listing_code set default ('PH-' || lpad(nextval('public.prohouse_listing_seq')::text, 8, '0')),
  alter column listing_code set not null;

create unique index if not exists listings_listing_code_key on public.listings(listing_code);
create index if not exists listings_owner_id_idx on public.listings(owner_id);

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  account_number text not null unique default ('PHW-' || lpad(nextval('public.prohouse_wallet_seq')::text, 8, '0')),
  balance numeric(18,2) not null default 0 check (balance >= 0),
  currency text not null default 'UZS' check (currency = 'UZS'),
  status text not null default 'active' check (status in ('active','blocked','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet_accounts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  transaction_code text not null unique default ('TX-' || lpad(nextval('public.prohouse_transaction_seq')::text, 10, '0')),
  listing_id uuid references public.listings(id) on delete set null,
  type text not null check (type in ('deposit','withdrawal','purchase','refund','adjustment','hold','release')),
  amount numeric(18,2) not null check (amount > 0),
  balance_after numeric(18,2),
  description text,
  status text not null default 'completed' check (status in ('pending','completed','failed','cancelled')),
  provider text,
  provider_transaction_id text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_id_idx on public.wallet_transactions(wallet_id, created_at desc);
create index if not exists wallet_transactions_user_id_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_transactions_listing_id_idx on public.wallet_transactions(listing_id);

create or replace function public.set_updated_at_wallet_accounts()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists wallet_accounts_updated_at on public.wallet_accounts;
create trigger wallet_accounts_updated_at before update on public.wallet_accounts
for each row execute function public.set_updated_at_wallet_accounts();

create or replace function public.ensure_wallet_for_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallet_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_wallet on public.profiles;
create trigger profiles_create_wallet after insert on public.profiles
for each row execute function public.ensure_wallet_for_profile();

insert into public.wallet_accounts (user_id)
select p.id from public.profiles p on conflict (user_id) do nothing;

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;

create policy wallet_accounts_select_own on public.wallet_accounts
for select to authenticated using (user_id = auth.uid());

create policy wallet_transactions_select_own on public.wallet_transactions
for select to authenticated using (user_id = auth.uid());

alter table public.listings enable row level security;
create policy listings_select_active_or_owned on public.listings
for select to anon, authenticated using (status = 'active' or owner_id = auth.uid());
create policy listings_insert_own on public.listings
for insert to authenticated with check (owner_id = auth.uid());
create policy listings_update_own on public.listings
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy listings_delete_own on public.listings
for delete to authenticated using (owner_id = auth.uid());