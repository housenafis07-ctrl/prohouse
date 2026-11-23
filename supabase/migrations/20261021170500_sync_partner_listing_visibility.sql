begin;

create or replace function public.sync_partner_subscription_visibility()
returns jsonb
language plpgsql
set search_path = public
as $function$
declare
  v_profile record;
  v_limit integer;
  v_listing record;
  v_should_show boolean;
  v_hidden integer := 0;
  v_restored integer := 0;
begin
  for v_profile in
    select p.id as profile_id
    from public.profiles p
    where p.account_type = 'partner'
  loop
    select greatest(coalesce((mp.metadata->>'listing_limit')::integer, 0), 0)
      into v_limit
    from public.monetization_entitlements e
    join public.monetization_products mp on mp.code = e.product_code
    where e.user_id = v_profile.profile_id
      and e.status = 'active'
      and mp.product_type = 'subscription'
      and mp.audience = 'partner'
      and mp.active = true
      and (e.ends_at is null or e.ends_at > now())
    order by e.ends_at desc nulls last, e.created_at desc
    limit 1;

    if not found then
      v_limit := 0;
    end if;

    for v_listing in
      select l.id,
             row_number() over (
               order by coalesce(l.published_at, l.created_at) desc, l.id desc
             ) as position
      from public.listings l
      where l.owner_id = v_profile.profile_id
        and l.status in ('moderation','active','reserved')
    loop
      v_should_show := v_listing.position <= v_limit;

      if v_should_show then
        update public.listings
        set public_visibility = true,
            visibility_reason = null
        where id = v_listing.id
          and visibility_reason = 'subscription_expired';

        if found then
          v_restored := v_restored + 1;
        end if;
      else
        update public.listings
        set public_visibility = false,
            visibility_reason = 'subscription_expired'
        where id = v_listing.id
          and (public_visibility is distinct from false
               or visibility_reason is distinct from 'subscription_expired');

        if found then
          v_hidden := v_hidden + 1;
        end if;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('hidden', v_hidden, 'restored', v_restored);
end;
$function$;

grant execute on function public.sync_partner_subscription_visibility() to service_role;

commit;
