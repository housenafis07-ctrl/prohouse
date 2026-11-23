create table if not exists public.mortgage_leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid null references public.listings(id) on delete set null,
  market text not null check (market in ('primary','secondary')),
  program_id text not null,
  bank_name text not null,
  program_name text not null,
  customer_name text not null,
  customer_phone text not null,
  property_price numeric not null check (property_price > 0),
  down_payment numeric not null default 0 check (down_payment >= 0),
  down_payment_percent numeric not null default 0 check (down_payment_percent >= 0 and down_payment_percent <= 100),
  term_months integer not null check (term_months > 0),
  annual_rate numeric not null check (annual_rate >= 0),
  monthly_payment numeric null,
  status text not null default 'new' check (status in ('new','contacted','approved','rejected','closed')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mortgage_leads_listing_idx on public.mortgage_leads(listing_id);
create index if not exists mortgage_leads_status_idx on public.mortgage_leads(status);
create index if not exists mortgage_leads_created_idx on public.mortgage_leads(created_at desc);

alter table public.mortgage_leads enable row level security;
