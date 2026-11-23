-- Allow professional partner accounts to create listable service listings.
-- The service wizard already restricts taxonomy to active service categories;
-- this policy keeps that rule enforced while avoiding dependency on a
-- partner_profiles row being present for the authenticated partner.

drop policy if exists listings_insert_own on public.listings;

create policy listings_insert_own
on public.listings
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and taxonomy_code is not null
  and exists (
    select 1
    from public.listing_categories c
    where c.code = listings.taxonomy_code
      and c.entity_type = 'property'
      and c.is_active
      and c.is_listable
      and (
        (
          exists (
            select 1
            from public.profiles p
            join public.partner_category_permissions pc
              on pc.partner_type = 'owner'
             and pc.category_code = listings.taxonomy_code
             and pc.can_create
            where p.id = (select auth.uid())
              and p.account_type = 'individual'
              and listings.seller_role = 'owner'
          )
          or exists (
            select 1
            from public.partner_profiles pp
            join public.partner_category_permissions pc
              on pc.partner_type = pp.partner_type
             and pc.category_code = listings.taxonomy_code
             and pc.can_create
            where pp.user_id = (select auth.uid())
          )
        )
      )
  )
  or (
    owner_id = (select auth.uid())
    and taxonomy_code is not null
    and exists (
      select 1
      from public.profiles p
      join public.listing_categories c
        on c.code = listings.taxonomy_code
      where p.id = (select auth.uid())
        and p.account_type = 'partner'
        and c.entity_type = 'service'
        and c.section_code = 'services'
        and c.is_active
        and c.is_listable
    )
  )
);
