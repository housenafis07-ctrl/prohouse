begin;

alter table public.telegram_broadcast_campaigns
  add column if not exists destination text not null default 'bot',
  add column if not exists recipient_count integer not null default 0,
  add column if not exists delivered_count integer not null default 0,
  add column if not exists channel_chat_id text,
  add constraint telegram_broadcast_campaigns_destination_check
    check (destination in ('bot','channel'));

create index if not exists telegram_broadcast_campaigns_destination_created_idx
  on public.telegram_broadcast_campaigns(destination, created_at desc);

commit;
