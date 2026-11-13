begin;

create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_agency_name text;
  used_free_count integer;
  free_limit integer := 3;
  extra_remaining integer := 0;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  -- The caller may inspect only their own quota. Trusted server-side
  -- operations using the service role may inspect another account.
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select account_type into v_account_type
  from public.profiles where id = p_user_id;

  if coalesce(v_account_type, '') <> 'individual' then
    return jsonb_build_object(
      'allowed', true, 'account_type', v_account_type,
      'is_individual', false, 'used', 0,
      'free_limit', free_limit, 'remaining', null
    );
  end if;

  select verification_status, agency_name
    into v_realtor_status, v_agency_name
  from public.realtor_profiles
  where user_id = p_user_id
  limit 1;

  if v_realtor_status = 'verified' then
    free_limit := case when nullif(btrim(v_agency_name), '') is not null then 50 else 20 end;
  else
    select individual_free_listing_limit into free_limit
    from public.listing_pricing_settings where id = 1;
    free_limit := coalesce(free_limit, 3);
  end if;

  select count(*)::integer into used_free_count
  from public.listings l
  where l.owner_id = p_user_id
    and l.status in ('moderation', 'active', 'reserved')
    and coalesce(l.is_free_listing, true) = true;

  select coalesce(sum(e.quantity_remaining), 0)::integer into extra_remaining
  from public.monetization_entitlements e
  where e.user_id = p_user_id
    and e.product_code = 'extra_listing'
    and e.status = 'active'
    and e.quantity_remaining > 0
    and (e.ends_at is null or e.ends_at > now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail = jsonb_build_object(
        'used', used_free_count,
        'free_limit', free_limit,
        'remaining', 0,
        'extra_listing_remaining', 0
      )::text;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'account_type', v_account_type,
    'is_individual', true,
    'used', used_free_count,
    'free_limit', free_limit,
    'remaining', greatest(free_limit - used_free_count, 0),
    'extra_listing_remaining', extra_remaining
  );
end;
$$;

revoke all on function public.assert_individual_listing_limit(uuid) from public;
revoke all on function public.assert_individual_listing_limit(uuid) from anon;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated, service_role;

commit;
