create table if not exists public.telegram_bot_users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null unique,
  username text,
  first_name text,
  language_code text,
  is_active boolean not null default true,
  started_bot_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_bot_users_active_idx on public.telegram_bot_users (is_active);

create table if not exists public.telegram_broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  button_text text,
  button_url text,
  audience text not null default 'all' check (audience in ('all','listings','realtors','trusted')),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.telegram_broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.telegram_broadcast_campaigns(id) on delete cascade,
  telegram_id text not null,
  status text not null default 'failed',
  created_at timestamptz not null default now()
);

create index if not exists telegram_broadcast_deliveries_campaign_idx on public.telegram_broadcast_deliveries (campaign_id);

create or replace function public.get_telegram_broadcast_recipients(p_audience text)
returns table (telegram_id text)
language sql
security definer
set search_path = public
as $$
  select distinct u.telegram_id
  from public.telegram_bot_users u
  where u.is_active = true
    and (
      p_audience = 'all'
      or (p_audience = 'listings' and exists (select 1 from public.listings l where (l.owner_id::text = u.telegram_id or l.partner_auth_id::text = u.telegram_id)))
      or (p_audience = 'realtors' and exists (select 1 from public.listings l where l.seller_type = 'realtor' and (l.owner_id::text = u.telegram_id or l.partner_auth_id::text = u.telegram_id)))
      or (p_audience = 'trusted' and exists (select 1 from public.listings l where l.is_trusted_seller = true and (l.owner_id::text = u.telegram_id or l.partner_auth_id::text = u.telegram_id)))
    );
$$;

alter table public.telegram_bot_users enable row level security;
alter table public.telegram_broadcast_campaigns enable row level security;
alter table public.telegram_broadcast_deliveries enable row level security;
