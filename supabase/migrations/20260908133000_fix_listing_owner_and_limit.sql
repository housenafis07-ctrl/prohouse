-- P1 fix: expose house ownership in the dynamic wizard and restore the
-- production individual-listing limit RPC with the status semantics used by Prohouse.

alter table public.listings
  add column if not exists ownership_type text;

alter table public.listings
  drop constraint if exists listings_ownership_type_check;

alter table public.listings
  add constraint listings_ownership_type_check
  check (ownership_type is null or ownership_type in ('owner','power_of_attorney','representative'));

insert into public.category_attributes
  (category_code, code, name_uz, name_ru, data_type, options, unit, is_required, sort_order, is_active)
values
  ('sale_house', 'ownership_type', 'Mulk egasi', 'Собственник', 'text',
   '[{"value":"owner","label":"Egasiman"},{"value":"power_of_attorney","label":"Ishonchnoma asosida"},{"value":"representative","label":"Vakilman"}]'::jsonb,
   null, true, 10, true)
on conflict (category_code, code) do update set
  name_uz = excluded.name_uz,
  name_ru = excluded.name_ru,
  data_type = excluded.data_type,
  options = excluded.options,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create or replace function public.assert_individual_listing_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_type text;
  used_count integer;
  free_limit integer := 3;
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;

  select p.account_type into account_type
  from public.profiles p
  where p.id = p_user_id;

  if coalesce(account_type, '') <> 'individual' then
    return jsonb_build_object('allowed', true, 'account_type', account_type,
      'used', 0, 'free_limit', free_limit, 'remaining', free_limit);
  end if;

  select count(*)::integer into used_count
  from public.listings l
  where l.owner_id = p_user_id
    and l.status in ('active', 'moderation');

  if used_count >= free_limit then
    raise exception 'LISTING_LIMIT_REACHED'
      using detail = jsonb_build_object('used', used_count,
        'free_limit', free_limit, 'remaining', 0)::text;
  end if;

  return jsonb_build_object('allowed', true, 'account_type', account_type,
    'used', used_count, 'free_limit', free_limit,
    'remaining', free_limit - used_count);
end;
$$;

revoke all on function public.assert_individual_listing_limit(uuid) from public;
grant execute on function public.assert_individual_listing_limit(uuid) to authenticated;
