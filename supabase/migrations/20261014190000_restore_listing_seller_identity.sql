begin;

-- Keep the seller identity consistent for property and service listings even
-- when a server-side workflow writes through the service client and therefore
-- bypasses the client-side RLS trigger.
create or replace function public.sync_listing_seller_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  is_service boolean;
begin
  select * into p
  from public.profiles
  where id = new.owner_id;

  -- Do not invent an identity when the authenticated account has no RoyalHouse
  -- profile. The application must repair/complete that profile first.
  if not found then
    return new;
  end if;

  is_service := (new.listing_type = 'service' or new.property_type = 'service');

  if is_service then
    new.seller_type := coalesce(nullif(trim(new.seller_type), ''), 'service_provider');
    new.seller_name := coalesce(
      nullif(trim(new.seller_name), ''),
      nullif(trim(p.company_name), ''),
      nullif(trim(p.full_name), '')
    );
  elsif p.account_type = 'individual' and new.ownership_type = 'owner' then
    new.seller_type := 'owner';
    new.seller_role := 'owner';
    new.seller_name := coalesce(nullif(trim(new.seller_name), ''), nullif(trim(p.full_name), ''));
  elsif p.account_type = 'partner' then
    new.seller_type := coalesce(nullif(trim(new.seller_type), ''), 'seller');
    new.seller_name := coalesce(
      nullif(trim(new.seller_name), ''),
      nullif(trim(p.company_name), ''),
      nullif(trim(p.full_name), '')
    );
  end if;

  new.seller_phone := coalesce(nullif(trim(new.seller_phone), ''), nullif(trim(p.phone), ''));
  return new;
end;
$$;

drop trigger if exists trg_sync_listing_seller_identity on public.listings;
create trigger trg_sync_listing_seller_identity
after insert or update of owner_id, listing_type, property_type, ownership_type, seller_type, seller_name, seller_phone
on public.listings
for each row execute function public.sync_listing_seller_identity();

-- Repair existing listings that were created before the identity was synced.
update public.listings l
set
  seller_type = case
    when p.account_type = 'individual' and l.ownership_type = 'owner' then 'owner'
    when l.listing_type = 'service' or l.property_type = 'service' then 'service_provider'
    when p.account_type = 'partner' then coalesce(nullif(trim(l.seller_type), ''), 'seller')
    else l.seller_type
  end,
  seller_role = case
    when p.account_type = 'individual' and l.ownership_type = 'owner' then 'owner'
    when l.listing_type = 'service' or l.property_type = 'service' then 'service_provider'
    else l.seller_role
  end,
  seller_name = coalesce(
    nullif(trim(l.seller_name), ''),
    case
      when l.listing_type = 'service' or l.property_type = 'service' then nullif(trim(p.company_name), '')
      when p.account_type = 'partner' then nullif(trim(p.company_name), '')
      when p.account_type = 'individual' and l.ownership_type = 'owner' then nullif(trim(p.full_name), '')
      else null
    end,
    nullif(trim(p.full_name), '')
  ),
  seller_phone = coalesce(nullif(trim(l.seller_phone), ''), nullif(trim(p.phone), ''))
from public.profiles p
where p.id = l.owner_id
  and (
    nullif(trim(l.seller_name), '') is null
    or nullif(trim(l.seller_phone), '') is null
    or (p.account_type = 'partner' and nullif(trim(l.seller_type), '') is null)
  );

commit;
