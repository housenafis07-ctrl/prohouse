begin;

create table if not exists public.telegram_bot_users (
  telegram_user_id text primary key,
  chat_id text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_bot_users_profile_idx on public.telegram_bot_users(profile_id);
create index if not exists telegram_bot_users_active_idx on public.telegram_bot_users(is_active, last_interaction_at desc);

alter table public.telegram_bot_users enable row level security;
revoke all on public.telegram_bot_users from anon, authenticated;
grant all on public.telegram_bot_users to service_role;

create table if not exists public.telegram_broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  button_text text,
  button_url text,
  audience text not null check (audience in ('all','buyers','listings','realtors','trusted')),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.telegram_broadcast_campaigns enable row level security;
revoke all on public.telegram_broadcast_campaigns from anon, authenticated;
grant all on public.telegram_broadcast_campaigns to service_role;

create table if not exists public.telegram_broadcast_deliveries (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.telegram_broadcast_campaigns(id) on delete cascade,
  telegram_id text not null,
  status text not null check (status in ('sent','failed')),
  telegram_message_id bigint,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists telegram_broadcast_deliveries_campaign_idx on public.telegram_broadcast_deliveries(campaign_id, status);
alter table public.telegram_broadcast_deliveries enable row level security;
revoke all on public.telegram_broadcast_deliveries from anon, authenticated;
grant all on public.telegram_broadcast_deliveries to service_role;

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
    and case p_audience
      when 'all' then true
      when 'buyers' then exists (
        select 1 from public.listing_leads ll where ll.visitor_id = u.profile_id
      )
      when 'listings' then exists (
        select 1 from public.listings l where l.owner_id = u.profile_id and l.status <> 'draft'
      )
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
  select a.audience, count(distinct u.telegram_user_id)
  from unnest(array['all','buyers','listings','realtors','trusted']::text[]) as a(audience)
  left join public.telegram_bot_users u on u.is_active = true
  left join public.profiles p on p.id = u.profile_id
  where case a.audience
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
  group by a.audience
  order by case a.audience when 'all' then 1 when 'buyers' then 2 when 'listings' then 3 when 'realtors' then 4 when 'trusted' then 5 else 99 end;
$$;

revoke all on function public.get_telegram_broadcast_recipients(text) from public, anon, authenticated;
grant execute on function public.get_telegram_broadcast_recipients(text) to service_role;
revoke all on function public.get_telegram_broadcast_audience_counts() from public, anon, authenticated;
grant execute on function public.get_telegram_broadcast_audience_counts() to service_role;

commit;
