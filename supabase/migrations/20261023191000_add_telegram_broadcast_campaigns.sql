begin;

create table if not exists public.telegram_broadcast_campaigns (
  id bigint generated always as identity primary key,
  title text not null,
  message text not null,
  audience text not null,
  button_text text,
  button_url text,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_broadcast_campaigns_created_idx
  on public.telegram_broadcast_campaigns(created_at desc);

alter table public.telegram_broadcast_campaigns enable row level security;
revoke all on public.telegram_broadcast_campaigns from anon, authenticated;
grant all on public.telegram_broadcast_campaigns to service_role;

commit;
