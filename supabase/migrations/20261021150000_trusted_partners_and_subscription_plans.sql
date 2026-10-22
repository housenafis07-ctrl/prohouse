begin;

alter table public.partner_profiles
  add column if not exists trusted_partner_status text not null default 'not_requested',
  add column if not exists trusted_partner_rejection_reason text,
  add column if not exists trusted_partner_reviewed_at timestamptz,
  add column if not exists trusted_partner_reviewed_by uuid references auth.users(id) on delete set null;
alter table public.partner_profiles drop constraint if exists partner_profiles_trusted_partner_status_check;
alter table public.partner_profiles add constraint partner_profiles_trusted_partner_status_check check (trusted_partner_status in ('not_requested','requested','under_review','verified','rejected'));

create table if not exists public.partner_verification_documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  partner_profile_id uuid references public.partner_profiles(id) on delete cascade, document_type text not null,
  file_name text not null, storage_path text not null unique, mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0), status text not null default 'submitted', rejection_reason text,
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status in ('submitted','accepted','rejected','archived'))
);
create index if not exists partner_verification_documents_user_idx on public.partner_verification_documents(user_id, created_at desc);
create index if not exists partner_verification_documents_status_idx on public.partner_verification_documents(status, created_at desc);
alter table public.partner_verification_documents enable row level security;
drop policy if exists partner_verification_documents_select_own on public.partner_verification_documents;
create policy partner_verification_documents_select_own on public.partner_verification_documents for select to authenticated using (user_id = auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('partner-verification-documents','partner-verification-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

alter table public.monetization_products drop constraint if exists monetization_products_audience_check;
alter table public.monetization_products add constraint monetization_products_audience_check check (audience = any (array['all','individual','partner','realtor','agency','developer']::text[]));

insert into public.monetization_products
(code,name,name_ru,description,description_ru,price_uzs,duration_days,boost_rank,badge,badge_ru,active,product_type,audience,unit,quantity,metadata)
values
('partner_start','START','START','10 ta e’lon, statistika va oddiy hamkor profil.','10 объявлений, статистика и обычный профиль партнёра.',29000,30,0,'START','START',true,'subscription','partner','month',1,jsonb_build_object('listing_limit',10,'analytics','basic','priority_moderation',false,'promo_tools',false,'priority_support',false,'employees',1,'trusted_partner',false,'company_profile',false)),
('partner_pro','PRO','PRO','30 ta e’lon, analytics, ustuvor moderatsiya va promo tools.','30 объявлений, аналитика, приоритетная модерация и promo tools.',59000,30,0,'PRO','PRO',true,'subscription','partner','month',1,jsonb_build_object('listing_limit',30,'analytics','advanced','priority_moderation',true,'promo_tools',true,'priority_support',false,'employees',1,'trusted_partner',false,'company_profile',false)),
('partner_business','BUSINESS','BUSINESS','100+ e’lon, bir nechta xodim, firma profili, advanced analytics va priority support.','100+ объявлений, несколько сотрудников, профиль компании, расширенная аналитика и приоритетная поддержка.',149000,30,0,'BUSINESS','BUSINESS',true,'subscription','partner','month',1,jsonb_build_object('listing_limit',100,'listing_limit_label','100+','analytics','advanced','priority_moderation',true,'promo_tools',true,'priority_support',true,'employees',10,'trusted_partner',false,'company_profile',true))
on conflict (code) do update set name=excluded.name,name_ru=excluded.name_ru,description=excluded.description,description_ru=excluded.description_ru,price_uzs=excluded.price_uzs,duration_days=excluded.duration_days,boost_rank=excluded.boost_rank,badge=excluded.badge,badge_ru=excluded.badge_ru,active=excluded.active,product_type=excluded.product_type,audience=excluded.audience,unit=excluded.unit,quantity=excluded.quantity,metadata=excluded.metadata,updated_at=now();

create or replace function public.enforce_partner_listing_plan() returns trigger language plpgsql security definer set search_path=public as $function$
declare v_account_type text; v_limit integer; v_used integer; v_product_code text; v_limit_label text;
begin
 select p.account_type into v_account_type from public.profiles p where p.id=new.owner_id;
 if coalesce(v_account_type,'')<>'partner' then return new; end if;
 if new.status='draft' then return new; end if;
 select e.product_code,greatest(coalesce((p.metadata->>'listing_limit')::integer,0),0),coalesce(p.metadata->>'listing_limit_label',p.metadata->>'listing_limit') into v_product_code,v_limit,v_limit_label
 from public.monetization_entitlements e join public.monetization_products p on p.code=e.product_code
 where e.user_id=new.owner_id and e.status='active' and p.product_type='subscription' and p.audience='partner' and p.active=true and (e.ends_at is null or e.ends_at>now())
 order by e.ends_at desc nulls last,e.created_at desc limit 1;
 if v_product_code is null then raise exception 'PARTNER_SUBSCRIPTION_REQUIRED: Hamkor uchun faol tarif kerak.' using errcode='check_violation'; end if;
 select count(*)::integer into v_used from public.listings l where l.owner_id=new.owner_id and l.status in ('moderation','active','reserved') and l.id is distinct from new.id;
 if v_used>=v_limit then raise exception 'PARTNER_LISTING_LIMIT_REACHED: Tarif limiti (% ta) tugagan.' using errcode='check_violation',detail=jsonb_build_object('product_code',v_product_code,'listing_limit',v_limit,'listing_limit_label',v_limit_label,'used',v_used)::text; end if;
 return new;
end;
$function$;
revoke all on function public.enforce_partner_listing_plan() from public;
grant execute on function public.enforce_partner_listing_plan() to service_role;
drop trigger if exists trg_partner_listing_plan on public.listings;
create trigger trg_partner_listing_plan before insert or update of status on public.listings for each row execute function public.enforce_partner_listing_plan();

create or replace view public.listing_search as
select l.id,l.title,l.title_ru,l.listing_type,l.property_type,l.status,l.price,l.currency,l.area_m2,l.rooms,l.floor,l.floors_total,l.land_area,l.district,l.city,l.latitude,l.longitude,l.seller_type,l.seller_name,l.primary_image_url,l.is_mortgage_available,l.is_verified,l.is_featured,l.published_at,l.taxonomy_code,l.promoted_until,l.promotion_rank,l.promotion_badge,l.bumped_at,
greatest(coalesce(active_promotion.boost_rank,0),case when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 20 else 0 end,case when coalesce(l.is_trusted_seller,false) then 10 else 0 end) as effective_promotion_rank,
case when active_promotion.badge is not null then active_promotion.badge when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 'UP' when coalesce(l.is_trusted_seller,false) then 'Ishonchli' else null end as effective_promotion_badge,
(greatest(coalesce(active_promotion.boost_rank,0),case when l.bumped_at is not null and l.bumped_at>(now()-interval '1 day') then 20 else 0 end,case when coalesce(l.is_trusted_seller,false) then 10 else 0 end)>=60) as effective_is_featured,l.is_trusted_seller
from public.listings l left join lateral (select mp.boost_rank,mp.badge from public.listing_promotions lp join public.monetization_products mp on mp.code=lp.product_code where lp.listing_id=l.id and lp.status='active' and mp.active=true and lp.starts_at<=now() and lp.ends_at is not null and lp.ends_at>now() order by mp.boost_rank desc,lp.ends_at desc limit 1) active_promotion on true where l.status='active';
grant select on public.listing_search to anon,authenticated;
revoke insert,update,delete on public.listing_search from anon,authenticated;
commit;
