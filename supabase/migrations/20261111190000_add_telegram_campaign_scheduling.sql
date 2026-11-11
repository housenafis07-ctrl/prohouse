begin;

alter table public.telegram_broadcast_campaigns
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_timezone text not null default 'Asia/Tashkent';

-- Keep queued for scheduled work and add an explicit cancelled terminal state.
alter table public.telegram_broadcast_campaigns
  drop constraint if exists telegram_broadcast_campaigns_status_check;
alter table public.telegram_broadcast_campaigns
  add constraint telegram_broadcast_campaigns_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled'));

create index if not exists telegram_broadcast_campaigns_due_idx
  on public.telegram_broadcast_campaigns(scheduled_at, created_at)
  where status = 'queued' and scheduled_at is not null;

-- Atomically claim a small batch so overlapping cron invocations cannot
-- process the same scheduled campaign twice.
create or replace function public.claim_due_telegram_broadcast_campaigns(p_limit integer default 5)
returns setof public.telegram_broadcast_campaigns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id
    from public.telegram_broadcast_campaigns
    where status = 'queued'
      and scheduled_at is not null
      and scheduled_at <= clock_timestamp()
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 10))
  )
  update public.telegram_broadcast_campaigns c
  set status = 'sending'
  from due
  where c.id = due.id
  returning c.*;
end;
$$;

revoke all on function public.claim_due_telegram_broadcast_campaigns(integer) from public, anon, authenticated;
grant execute on function public.claim_due_telegram_broadcast_campaigns(integer) to service_role;


-- Supabase Cron is used instead of Vercel Cron because Vercel Hobby only
-- supports daily cron schedules. Store the deployment URL and the existing
-- Vercel CRON_SECRET in Supabase Vault under the names below.
create extension if not exists pg_net;

create or replace function public.dispatch_telegram_campaigns_cron()
returns void
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $function$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select decrypted_secret into dispatch_url
  from vault.decrypted_secrets
  where name = 'telegram_campaign_dispatch_url'
  limit 1;

  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets
  where name = 'telegram_campaign_cron_secret'
  limit 1;

  -- No network call is made until both Vault secrets are configured.
  if coalesce(dispatch_url, '') = '' or coalesce(dispatch_secret, '') = '' then
    raise log 'Telegram campaign cron is idle: Vault URL/secret is not configured';
    return;
  end if;

  perform net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || dispatch_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$function$;

revoke all on function public.dispatch_telegram_campaigns_cron() from public, anon, authenticated;

-- Re-running this migration does not create duplicate cron jobs.
do $block$
begin
  if not exists (select 1 from cron.job where jobname = 'telegram-marketing-campaign-dispatch') then
    perform cron.schedule(
      'telegram-marketing-campaign-dispatch',
      '* * * * *',
      'select public.dispatch_telegram_campaigns_cron();'
    );
  end if;
end;
$block$;

commit;
