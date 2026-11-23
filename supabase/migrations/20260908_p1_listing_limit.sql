-- P1.1: server-side individual free-listing limit.
create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare account_type text; used_count integer; free_limit integer := 3;
begin
  select p.account_type into account_type from public.profiles p where p.id = p_user_id;
  if coalesce(account_type, '') <> 'individual' then
    return jsonb_build_object('allowed', true, 'account_type', account_type, 'used', 0, 'free_limit', free_limit, 'remaining', free_limit);
  end if;
  select count(*)::integer into used_count from public.listings l where l.owner_id = p_user_id and l.status in ('active','moderation');
  if used_count >= free_limit then
    raise exception 'LISTING_LIMIT_REACHED' using detail = jsonb_build_object('used',used_count,'free_limit',free_limit,'remaining',0)::text;
  end if;
  return jsonb_build_object('allowed',true,'account_type',account_type,'used',used_count,'free_limit',free_limit,'remaining',free_limit-used_count);
end;
$$;
revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated;
