-- Keep service listings identifiable in the services marketplace without changing property listing behavior.
create or replace function public.set_service_listing_seller_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service boolean;
  profile_name text;
begin
  select (entity_type = 'service') into is_service
  from public.listing_categories
  where code = new.taxonomy_code
  limit 1;

  if coalesce(is_service, false) then
    select coalesce(nullif(trim(p.company_name), ''), nullif(trim(p.full_name), ''))
      into profile_name
    from public.profiles p
    where p.id = new.owner_id;

    if coalesce(trim(new.seller_name), '') = '' then
      new.seller_name := profile_name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_listing_seller_name on public.listings;
create trigger trg_service_listing_seller_name
before insert or update of taxonomy_code, owner_id, seller_name
on public.listings
for each row
execute function public.set_service_listing_seller_name();
