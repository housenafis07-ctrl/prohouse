begin;
create table if not exists public.realtor_admin_benefit_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 benefit_tier text not null check (benefit_tier in ('FREE','PRO','BUSINESS','CUSTOM')),
 listing_limit integer not null check (listing_limit between 1 and 5000),
 features jsonb not null default '{}'::jsonb,
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 note text,
 granted_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_at>starts_at)
);
create index if not exists realtor_admin_benefit_grants_active_idx
 on public.realtor_admin_benefit_grants(user_id,starts_at,ends_at desc)
 where revoked_at is null;
alter table public.realtor_admin_benefit_grants enable row level security;
revoke all on public.realtor_admin_benefit_grants from anon,authenticated;
grant select,insert,update,delete on public.realtor_admin_benefit_grants to service_role;

create or replace function public.enforce_realtor_subscription_listing_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_status text;
  v_limit integer := 10;
  v_used integer := 0;
  v_product_code text;
begin
  select verification_status into v_status
  from public.realtor_profiles where user_id=new.owner_id limit 1;
  if v_status is distinct from 'verified' then return new; end if;
  if new.status not in ('moderation','active','reserved') then return new; end if;

  select 'admin_'||benefit_tier, listing_limit into v_product_code,v_limit
  from public.realtor_admin_benefit_grants
  where user_id=new.owner_id and revoked_at is null
    and starts_at<=now() and ends_at>now()
  order by created_at desc limit 1;

  if v_limit is null then
    select e.product_code, greatest(coalesce((p.metadata->>'listing_limit')::integer,20),20)
      into v_product_code,v_limit
    from public.monetization_entitlements e
    join public.monetization_products p on p.code=e.product_code
    where e.user_id=new.owner_id and e.status='active'
      and p.product_type='subscription' and p.audience='realtor' and p.active=true
      and (e.ends_at is null or e.ends_at>now())
    order by e.ends_at desc nulls last,e.created_at desc limit 1;
  end if;
  v_limit := coalesce(v_limit,20);
  select count(*)::integer into v_used from public.listings l
  where l.owner_id=new.owner_id and l.status in ('moderation','active','reserved')
    and l.id is distinct from new.id;

  if v_used >= v_limit then
    raise exception 'REALTOR_LISTING_LIMIT_REACHED: Rieltor tarifidagi e’lon limiti tugagan (%).',v_limit
      using errcode='check_violation',
      detail=jsonb_build_object('product_code',coalesce(v_product_code,'realtor_free'),'listing_limit',v_limit,'used',v_used)::text;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_realtor_subscription_listing_limit() from public,anon,authenticated;
grant execute on function public.enforce_realtor_subscription_listing_limit() to service_role;
commit;
