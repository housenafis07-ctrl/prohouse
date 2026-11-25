begin;

create table if not exists public.saved_search_alert_deliveries (
  id bigint generated always as identity primary key,
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  listing_title text not null,
  listing_url text not null,
  push_sent_at timestamptz,
  telegram_queued_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique(saved_search_id, listing_id)
);

create index if not exists saved_search_alert_deliveries_pending_idx
  on public.saved_search_alert_deliveries(created_at)
  where push_sent_at is null or telegram_queued_at is null;

alter table public.saved_search_alert_deliveries enable row level security;
revoke all on public.saved_search_alert_deliveries from anon, authenticated;
grant all on public.saved_search_alert_deliveries to service_role;

commit;
