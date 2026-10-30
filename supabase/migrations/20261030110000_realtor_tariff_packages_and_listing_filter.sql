-- Realtor subscription catalogue and listing quota enforcement.
-- Partner products and partner triggers remain untouched.
insert into public.monetization_products
(code,name,name_ru,description,description_ru,price_uzs,duration_days,boost_rank,badge,badge_ru,active,product_type,audience,unit,quantity,metadata)
values
('realtor_free','FREE','FREE','10 ta faol e’lon, professional profil va mijozlardan murojaat qabul qilish.','10 активных объявлений, профессиональный профиль и приём обращений клиентов.',0,30,0,'FREE','FREE',true,'subscription','realtor','month',1,
 jsonb_build_object('listing_limit',10,'analytics','basic','top_credits',0,'up_credits',0,'verified_badge',true,'crm',false,'team_members',1,'lead_distribution',false,'agency_profile',false,'priority_search',false)),
('realtor_pro','PRO','PRO','100 ta e’lon, oyiga 20 TOP va 30 UP, tasdiqlangan belgi, CRM, statistika va qidiruvda ustuvorlik.','100 объявлений, 20 TOP и 30 UP в месяц, значок проверки, CRM, статистика и приоритет в поиске.',299900,30,0,'PRO','PRO',true,'subscription','realtor','month',1,
 jsonb_build_object('listing_limit',100,'analytics','advanced','top_credits',20,'up_credits',30,'verified_badge',true,'crm',true,'team_members',1,'lead_distribution',false,'agency_profile',false,'priority_search',true)),
('realtor_business','BUSINESS','BUSINESS','300 ta e’lon, jamoa va agentlar, CRM, murojaatlarni taqsimlash, kengaytirilgan statistika va agentlik profili.','300 объявлений, команда и агенты, CRM, распределение обращений, расширенная аналитика и профиль агентства.',599900,30,0,'BUSINESS','BUSINESS',true,'subscription','realtor','month',1,
 jsonb_build_object('listing_limit',300,'analytics','advanced','top_credits',60,'up_credits',100,'verified_badge',true,'crm',true,'team_members',10,'lead_distribution',true,'agency_profile',true,'priority_search',true))
on conflict (code) do update set
 name=excluded.name,name_ru=excluded.name_ru,description=excluded.description,description_ru=excluded.description_ru,
 price_uzs=excluded.price_uzs,duration_days=excluded.duration_days,boost_rank=excluded.boost_rank,
 badge=excluded.badge,badge_ru=excluded.badge_ru,active=excluded.active,product_type=excluded.product_type,
 audience=excluded.audience,unit=excluded.unit,quantity=excluded.quantity,metadata=excluded.metadata,updated_at=now();

-- Add owner_id to the public listing search view so a realtor-specific profile filter can be applied
-- server-side without exposing or mixing listings from other sellers.
create or replace view public.listing_search as
select l.id,l.title,l.title_ru,l.listing_type,l.property_type,l.status,l.price,l.currency,l.area_m2,l.rooms,l.floor,l.floors_total,l.land_area,l.district,l.city,l.latitude,l.longitude,l.seller_type,l.seller_name,l.primary_image_url,l.is_mortgage_available,l.is_verified,l.is_featured,l.published_at,l.taxonomy_code,l.promoted_until,l.promotion_rank,l.promotion_badge,l.bumped_at,
greatest(coalesce(active_promotion.boost_rank,0),case when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 20 else 0 end,case when coalesce(l.is_trusted_seller,false) then 10 else 0 end) as effective_promotion_rank,
case when active_promotion.badge is not null then active_promotion.badge when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 'UP' when coalesce(l.is_trusted_seller,false) then 'Ishonchli' else null end as effective_promotion_badge,
(greatest(coalesce(active_promotion.boost_rank,0),case when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 20 else 0 end,case when coalesce(l.is_trusted_seller,false) then 10 else 0 end)>=60) as effective_is_featured,
l.is_trusted_seller,l.owner_id
from public.listings l
left join lateral (
 select mp.boost_rank,mp.badge from public.listing_promotions lp
 join public.monetization_products mp on mp.code=lp.product_code
 where lp.listing_id=l.id and lp.status='active' and mp.active=true
 and lp.starts_at<=now() and lp.ends_at is not null and lp.ends_at>now()
 order by mp.boost_rank desc,lp.ends_at desc limit 1
) active_promotion on true
where l.status='active';
grant select on public.listing_search to anon,authenticated;
revoke insert,update,delete on public.listing_search from anon,authenticated;

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

  select e.product_code, greatest(coalesce((p.metadata->>'listing_limit')::integer,10),10)
    into v_product_code,v_limit
  from public.monetization_entitlements e
  join public.monetization_products p on p.code=e.product_code
  where e.user_id=new.owner_id and e.status='active'
    and p.product_type='subscription' and p.audience='realtor' and p.active=true
    and (e.ends_at is null or e.ends_at>now())
  order by e.ends_at desc nulls last,e.created_at desc
  limit 1;

  v_limit := coalesce(v_limit,10);
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
drop trigger if exists trg_realtor_subscription_listing_limit on public.listings;
create trigger trg_realtor_subscription_listing_limit
before insert or update of status on public.listings
for each row execute function public.enforce_realtor_subscription_listing_limit();
