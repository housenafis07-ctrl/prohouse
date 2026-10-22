begin;

-- Partner plans are purchased through the same monetization order + Payme/Click
-- pipeline as TOP/UP/Highlight. Keep the plan benefits server-verifiable.
create or replace function public.get_active_partner_plan(p_user_id uuid default auth.uid())
returns table(
  product_code text,
  listing_limit integer,
  listing_limit_label text,
  analytics_level text,
  priority_moderation boolean,
  promo_tools boolean,
  priority_support boolean,
  employee_limit integer,
  company_profile boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.code,
    greatest(coalesce((p.metadata->>'listing_limit')::integer, 0), 0),
    coalesce(p.metadata->>'listing_limit_label', p.metadata->>'listing_limit'),
    coalesce(p.metadata->>'analytics', 'none'),
    coalesce((p.metadata->>'priority_moderation')::boolean, false),
    coalesce((p.metadata->>'promo_tools')::boolean, false),
    coalesce((p.metadata->>'priority_support')::boolean, false),
    greatest(coalesce((p.metadata->>'employees')::integer, 1), 1),
    p.code = 'partner_business'
  from public.monetization_entitlements e
  join public.monetization_products p on p.code = e.product_code
  where e.user_id = p_user_id
    and e.status = 'active'
    and p.product_type = 'subscription'
    and p.audience = 'partner'
    and p.active = true
    and (e.ends_at is null or e.ends_at > now())
  order by
    case p.code when 'partner_business' then 3 when 'partner_pro' then 2 when 'partner_start' then 1 else 0 end desc,
    e.ends_at desc nulls last,
    e.created_at desc
  limit 1;
$$;

revoke all on function public.get_active_partner_plan(uuid) from public;
grant execute on function public.get_active_partner_plan(uuid) to authenticated;

-- The purchased plan is the single source of truth for partner listing quota.
create or replace function public.enforce_partner_listing_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_type text;
  v_limit integer;
  v_used integer;
begin
  select p.account_type into v_account_type
  from public.profiles p
  where p.id = new.owner_id;

  if coalesce(v_account_type, '') <> 'partner' or new.status = 'draft' then
    return new;
  end if;

  select plan.listing_limit into v_limit
  from public.get_active_partner_plan(new.owner_id) plan;

  if coalesce(v_limit, 0) <= 0 then
    raise exception 'PARTNER_SUBSCRIPTION_REQUIRED: Hamkor uchun faol tarif kerak.'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer into v_used
  from public.listings l
  where l.owner_id = new.owner_id
    and l.status in ('moderation','active','reserved')
    and l.id is distinct from new.id;

  if v_used >= v_limit then
    raise exception 'PARTNER_LISTING_LIMIT_REACHED: Tarif limiti tugagan.'
      using errcode = 'check_violation',
            detail = jsonb_build_object('listing_limit', v_limit, 'used', v_used)::text;
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_partner_listing_plan() from public;
grant execute on function public.enforce_partner_listing_plan() to service_role;

drop trigger if exists trg_partner_listing_plan on public.listings;
create trigger trg_partner_listing_plan
before insert or update of status on public.listings
for each row execute function public.enforce_partner_listing_plan();

commit;
