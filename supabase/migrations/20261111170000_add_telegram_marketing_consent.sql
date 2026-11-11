begin;

-- Marketing eligibility is derived from the user's recorded acceptance of the
-- current public offer. Existing consent rows are not backfilled: old users
-- must accept the updated offer before becoming eligible.
alter table public.offer_consents
  add column if not exists marketing_consent boolean not null default false;

alter table public.telegram_bot_users
  add column if not exists marketing_topics text[] not null default array[]::text[],
  add column if not exists preferred_city text,
  add column if not exists preferred_district text;

create index if not exists offer_consents_marketing_user_idx
  on public.offer_consents(user_id, offer_version)
  where marketing_consent = true;

create index if not exists telegram_bot_users_marketing_audience_idx
  on public.telegram_bot_users(is_active, last_interaction_at desc);

create or replace function public.get_telegram_broadcast_recipients(p_audience text)
returns table(telegram_id text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct u.telegram_user_id
  from public.telegram_bot_users u
  left join public.profiles p on p.id = u.profile_id
  where u.is_active = true
    and u.profile_id is not null
    and exists (
      select 1 from public.offer_consents oc
      where oc.user_id = u.profile_id
        and oc.marketing_consent = true
    )
    and case p_audience
      when 'all' then true
      when 'buyers' then exists (select 1 from public.listing_leads ll where ll.visitor_id = u.profile_id)
      when 'listings' then exists (select 1 from public.listings l where l.owner_id = u.profile_id and l.status <> 'draft')
      when 'realtors' then (
        coalesce(p.partner_type, '') = 'realtor'
        or exists (select 1 from public.partner_profiles pp where pp.user_id = u.profile_id and pp.partner_type = 'realtor')
      )
      when 'trusted' then (
        exists (select 1 from public.partner_profiles pp where pp.user_id = u.profile_id and pp.trusted_partner_status = 'verified')
        or exists (select 1 from public.listings l where l.owner_id = u.profile_id and l.is_trusted_seller = true)
      )
      else false
    end
  order by u.telegram_user_id;
$$;

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
   and u.profile_id is not null
   and exists (
     select 1 from public.offer_consents oc
     where oc.user_id = u.profile_id
       and oc.marketing_consent = true
   )
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

revoke all on function public.get_telegram_broadcast_recipients(text) from public, anon, authenticated;
grant execute on function public.get_telegram_broadcast_recipients(text) to service_role;
revoke all on function public.get_telegram_broadcast_audience_counts() from public, anon, authenticated;
grant execute on function public.get_telegram_broadcast_audience_counts() to service_role;

create or replace function public.get_telegram_marketing_eligible_count()
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $
  select count(distinct u.telegram_user_id)::bigint
  from public.telegram_bot_users u
  where u.is_active = true
    and u.profile_id is not null
    and exists (
      select 1 from public.offer_consents oc
      where oc.user_id = u.profile_id
        and oc.marketing_consent = true
    );
$;

revoke all on function public.get_telegram_marketing_eligible_count() from public, anon, authenticated;
grant execute on function public.get_telegram_marketing_eligible_count() to service_role;

commit;
