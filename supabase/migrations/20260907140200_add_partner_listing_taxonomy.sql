create table if not exists public.partner_listing_taxonomy (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  section_code text not null,
  parent_code text null references public.partner_listing_taxonomy(code) on update cascade on delete restrict,
  name_uz text not null,
  name_ru text null,
  node_type text not null default 'category' check (node_type in ('section','category','subcategory')),
  allows_partner_listing boolean not null default false,
  listing_type text null check (listing_type is null or listing_type in ('sale','rent','daily','new_building')),
  property_type text null check (property_type is null or property_type in ('apartment','house','land','commercial','new_building')),
  is_owner_filter boolean not null default false,
  is_mortgage_filter boolean not null default false,
  is_new_construction_filter boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_listing_taxonomy_section_idx on public.partner_listing_taxonomy(section_code, sort_order);
create index if not exists partner_listing_taxonomy_parent_idx on public.partner_listing_taxonomy(parent_code, sort_order);
create index if not exists partner_listing_taxonomy_listingable_idx on public.partner_listing_taxonomy(allows_partner_listing, is_active);

alter table public.listings add column if not exists taxonomy_code text null;
alter table public.listings drop constraint if exists listings_taxonomy_code_fkey;
alter table public.listings add constraint listings_taxonomy_code_fkey foreign key (taxonomy_code) references public.partner_listing_taxonomy(code) on update cascade on delete set null;
create index if not exists listings_taxonomy_code_idx on public.listings(taxonomy_code);

insert into public.partner_listing_taxonomy (code, section_code, parent_code, name_uz, name_ru, node_type, allows_partner_listing, listing_type, property_type, is_owner_filter, is_mortgage_filter, is_new_construction_filter, sort_order)
values
('sale','sale',null,'Sotib olish','Покупка','section',false,null,null,false,false,false,10),
('sale_apartment','sale','sale','Kvartiralar','Квартиры','category',true,'sale','apartment',false,false,false,10),
('sale_new_building','sale','sale','Yangi uylar','Новостройки','category',true,'new_building','new_building',false,false,true,20),
('sale_house','sale','sale','Xususiy uylar','Частные дома','category',true,'sale','house',false,false,false,30),
('sale_dacha','sale','sale','Dacha','Дачи','category',true,'sale','house',false,false,false,40),
('sale_mortgage','sale','sale','Ipoteka uchun uylar','Жильё в ипотеку','category',true,'sale','apartment',false,true,false,50),
('sale_land','sale','sale','Yer uchastkalari','Земельные участки','category',true,'sale','land',false,false,false,60),
('sale_commercial','sale','sale','Tijorat ko‘chmas mulki','Коммерческая недвижимость','category',true,'sale','commercial',false,false,false,70),
('sale_investment','sale','sale','Investitsiya uchun','Для инвестиций','category',true,'sale','commercial',false,false,false,80),
('rent','rent',null,'Ijara','Аренда','section',false,null,null,false,false,false,20),
('rent_long_term','rent','rent','Uzoq muddatga ijara','Долгосрочная аренда','category',true,'rent','apartment',false,false,false,10),
('rent_daily','rent','rent','Kunlik ijara','Посуточная аренда','category',true,'daily','apartment',false,false,false,20),
('rent_commercial','rent','rent','Tijorat ko‘chmas mulki','Коммерческая недвижимость','category',true,'rent','commercial',false,false,false,30),
('rent_dacha','rent','rent','Dacha','Дачи','category',true,'rent','house',false,false,false,40),
('new_building','new_building',null,'Yangi uylar','Новостройки','section',false,null,null,false,false,true,30),
('new_building_complexes','new_building','new_building','Yangi uy-joy majmualari','Жилые комплексы','category',false,'new_building','new_building',false,false,true,10),
('new_building_discounts','new_building','new_building','Yangi uylar chegirmalari','Скидки на новостройки','category',false,'new_building','new_building',false,false,true,20),
('new_building_apartments','new_building','new_building','Yangi uylardagi kvartiralar','Квартиры в новостройках','category',false,'new_building','new_building',false,false,true,30),
('build_house','build_house',null,'Uy qurish','Строительство дома','section',false,null,null,false,false,false,40),
('build_house_project','build_house','build_house','Loyiha tanlash','Выбор проекта','category',false,null,null,false,false,false,10),
('build_house_catalog','build_house','build_house','Loyihalar katalogi','Каталог проектов','category',false,null,null,false,false,false,20),
('build_house_contractor','build_house','build_house','Pudratchi tanlash','Выбор подрядчика','category',false,null,null,false,false,false,30),
('build_house_land','build_house','build_house','Yer uchastkasini topish','Поиск участка','category',false,null,null,false,false,false,40),
('build_house_cost','build_house','build_house','Hisob-kitob qilish','Расчёт стоимости','category',false,null,null,false,false,false,50),
('services','services',null,'Xizmatlar','Услуги','section',false,null,null,false,false,false,50),
('services_rent','services','services','Uy-joyni ijaraga berish','Сдача жилья в аренду','category',false,null,null,false,false,false,10),
('services_valuation','services','services','Ko‘chmas mulkni baholash','Оценка недвижимости','category',false,null,null,false,false,false,20),
('services_mortgage_valuation','services','services','Ipoteka uchun baholash','Оценка для ипотеки','category',false,null,null,false,false,false,30),
('services_guaranteed_deal','services','services','Kafolatli bitim','Безопасная сделка','category',false,null,null,false,false,false,40),
('services_cash_deal','services','services','O‘z mablag‘iga bitim','Сделка за свои средства','category',false,null,null,false,false,false,50),
('services_insurance','services','services','Ipoteka sug‘urtasi','Страхование ипотеки','category',false,null,null,false,false,false,60),
('services_goods','services','services','Tovarlar','Товары','category',false,null,null,false,false,false,70),
('services_repair','services','services','Ta’mirlash','Ремонт','category',false,null,null,false,false,false,80),
('services_cleaning','services','services','Klining','Клининг','category',false,null,null,false,false,false,90),
('services_design','services','services','Dizayn-loyiha','Дизайн-проект','category',false,null,null,false,false,false,100),
('services_handyman','services','services','Soatbay usta','Мастер на час','category',false,null,null,false,false,false,110),
('realtors','realtors',null,'Rieltorlar','Риелторы','section',false,null,null,false,false,false,60),
('realtors_agents','realtors','realtors','Rieltorlar','Риелторы','category',false,null,null,false,false,false,10),
('realtors_agencies','realtors','realtors','Ko‘chmas mulk agentliklari','Агентства недвижимости','category',false,null,null,false,false,false,20)
on conflict (code) do update set
  section_code=excluded.section_code,
  parent_code=excluded.parent_code,
  name_uz=excluded.name_uz,
  name_ru=excluded.name_ru,
  node_type=excluded.node_type,
  allows_partner_listing=excluded.allows_partner_listing,
  listing_type=excluded.listing_type,
  property_type=excluded.property_type,
  is_owner_filter=excluded.is_owner_filter,
  is_mortgage_filter=excluded.is_mortgage_filter,
  is_new_construction_filter=excluded.is_new_construction_filter,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

alter table public.partner_listing_taxonomy enable row level security;
drop policy if exists partner_listing_taxonomy_read on public.partner_listing_taxonomy;
create policy partner_listing_taxonomy_read on public.partner_listing_taxonomy for select using (is_active = true);

drop policy if exists partner_listing_taxonomy_write on public.partner_listing_taxonomy;
create policy partner_listing_taxonomy_write on public.partner_listing_taxonomy for all to authenticated using (false) with check (false);