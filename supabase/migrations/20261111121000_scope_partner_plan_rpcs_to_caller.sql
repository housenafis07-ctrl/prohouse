begin;

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
stable
security definer
set search_path = public, pg_temp
as $$
  select p.code,
    greatest(coalesce((p.metadata->>'listing_limit')::integer, 0), 0),
    coalesce(p.metadata->>'listing_limit_label', p.metadata->>'listing_limit'),
    coalesce(p.metadata->>'analytics', 'none'),
    coalesce((p.metadata->>'priority_moderation')::boolean, false),
    coalesce((p.metadata->>'promo_tools')::boolean, false),
    coalesce((p.metadata->>'priority_support')::boolean, false),
    greatest(coalesce((p.metadata->>'employees')::integer, 1), 1),
    true
  from public.monetization_entitlements e
  join public.monetization_products p on p.code = e.product_code
  where e.user_id = p_user_id
    and (coalesce(auth.role(), '') = 'service_role' or auth.uid() = p_user_id)
    and e.status = 'active'
    and p.product_type = 'subscription'
    and p.audience = 'partner'
    and p.active = true
    and (e.ends_at is null or e.ends_at > now())
  order by case p.code
    when 'partner_business' then 3
    when 'partner_pro' then 2
    when 'partner_start' then 1
    else 0
  end desc, e.ends_at desc nulls last, e.created_at desc
  limit 1;
$$;

create or replace function public.partner_plan_has_feature(p_user_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not (coalesce(auth.role(), '') = 'service_role' or auth.uid() = p_user_id) then false
    else case p_feature
      when 'advanced_analytics' then coalesce((select analytics_level = 'advanced' from public.get_active_partner_plan(p_user_id)), false)
      when 'priority_moderation' then coalesce((select priority_moderation from public.get_active_partner_plan(p_user_id)), false)
      when 'promo_tools' then coalesce((select promo_tools from public.get_active_partner_plan(p_user_id)), false)
      when 'priority_support' then coalesce((select priority_support from public.get_active_partner_plan(p_user_id)), false)
      when 'company_profile' then coalesce((select company_profile from public.get_active_partner_plan(p_user_id)), false)
      else false
    end
  end;
$$;

revoke all on function public.get_active_partner_plan(uuid) from public, anon;
revoke all on function public.partner_plan_has_feature(uuid, text) from public, anon;
grant execute on function public.get_active_partner_plan(uuid) to authenticated, service_role;
grant execute on function public.partner_plan_has_feature(uuid, text) to authenticated, service_role;

commit;
