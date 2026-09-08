-- Keep intermediate listing-wizard drafts outside the individual listing limit.
-- Enforce the 3-listing limit when a listing enters moderation/active/reserved.

create or replace function public.enforce_individual_free_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_type text;
  v_count integer;
begin
  select account_type into v_account_type
  from public.profiles
  where id = new.owner_id;

  if coalesce(v_account_type, 'individual') = 'individual' then
    new.seller_type := 'owner';

    if new.status in ('moderation','active','reserved') then
      select count(*) into v_count
      from public.listings
      where owner_id = new.owner_id
        and status in ('moderation','active','reserved')
        and id is distinct from new.id;

      if v_count >= 3 then
        raise exception 'LISTING_LIMIT_REACHED: Jismoniy shaxs uchun 3 ta bepul faol e’lon limiti tugagan.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.prepare_listing_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  account_type_value text;
  free_limit integer;
  used_free integer;
  fee numeric(18,2);
  paid_enabled boolean;
begin
  select p.account_type into account_type_value
  from public.profiles p
  where p.id = new.owner_id;

  -- Wizard drafts are not billable listings yet.
  if account_type_value = 'individual' and new.status <> 'draft' then
    select individual_free_listing_limit, individual_listing_fee_uzs, paid_listing_enabled
      into free_limit, fee, paid_enabled
    from public.listing_pricing_settings
    where id = 1;

    select count(*) into used_free
    from public.listings l
    where l.owner_id = new.owner_id
      and l.is_free_listing = true
      and l.status in ('draft','moderation','active','reserved','rejected')
      and l.id is distinct from new.id;

    if used_free < coalesce(free_limit, 3) then
      new.is_free_listing := true;
      new.billing_status := 'free';
      new.listing_fee_uzs := 0;
    elsif coalesce(new.billing_status, 'free') <> 'paid' then
      if coalesce(paid_enabled, false) then
        new.is_free_listing := false;
        new.billing_status := 'payment_required';
        new.listing_fee_uzs := coalesce(fee, 30000);
      else
        raise exception 'LISTING_LIMIT_REACHED: 3 ta bepul e’lon limitingiz tugagan.'
          using errcode = 'check_violation';
      end if;
    else
      new.is_free_listing := false;
      new.listing_fee_uzs := coalesce(fee, 30000);
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_individual_free_listing_limit on public.listings;
create trigger trg_individual_free_listing_limit
before insert or update of status on public.listings
for each row execute function public.enforce_individual_free_listing_limit();

drop trigger if exists listings_prepare_billing on public.listings;
create trigger listings_prepare_billing
before insert or update of status on public.listings
for each row execute function public.prepare_listing_billing();
