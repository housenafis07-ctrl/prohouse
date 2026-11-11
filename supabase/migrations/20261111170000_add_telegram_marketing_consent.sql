begin;

alter table public.telegram_bot_users
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text,
  add column if not exists marketing_topics text[] not null default array[]::text[],
  add column if not exists preferred_city text,
  add column if not exists preferred_district text;

alter table public.telegram_bot_users
  drop constraint if exists telegram_bot_users_marketing_consent_source_check;
alter table public.telegram_bot_users
  add constraint telegram_bot_users_marketing_consent_source_check
  check (marketing_consent_source is null or marketing_consent_source in ('telegram_command','telegram_settings','admin_import'));

create index if not exists telegram_bot_users_marketing_opt_in_idx
  on public.telegram_bot_users(is_active, marketing_opt_in, last_interaction_at desc);

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
    and u.marketing_opt_in = true
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
   and u.marketing_opt_in = true
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

commit;
