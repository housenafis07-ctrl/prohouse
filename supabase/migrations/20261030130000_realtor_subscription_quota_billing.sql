-- Ensure paid realtor subscriptions are not capped by the legacy 20/50 realtor defaults.
create or replace function public.enforce_individual_free_listing_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_limit integer := 3;
  v_count integer;
  v_extra_remaining integer;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' then return new; end if;
  select verification_status into v_realtor_status from public.realtor_profiles where user_id=new.owner_id limit 1;
  -- A dedicated trigger applies the correct FREE/PRO/BUSINESS limit for verified realtors.
  if v_realtor_status='verified' then return new; end if;

  select individual_free_listing_limit into v_limit from public.listing_pricing_settings where id=1;
  v_limit := coalesce(v_limit,3);
  new.seller_type := 'owner';
  if coalesce(new.is_free_listing,true)=false or coalesce(new.billing_status,'') in ('paid','payment_required') then return new; end if;
  if new.status in ('moderation','active','reserved') then
    select count(*)::integer into v_count from public.listings
    where owner_id=new.owner_id and status in ('moderation','active','reserved')
      and coalesce(is_free_listing,true)=true and id is distinct from new.id;
    if v_count>=v_limit then
      select coalesce(sum(e.quantity_remaining),0)::integer into v_extra_remaining
      from public.monetization_entitlements e where e.user_id=new.owner_id and e.product_code='extra_listing'
        and e.status='active' and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now());
      if v_extra_remaining<=0 then raise exception 'LISTING_LIMIT_REACHED' using errcode='check_violation'; end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_listing_billing()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_account_type text;
  v_realtor_status text;
  v_free_limit integer;
  v_used_free integer;
  v_fee numeric(18,2);
  v_paid_enabled boolean;
  v_extra_entitlement_id uuid;
begin
  select account_type into v_account_type from public.profiles where id=new.owner_id;
  if coalesce(v_account_type,'individual') <> 'individual' or new.status='draft' then return new; end if;
  select verification_status into v_realtor_status from public.realtor_profiles where user_id=new.owner_id limit 1;

  if v_realtor_status='verified' then
    v_free_limit:=20;
    select greatest(coalesce((mp.metadata->>'listing_limit')::integer,20),20) into v_free_limit
    from public.monetization_entitlements e join public.monetization_products mp on mp.code=e.product_code
    where e.user_id=new.owner_id and e.status='active' and mp.product_type='subscription'
      and mp.audience='realtor' and mp.active=true and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
    v_free_limit:=coalesce(v_free_limit,20);
  else
    select individual_free_listing_limit,individual_listing_fee_uzs,paid_listing_enabled
      into v_free_limit,v_fee,v_paid_enabled from public.listing_pricing_settings where id=1;
    v_free_limit:=coalesce(v_free_limit,3);
  end if;

  if coalesce(new.billing_status,'')='paid' then new.is_free_listing:=false; new.listing_fee_uzs:=0; return new; end if;
  select count(*)::integer into v_used_free from public.listings l
  where l.owner_id=new.owner_id and l.status in ('moderation','active','reserved')
    and coalesce(l.is_free_listing,true)=true and l.id is distinct from new.id;
  if v_used_free<coalesce(v_free_limit,3) then
    new.is_free_listing:=true; new.billing_status:='free'; new.listing_fee_uzs:=0; return new;
  end if;

  select e.id into v_extra_entitlement_id from public.monetization_entitlements e
  where e.user_id=new.owner_id and e.product_code='extra_listing' and e.status='active'
    and e.quantity_remaining>0 and (e.ends_at is null or e.ends_at>now())
  order by e.created_at asc limit 1 for update;
  if v_extra_entitlement_id is not null then
    update public.monetization_entitlements set quantity_remaining=quantity_remaining-1,
      status=case when quantity_remaining-1<=0 then 'consumed' else 'active' end,
      consumed_at=now(),listing_id=new.id,updated_at=now()
    where id=v_extra_entitlement_id and quantity_remaining>0;
    if not found then raise exception 'EXTRA_LISTING_CONSUME_FAILED' using errcode='P0001'; end if;
    new.is_free_listing:=false; new.billing_status:='paid'; new.listing_fee_uzs:=0; return new;
  end if;

  if coalesce(v_paid_enabled,false) then
    new.is_free_listing:=false; new.billing_status:='payment_required'; new.listing_fee_uzs:=coalesce(v_fee,30000); return new;
  end if;
  raise exception 'LISTING_LIMIT_REACHED: Bepul e’lon limiti tugagan.' using errcode='check_violation';
end;
$$;
