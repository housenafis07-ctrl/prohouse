-- Prohouse P0 platform core: canonical categories, partner permissions,
-- dynamic attributes, drafts, favorites, saved searches, events and reviews.

create table if not exists public.listing_categories (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  parent_code text, name_uz text not null, name_ru text,
  section_code text not null, listing_type text, property_type text,
  entity_type text not null default 'property' check (entity_type in ('property','service')),
  is_listable boolean not null default true,
  is_mortgage_filter boolean not null default false,
  is_new_construction_filter boolean not null default false,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.listing_categories(code,parent_code,name_uz,name_ru,section_code,listing_type,property_type,entity_type,is_listable,is_mortgage_filter,is_new_construction_filter,sort_order)
select t.code,t.parent_code,t.name_uz,t.name_ru,t.section_code,t.listing_type,t.property_type,
 case when t.listing_type='service' then 'service' else 'property' end,
 case when t.listing_type is null or t.code in ('new_building_discounts','realtor_agent','realtor_agency','realtor_company') then false else true end,
 t.is_mortgage_filter,t.is_new_construction_filter,t.sort_order
from public.partner_listing_taxonomy t where t.is_active
on conflict(code) do update set parent_code=excluded.parent_code,name_uz=excluded.name_uz,name_ru=excluded.name_ru,section_code=excluded.section_code,listing_type=excluded.listing_type,property_type=excluded.property_type,entity_type=excluded.entity_type,is_listable=excluded.is_listable,is_mortgage_filter=excluded.is_mortgage_filter,is_new_construction_filter=excluded.is_new_construction_filter,sort_order=excluded.sort_order,updated_at=now();
create index if not exists listing_categories_parent_idx on public.listing_categories(parent_code,sort_order);
create index if not exists listing_categories_section_idx on public.listing_categories(section_code,sort_order) where is_active;

create table if not exists public.partner_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 partner_type text not null check (partner_type in ('owner','realtor','agency','developer','contractor','service_provider')),
 legal_form text check (legal_form in ('individual','self_employed','sole_proprietor','llc','jsc','other')),
 display_name text, company_name text, description text, logo_url text, website text,
 verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
 service_regions jsonb not null default '[]', metadata jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.partner_profiles(user_id,partner_type,display_name,company_name,verification_status)
select p.id,case when p.partner_type in ('owner','realtor','agency','developer','contractor','service_provider') then p.partner_type else 'owner' end,coalesce(p.company_name,p.full_name),p.company_name,case when p.verification_status='verified' then 'verified' else 'unverified' end
from public.profiles p where p.account_type='partner'
on conflict(user_id) do update set partner_type=excluded.partner_type,display_name=coalesce(public.partner_profiles.display_name,excluded.display_name),company_name=coalesce(public.partner_profiles.company_name,excluded.company_name),updated_at=now();
create index if not exists partner_profiles_type_idx on public.partner_profiles(partner_type,verification_status);

create table if not exists public.partner_category_permissions (
 id uuid primary key default gen_random_uuid(),
 partner_type text not null check (partner_type in ('owner','realtor','agency','developer','contractor','service_provider')),
 category_code text not null references public.listing_categories(code) on update cascade on delete cascade,
 can_create boolean not null default false, created_at timestamptz not null default now(), unique(partner_type,category_code)
);
insert into public.partner_category_permissions(partner_type,category_code,can_create)
select pt.partner_type,c.code,case
 when pt.partner_type in ('realtor','agency') and c.entity_type='property' and c.is_listable then true
 when pt.partner_type='developer' and c.code in ('sale_new_building','new_building_complexes','new_building_apartments') then true
 when pt.partner_type='contractor' and c.code in ('services_construction','services_repair','services_design','services_furniture','services_plumbing','services_electric','services_moving') then true
 when pt.partner_type='service_provider' and c.entity_type='service' and c.is_listable then true
 when pt.partner_type='owner' and c.entity_type='property' and c.is_listable and c.code not in ('sale_new_building','new_building_complexes','new_building_apartments') then true
 else false end
from (values('owner'),('realtor'),('agency'),('developer'),('contractor'),('service_provider')) pt(partner_type) cross join public.listing_categories c
on conflict(partner_type,category_code) do update set can_create=excluded.can_create;
create index if not exists partner_category_permissions_lookup_idx on public.partner_category_permissions(partner_type,category_code) where can_create;

create table if not exists public.category_attributes (
 id uuid primary key default gen_random_uuid(), category_code text not null references public.listing_categories(code) on update cascade on delete cascade,
 code text not null, name_uz text not null, name_ru text,
 data_type text not null check (data_type in ('text','number','boolean','select','multiselect')),
 options jsonb not null default '[]', unit text, is_required boolean not null default false, sort_order integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(category_code,code)
);
insert into public.category_attributes(category_code,code,name_uz,name_ru,data_type,unit,is_required,sort_order) values
('sale_apartment','rooms','Xonalar','Комнаты','number',null,true,10),('sale_apartment','area_m2','Maydon','Площадь','number','m²',true,20),('sale_apartment','floor','Qavat','Этаж','number',null,false,30),('sale_apartment','floors_total','Qavatlar soni','Этажей в доме','number',null,false,40),
('sale_house','area_m2','Uy maydoni','Площадь дома','number','m²',true,20),('sale_house','land_area','Yer maydoni','Площадь участка','number','sotix',false,30),('sale_house','rooms','Xonalar','Комнаты','number',null,false,40),
('sale_land','land_area','Yer maydoni','Площадь участка','number','sotix',true,10),('sale_land','purpose','Yer maqsadi','Назначение земли','text',null,false,20),
('sale_commercial','area_m2','Maydon','Площадь','number','m²',true,10),('sale_commercial','commercial_type','Tijorat turi','Тип объекта','text',null,false,20),
('rent_long_term','rooms','Xonalar','Комнаты','number',null,false,10),('rent_long_term','area_m2','Maydon','Площадь','number','m²',false,20),('rent_daily','max_guests','Mehmonlar soni','Количество гостей','number',null,false,10),
('new_building_apartments','rooms','Xonalar','Комнаты','number',null,false,10),('new_building_apartments','area_m2','Maydon','Площадь','number','m²',false,20)
on conflict(category_code,code) do nothing;

create table if not exists public.listing_attribute_values (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
 attribute_id uuid not null references public.category_attributes(id) on delete cascade, value_jsonb jsonb not null default 'null',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(listing_id,attribute_id)
);
create index if not exists listing_attribute_values_listing_idx on public.listing_attribute_values(listing_id);
create index if not exists listing_attribute_values_attribute_idx on public.listing_attribute_values(attribute_id);

create table if not exists public.listing_favorites(user_id uuid not null references auth.users(id) on delete cascade,listing_id uuid not null references public.listings(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,listing_id));
create index if not exists listing_favorites_listing_idx on public.listing_favorites(listing_id,created_at desc);

create table if not exists public.saved_searches(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,query jsonb not null default '{}',is_active boolean not null default true,notify_push boolean not null default true,notify_email boolean not null default false,last_notified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists saved_searches_user_idx on public.saved_searches(user_id,created_at desc);

create table if not exists public.listing_events(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,session_id text,event_type text not null check(event_type in ('view','favorite','unfavorite','phone_click','chat_start','share','mortgage_click','map_open')),metadata jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists listing_events_listing_idx on public.listing_events(listing_id,created_at desc);
create index if not exists listing_events_type_idx on public.listing_events(event_type,created_at desc);

create table if not exists public.listing_reviews(id uuid primary key default gen_random_uuid(),listing_id uuid references public.listings(id) on delete cascade,reviewed_user_id uuid references auth.users(id) on delete cascade,author_id uuid not null references auth.users(id) on delete cascade,rating integer not null check(rating between 1 and 5),body text,status text not null default 'pending' check(status in ('pending','published','rejected')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(listing_id is not null or reviewed_user_id is not null),check(reviewed_user_id is null or author_id<>reviewed_user_id));
create index if not exists listing_reviews_listing_idx on public.listing_reviews(listing_id,status,created_at desc);
create index if not exists listing_reviews_user_idx on public.listing_reviews(reviewed_user_id,status,created_at desc);

alter table public.listings add column if not exists draft_step smallint not null default 1;
alter table public.listings add column if not exists draft_data jsonb not null default '{}';
alter table public.listings add column if not exists submitted_at timestamptz;
create index if not exists listings_owner_drafts_idx on public.listings(owner_id,updated_at desc) where status='draft';
update public.partner_listing_taxonomy set allows_partner_listing=false where code in ('new_building_discounts','realtor_agent','realtor_agency','realtor_company');

alter table public.listing_categories enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.partner_category_permissions enable row level security;
alter table public.category_attributes enable row level security;
alter table public.listing_attribute_values enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.saved_searches enable row level security;
alter table public.listing_events enable row level security;
alter table public.listing_reviews enable row level security;

drop policy if exists listing_categories_public_read on public.listing_categories;
create policy listing_categories_public_read on public.listing_categories for select using(is_active);
drop policy if exists partner_profiles_public_read on public.partner_profiles;
create policy partner_profiles_public_read on public.partner_profiles for select using(verification_status in ('pending','verified') or user_id=(select auth.uid()));
drop policy if exists partner_profiles_owner_write on public.partner_profiles;
create policy partner_profiles_owner_write on public.partner_profiles for all using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists partner_category_permissions_public_read on public.partner_category_permissions;
create policy partner_category_permissions_public_read on public.partner_category_permissions for select using(true);
drop policy if exists category_attributes_public_read on public.category_attributes;
create policy category_attributes_public_read on public.category_attributes for select using(is_active);
drop policy if exists listing_attribute_values_owner_read on public.listing_attribute_values;
create policy listing_attribute_values_owner_read on public.listing_attribute_values for select using(exists(select 1 from public.listings l where l.id=listing_id and (l.owner_id=(select auth.uid()) or l.status='active')));
drop policy if exists listing_attribute_values_owner_write on public.listing_attribute_values;
create policy listing_attribute_values_owner_write on public.listing_attribute_values for all using(exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid()))) with check(exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
drop policy if exists listing_favorites_owner on public.listing_favorites;
create policy listing_favorites_owner on public.listing_favorites for all using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists saved_searches_owner on public.saved_searches;
create policy saved_searches_owner on public.saved_searches for all using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists listing_events_insert on public.listing_events;
create policy listing_events_insert on public.listing_events for insert to anon,authenticated with check(user_id is null or user_id=(select auth.uid()));
drop policy if exists listing_events_owner_read on public.listing_events;
create policy listing_events_owner_read on public.listing_events for select to authenticated using(exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
drop policy if exists listing_reviews_public_read on public.listing_reviews;
create policy listing_reviews_public_read on public.listing_reviews for select using(status='published' or author_id=(select auth.uid()) or reviewed_user_id=(select auth.uid()));
drop policy if exists listing_reviews_author_insert on public.listing_reviews;
create policy listing_reviews_author_insert on public.listing_reviews for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists listing_reviews_author_update on public.listing_reviews;
create policy listing_reviews_author_update on public.listing_reviews for update using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings for insert to authenticated with check(owner_id=(select auth.uid()) and taxonomy_code is not null and exists(select 1 from public.listing_categories c where c.code=listings.taxonomy_code and c.is_active and c.is_listable) and (exists(select 1 from public.profiles p join public.partner_category_permissions pc on pc.partner_type='owner' and pc.category_code=listings.taxonomy_code and pc.can_create where p.id=(select auth.uid()) and p.account_type='individual' and listings.seller_role='owner') or exists(select 1 from public.partner_profiles pp join public.partner_category_permissions pc on pc.partner_type=pp.partner_type and pc.category_code=listings.taxonomy_code and pc.can_create where pp.user_id=(select auth.uid()))));