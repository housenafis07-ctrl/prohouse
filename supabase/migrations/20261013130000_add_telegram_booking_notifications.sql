begin;

create table if not exists public.telegram_user_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_user_id text not null unique,
  chat_id text not null,
  telegram_username text,
  linked_at timestamptz not null default now()
);
alter table public.telegram_user_links enable row level security;
revoke all on public.telegram_user_links from anon, authenticated;
grant all on public.telegram_user_links to service_role;

create table if not exists public.telegram_link_tokens (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_link_tokens from anon, authenticated;
grant all on public.telegram_link_tokens to service_role;

create table if not exists public.telegram_notification_queue (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists telegram_notification_queue_pending_idx
  on public.telegram_notification_queue(created_at) where sent_at is null;
alter table public.telegram_notification_queue enable row level security;
revoke all on public.telegram_notification_queue from anon, authenticated;
grant all on public.telegram_notification_queue to service_role;

-- Expire unpaid reservations without sending Telegram notifications.
create or replace function public.expire_pending_rental_bookings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
  expiry_time timestamptz := clock_timestamp();
  expiry_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  affected := 0;
  update public.rental_bookings
  set
    status = 'cancelled',
    payment_status = 'cancelled',
    provider_payload = coalesce(provider_payload, '{}'::jsonb)
      || jsonb_build_object(
        'expired_at', expiry_time,
        'payme', coalesce(provider_payload -> 'payme', '{}'::jsonb)
          || jsonb_build_object(
            'cancel_time', coalesce(provider_payload #> '{payme,cancel_time}', to_jsonb(expiry_ms)),
            'state', -1
          )
      ),
    updated_at = expiry_time
  where status = 'pending_payment'
    and payment_status in ('pending', 'processing')
    and coalesce(payment_expires_at, created_at + interval '15 minutes') <= expiry_time;

  get diagnostics affected = row_count;

  return affected;
end;
$$;
revoke all on function public.expire_pending_rental_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_rental_bookings() to service_role;

commit;
