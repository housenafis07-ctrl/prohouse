begin;

create or replace function public.sync_trusted_listing_flags(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_trusted boolean := false;
begin
  select (
    coalesce(p.trusted_profile, false)
    or coalesce(pp.trusted_partner_status, '') = 'verified'
  )
  into v_trusted
  from public.profiles p
  left join public.partner_profiles pp on pp.user_id = p.id
  where p.id = p_user_id;

  update public.listings
  set is_trusted_seller = coalesce(v_trusted, false)
  where owner_id = p_user_id;
end;
$function$;

revoke all on function public.sync_trusted_listing_flags(uuid) from public, anon, authenticated;
grant execute on function public.sync_trusted_listing_flags(uuid) to service_role;

create or replace function public.sync_trusted_listing_flags_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.sync_trusted_listing_flags(new.id);
  return new;
end;
$function$;

create or replace function public.sync_trusted_listing_flags_from_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.sync_trusted_listing_flags(new.user_id);
  return new;
end;
$function$;

drop trigger if exists trg_sync_trusted_listing_from_profile on public.profiles;
create trigger trg_sync_trusted_listing_from_profile
after update of trusted_profile on public.profiles
for each row
when (old.trusted_profile is distinct from new.trusted_profile)
execute function public.sync_trusted_listing_flags_from_profile();

drop trigger if exists trg_sync_trusted_listing_from_partner on public.partner_profiles;
create trigger trg_sync_trusted_listing_from_partner
after update of trusted_partner_status on public.partner_profiles
for each row
when (old.trusted_partner_status is distinct from new.trusted_partner_status)
execute function public.sync_trusted_listing_flags_from_partner();

-- New/updated listings inherit the current trust state automatically.
create or replace function public.set_listing_trusted_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_trusted boolean := false;
begin
  select (
    coalesce(p.trusted_profile, false)
    or coalesce(pp.trusted_partner_status, '') = 'verified'
  )
  into v_trusted
  from public.profiles p
  left join public.partner_profiles pp on pp.user_id = p.id
  where p.id = new.owner_id;

  new.is_trusted_seller := coalesce(v_trusted, false);
  return new;
end;
$function$;

drop trigger if exists trg_set_listing_trusted_status on public.listings;
create trigger trg_set_listing_trusted_status
before insert or update of owner_id on public.listings
for each row execute function public.set_listing_trusted_status();

-- Backfill the current state once. This does not alter listing ownership or content.
update public.listings l
set is_trusted_seller = (
  coalesce(p.trusted_profile, false)
  or coalesce(pp.trusted_partner_status, '') = 'verified'
)
from public.profiles p
left join public.partner_profiles pp on pp.user_id = p.id
where p.id = l.owner_id;

commit;
