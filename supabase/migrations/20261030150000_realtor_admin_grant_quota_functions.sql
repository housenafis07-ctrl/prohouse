create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_account_type text;
  v_realtor_status text;
  used_free_count integer;
  free_limit integer := 3;
  extra_remaining integer := 0;
  plan_code text := null;
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  select account_type into v_account_type from public.profiles where id=p_user_id;
  if coalesce(v_account_type,'') <> 'individual' then
    return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',false,'used',0,'free_limit',free_limit,'remaining',null);
  end if;

  select verification_status into v_realtor_status from public.realtor_profiles where user_id=p_user_id limit 1;
  if v_realtor_status='verified' then
    free_limit := 20;
    select 'admin_'||benefit_tier,listing_limit into plan_code,free_limit
    from public.realtor_admin_benefit_grants where user_id=p_user_id and revoked_at is null
      and starts_at<=now() and ends_at>now() order by created_at desc limit 1;
    if free_limit is null then
      select e.product_code,greatest(coalesce((mp.metadata->>'listing_limit')::integer,20),20)
        into plan_code,free_limit
      from public.monetization_entitlements e join public.monetization_products mp on mp.code=e.product_code
      where e.user_id=p_user_id and e.status='active' and mp.product_type='subscription'
        and mp.audience='realtor' and mp.active=true and (e.ends_at is null or e.ends_at>now())
      order by e.ends_at desc nulls last,e.created_at desc limit 1;
    end if;
    free_limit := coalesce(free_limit,20);
  else
    select individual_free_listing_limit into free_limit from public.listing_pricing_settings where id=1;
    free_limit := coalesce(free_limit,3);
  end if;

  select count(*)::integer into used_free_count from public.listings l
  where l.owner_id=p_user_id and l.status in ('moderation','active','reserved') and coalesce(l.is_free_listing,true)=true;

  select coalesce(sum(e.quantity_remaining),0)::integer into extra_remaining
  from public.monetization_entitlements e where e.user_id=p_user_id and e.product_code='extra_listing'
    and e.status='active' and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail=jsonb_build_object('used',used_free_count,'free_limit',free_limit,'remaining',0,'extra_listing_remaining',0,'product_code',plan_code)::text;
  end if;
  return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',true,'used',used_free_count,'free_limit',free_limit,'remaining',greatest(free_limit-used_free_count,0),'extra_listing_remaining',extra_remaining,'product_code',plan_code);
end;
$$;

revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated,service_role;
