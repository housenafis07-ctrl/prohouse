-- Fix individual listing enforcement and persist seller ownership type.
-- The RPC is intentionally SECURITY DEFINER so the limit cannot be bypassed by the client.

alter table public.listings
  add column if not exists ownership_type text;

alter table public.listings
  drop constraint if exists listings_ownership_type_check;

alter table public.listings
  add constraint listings_ownership_type_check
  check (ownership_type is null or ownership_type in ('owner','power_of_attorney','representative'));

create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_type text;
  used_count integer;
  free_limit constant integer := 3;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select account_type into account_type
  from public.profiles
  where id = p_user_id;

  if account_type is distinct from 'individual' then
    return jsonb_build_object('allowed', true, 'is_individual', false, 'used', 0, 'limit', free_limit, 'remaining', null);
  end if;

  select count(*)::integer into used_count
  from public.listings
  where owner_id = p_user_id
    and coalesce(status, 'draft') not in ('deleted', 'expired', 'archived');

  if used_count >= free_limit then
    raise exception 'LISTING_LIMIT_REACHED';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'is_individual', true,
    'used', used_count,
    'limit', free_limit,
    'remaining', free_limit - used_count
  );
end;
$$;

revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated;
