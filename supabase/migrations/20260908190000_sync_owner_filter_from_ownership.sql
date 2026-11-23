-- Keep the public "Egadan" filter aligned with the listing wizard's
-- "Mulk egasi" checkbox. ownership_type is the source of truth for the
-- detailed ownership selection; seller_type remains the legacy/search field.

update public.listings
set seller_type = 'owner'
where ownership_type = 'owner'
  and seller_type is distinct from 'owner';

create or replace function public.sync_listing_owner_filter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ownership_type = 'owner' then
    new.seller_type := 'owner';
  elsif new.ownership_type is not null
    and new.seller_type = 'owner' then
    new.seller_type := 'seller';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_sync_owner_filter on public.listings;
create trigger listings_sync_owner_filter
before insert or update of ownership_type
on public.listings
for each row
execute function public.sync_listing_owner_filter();

create index if not exists listings_ownership_type_idx
on public.listings(ownership_type);
