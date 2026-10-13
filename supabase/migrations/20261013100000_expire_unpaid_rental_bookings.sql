begin;

-- Supabase-hosted Postgres supports pg_cron; run the expiry job independently
-- of site traffic so unpaid reservations are released after their 15-minute window.
create extension if not exists pg_cron with schema pg_catalog;

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
  update public.rental_bookings
  set
    status = 'cancelled',
    payment_status = 'cancelled',
    provider_payload =
      coalesce(provider_payload, '{}'::jsonb)
      || jsonb_build_object(
        'expired_at', expiry_time,
        'payme',
          coalesce(provider_payload -> 'payme', '{}'::jsonb)
          || jsonb_build_object(
            'cancel_time',
            coalesce(provider_payload #> '{payme,cancel_time}', to_jsonb(expiry_ms)),
            'state', -1
          )
      ),
    updated_at = expiry_time
  where status = 'pending_payment'
    and payment_status in ('pending', 'processing')
    and payment_expires_at is not null
    and payment_expires_at <= expiry_time;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_pending_rental_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_rental_bookings() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-pending-rental-bookings') then
    perform cron.unschedule('expire-pending-rental-bookings');
  end if;
  perform cron.schedule(
    'expire-pending-rental-bookings',
    '* * * * *',
    'select public.expire_pending_rental_bookings();'
  );
end;
$$;

commit;
