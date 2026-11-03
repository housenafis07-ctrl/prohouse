begin;

alter table public.telegram_notification_queue
  add column if not exists locked_until timestamptz;

create index if not exists telegram_notification_queue_claim_idx
  on public.telegram_notification_queue(locked_until, created_at)
  where sent_at is null;

-- Atomically lease pending rows so concurrent API requests/workers cannot
-- deliver the same queue row at the same time. Expired leases are reclaimable.
create or replace function public.claim_telegram_notification_queue(p_limit integer default 50)
returns table (
  id bigint,
  profile_id uuid,
  message text,
  attempts integer
)
language sql
set search_path = public, pg_temp
as $$
  with candidates as (
    select q.id
    from public.telegram_notification_queue q
    where q.sent_at is null
      and q.attempts < 8
      and (q.locked_until is null or q.locked_until < now())
    order by q.created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  ),
  claimed as (
    update public.telegram_notification_queue q
    set locked_until = now() + interval '2 minutes'
    from candidates c
    where q.id = c.id
    returning q.id, q.profile_id, q.message, q.attempts
  )
  select claimed.id, claimed.profile_id, claimed.message, claimed.attempts
  from claimed
  order by claimed.id asc;
$$;

revoke all on function public.claim_telegram_notification_queue(integer) from public, anon, authenticated;
grant execute on function public.claim_telegram_notification_queue(integer) to service_role;

commit;
