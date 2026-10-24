begin;

create or replace function public.get_telegram_broadcast_audience_counts()
returns table(audience text, count bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  with audiences(audience, sort_order) as (
    values ('all', 1), ('buyers', 2), ('listings', 3), ('realtors', 4), ('trusted', 5)
  )
  select a.audience, count(distinct u.telegram_user_id)::bigint
  from audiences a
  left join public.telegram_bot_users u
    on u.is_active = true
   and case a.audience
      when 'all' then true
      when 'buyers' then exists (select 1 from public.listing_leads ll where ll.visitor_id = u.profile_id)
      when 'listings' then exists (select 1 from public.listings l where l.owner_id = u.profile_id and l.status <> 'draft')
      when 'realtors' then (
        exists (select 1 from public.profiles p where p.id = u.profile_id and coalesce(p.partner_type, '') = 'realtor')
        or exists (select 1 from public.partner_profiles pp where pp.user_id = u.profile_id and pp.partner_type = 'realtor')
      )
      when 'trusted' then (
        exists (select 1 from public.partner_profiles pp where pp.user_id = u.profile_id and pp.trusted_partner_status = 'verified')
        or exists (select 1 from public.listings l where l.owner_id = u.profile_id and l.is_trusted_seller = true)
      )
      else false
    end
  group by a.audience, a.sort_order
  order by a.sort_order;
$$;

revoke all on function public.get_telegram_broadcast_audience_counts() from public, anon, authenticated;
grant execute on function public.get_telegram_broadcast_audience_counts() to service_role;

commit;
