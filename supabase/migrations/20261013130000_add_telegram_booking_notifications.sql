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

-- Queue notifications atomically when an unpaid reservation expires.
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
  expired_booking record;
begin
  for expired_booking in
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
      and coalesce(payment_expires_at, created_at + interval '15 minutes') <= expiry_time
    returning id, listing_id, guest_id, check_in, check_out, deposit_amount, total_amount
  loop
    insert into public.telegram_notification_queue(profile_id, event_type, message)
    select expired_booking.guest_id, 'booking_expired',
      format('Royalhouse: %s–%s sanalariga dacha broningiz 15 daqiqada to‘lov qilinmagani uchun bekor qilindi. Yangi bron yaratishingiz mumkin.',
        expired_booking.check_in, expired_booking.check_out)
    where exists (select 1 from public.telegram_user_links l where l.profile_id = expired_booking.guest_id);

    insert into public.telegram_notification_queue(profile_id, event_type, message)
    select l.owner_id, 'booking_expired',
      format('Royalhouse: %s–%s sanalariga kelgan, to‘lov qilinmagan dacha broni 15 daqiqadan so‘ng bekor qilindi. Sanalar bo‘shatildi.',
        expired_booking.check_in, expired_booking.check_out)
    from public.listings l
    where l.id = expired_booking.listing_id
      and exists (select 1 from public.telegram_user_links t where t.profile_id = l.owner_id);
  end loop;

  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.expire_pending_rental_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_rental_bookings() to service_role;

commit;
