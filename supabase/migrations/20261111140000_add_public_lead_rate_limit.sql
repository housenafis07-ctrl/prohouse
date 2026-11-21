-- Atomic server-side rate limiting for public developer lead submissions.
create table if not exists public.public_api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.public_api_rate_limits enable row level security;
revoke all on public.public_api_rate_limits from public, anon, authenticated;
grant all on public.public_api_rate_limits to service_role;

create or replace function public.consume_public_api_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 32 or length(p_bucket_key) > 128
     or p_max_requests < 1 or p_max_requests > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT_ARGUMENTS' using errcode = '22023';
  end if;

  delete from public.public_api_rate_limits
  where updated_at < now() - interval '2 days';

  insert into public.public_api_rate_limits(bucket_key, window_started_at, request_count, updated_at)
  values (p_bucket_key, now(), 1, now())
  on conflict (bucket_key) do update
  set window_started_at = case
        when public.public_api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now() else public.public_api_rate_limits.window_started_at end,
      request_count = case
        when public.public_api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1 else public.public_api_rate_limits.request_count + 1 end,
      updated_at = now()
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_public_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_api_rate_limit(text, integer, integer) to service_role;
