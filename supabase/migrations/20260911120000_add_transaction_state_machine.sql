create table if not exists public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  lead_id uuid not null unique references public.listing_leads(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lead' check (status in ('lead','viewing','offer','deal','payment','contract','cancelled')),
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'UZS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_transactions_parties_different check (buyer_id <> seller_id)
);

create index if not exists property_transactions_listing_idx on public.property_transactions(listing_id, created_at desc);
create index if not exists property_transactions_buyer_idx on public.property_transactions(buyer_id, updated_at desc);
create index if not exists property_transactions_seller_idx on public.property_transactions(seller_id, updated_at desc);
create index if not exists property_transactions_status_idx on public.property_transactions(status, updated_at desc);

create table if not exists public.property_transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.property_transactions(id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('lead','viewing','offer','deal','payment','contract','cancelled')),
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists property_transaction_events_transaction_idx on public.property_transaction_events(transaction_id, created_at asc);

alter table public.property_transactions enable row level security;
alter table public.property_transaction_events enable row level security;

drop policy if exists "property_transactions_participants_read" on public.property_transactions;
create policy "property_transactions_participants_read" on public.property_transactions
for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "property_transaction_events_participants_read" on public.property_transaction_events;
create policy "property_transaction_events_participants_read" on public.property_transaction_events
for select to authenticated using (
  exists (
    select 1 from public.property_transactions t
    where t.id = transaction_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create or replace function public.touch_property_transaction_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists property_transactions_touch_updated_at on public.property_transactions;
create trigger property_transactions_touch_updated_at before update on public.property_transactions
for each row execute function public.touch_property_transaction_updated_at();

create or replace function public.is_valid_property_transaction_transition(old_status text, new_status text)
returns boolean language sql immutable as $$
  select (old_status, new_status) in (
    ('lead','viewing'),
    ('viewing','offer'),
    ('offer','deal'),
    ('deal','payment'),
    ('payment','contract'),
    ('lead','cancelled'),
    ('viewing','cancelled'),
    ('offer','cancelled'),
    ('deal','cancelled'),
    ('payment','cancelled')
  );
$$;

create or replace function public.transition_property_transaction(
  p_transaction_id uuid,
  p_to_status text,
  p_actor_id uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.property_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.property_transactions;
  result public.property_transactions;
begin
  select * into t from public.property_transactions where id = p_transaction_id for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if t.buyer_id <> p_actor_id and t.seller_id <> p_actor_id then raise exception 'TRANSACTION_FORBIDDEN'; end if;
  if not public.is_valid_property_transaction_transition(t.status, p_to_status) then
    raise exception 'INVALID_TRANSACTION_TRANSITION:%->%', t.status, p_to_status;
  end if;

  update public.property_transactions
    set status = p_to_status, metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
    where id = p_transaction_id
    returning * into result;

  insert into public.property_transaction_events(transaction_id, from_status, to_status, actor_id, note, metadata)
  values (p_transaction_id, t.status, p_to_status, p_actor_id, p_note, coalesce(p_metadata, '{}'::jsonb));

  return result;
end;
$$;
