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

commit;
