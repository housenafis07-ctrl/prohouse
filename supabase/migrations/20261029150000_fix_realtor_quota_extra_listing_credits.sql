-- Preserve one-time extra-listing entitlements while supporting verified realtor quotas.
create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_agency_name text;
  used_free_count integer;
  free_limit integer := 3;
  extra_remaining integer := 0;
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  select account_type into v_account_type from public.profiles where id=p_user_id;
  if coalesce(v_account_type,'') <> 'individual' then
    return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',false,'used',0,'free_limit',free_limit,'remaining',null);
  end if;

  select verification_status, agency_name into v_realtor_status, v_agency_name
  from public.realtor_profiles where user_id=p_user_id limit 1;
  if v_realtor_status='verified' then
    free_limit := case when nullif(btrim(v_agency_name),'') is not null then 50 else 20 end;
  else
    select individual_free_listing_limit into free_limit from public.listing_pricing_settings where id=1;
    free_limit := coalesce(free_limit,3);
  end if;

  select count(*)::integer into used_free_count
  from public.listings l
  where l.owner_id=p_user_id
    and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing,true)=true;

  select coalesce(sum(e.quantity_remaining),0)::integer into extra_remaining
  from public.monetization_entitlements e
  where e.user_id=p_user_id and e.product_code='extra_listing'
    and e.status='active' and e.quantity_remaining>0
    and (e.ends_at is null or e.ends_at>now());

  if used_free_count >= free_limit and extra_remaining <= 0 then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail=jsonb_build_object('used',used_free_count,'free_limit',free_limit,'remaining',0,'extra_listing_remaining',0)::text;
  end if;
  return jsonb_build_object('allowed',true,'account_type',v_account_type,'is_individual',true,'used',used_free_count,'free_limit',free_limit,'remaining',greatest(free_limit-used_free_count,0),'extra_listing_remaining',extra_remaining);
end;
$$;
revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated, service_role;

create or replace function public.enforce_individual_free_listing_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_agency_name text;
  v_limit integer := 3;
  v_count integer;
  v_extra_remaining integer;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' then return new; end if;

  select verification_status, agency_name into v_realtor_status, v_agency_name
  from public.realtor_profiles where user_id=new.owner_id limit 1;
  if v_realtor_status='verified' then
    v_limit := case when nullif(btrim(v_agency_name),'') is not null then 50 else 20 end;
    new.seller_type := 'realtor';
  else
    select individual_free_listing_limit into v_limit from public.listing_pricing_settings where id=1;
    v_limit := coalesce(v_limit,3);
    new.seller_type := 'owner';
  end if;

  -- Paid extra-listing entitlements and payment-required listings do not consume free quota.
  if coalesce(new.is_free_listing,true) = false or coalesce(new.billing_status,'') in ('paid','payment_required') then
    return new;
  end if;

  if new.status in ('moderation','active','reserved') then
    select count(*)::integer into v_count from public.listings
    where owner_id=new.owner_id and status in ('moderation','active','reserved')
      and coalesce(is_free_listing,true)=true and id is distinct from new.id;
    if v_count >= v_limit then
      select coalesce(sum(e.quantity_remaining),0)::integer into v_extra_remaining
      from public.monetization_entitlements e
      where e.user_id=new.owner_id and e.product_code='extra_listing'
        and e.status='active' and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now());
      if v_extra_remaining <= 0 then
        raise exception 'LISTING_LIMIT_REACHED: Bepul faol e’lon limiti tugagan (%).',v_limit using errcode='check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_agency_name text;
  v_free_limit integer;
  v_used_free integer;
  v_fee numeric(18,2);
  v_paid_enabled boolean;
  v_extra_entitlement_id uuid;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' or new.status='draft' then return new; end if;

  select verification_status, agency_name into v_realtor_status, v_agency_name
  from public.realtor_profiles where user_id=new.owner_id limit 1;
  if v_realtor_status='verified' then
    v_free_limit := case when nullif(btrim(v_agency_name),'') is not null then 50 else 20 end;
  else
    select individual_free_listing_limit, individual_listing_fee_uzs, paid_listing_enabled
      into v_free_limit,v_fee,v_paid_enabled from public.listing_pricing_settings where id=1;
    v_free_limit := coalesce(v_free_limit,3);
  end if;

  if coalesce(new.billing_status,'')='paid' then
    new.is_free_listing:=false;
    new.listing_fee_uzs:=0;
    return new;
  end if;

  select count(*)::integer into v_used_free from public.listings l
  where l.owner_id=new.owner_id and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing,true)=true and l.id is distinct from new.id;

  if v_used_free < coalesce(v_free_limit,3) then
    new.is_free_listing:=true;
    new.billing_status:='free';
    new.listing_fee_uzs:=0;
    return new;
  end if;

  -- Consume one existing extra-listing credit only when submitting beyond the free quota.
  select e.id into v_extra_entitlement_id
  from public.monetization_entitlements e
  where e.user_id=new.owner_id and e.product_code='extra_listing'
    and e.status='active' and e.quantity_remaining>0
    and (e.ends_at is null or e.ends_at>now())
  order by e.created_at asc
  limit 1 for update;

  if v_extra_entitlement_id is not null then
    update public.monetization_entitlements
    set quantity_remaining=quantity_remaining-1,
        status=case when quantity_remaining-1<=0 then 'consumed' else 'active' end,
        consumed_at=now(), listing_id=new.id, updated_at=now()
    where id=v_extra_entitlement_id and quantity_remaining>0;
    if not found then raise exception 'EXTRA_LISTING_CONSUME_FAILED' using errcode='P0001'; end if;
    new.is_free_listing:=false;
    new.billing_status:='paid';
    new.listing_fee_uzs:=0;
    return new;
  end if;

  if coalesce(v_paid_enabled,false) then
    new.is_free_listing:=false;
    new.billing_status:='payment_required';
    new.listing_fee_uzs:=coalesce(v_fee,30000);
    return new;
  end if;

  raise exception 'LISTING_LIMIT_REACHED: Bepul e’lon limiti tugagan.' using errcode='check_violation';
end;
$$;

-- Triggers run alphabetically; keep the guard aware of the billing decision above.
drop trigger if exists trg_individual_free_listing_limit on public.listings;
create trigger trg_individual_free_listing_limit
before insert or update of status on public.listings
for each row execute function public.enforce_individual_free_listing_limit();

drop trigger if exists listings_prepare_billing on public.listings;
create trigger listings_prepare_billing
before insert or update of status on public.listings
for each row execute function public.prepare_listing_billing();
