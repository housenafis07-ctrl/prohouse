-- Add three service categories and keep the canonical taxonomy in sync.
insert into public.partner_listing_taxonomy (code, section_code, parent_code, name_uz, name_ru, node_type, allows_partner_listing, listing_type, property_type, is_owner_filter, is_mortgage_filter, is_new_construction_filter, sort_order, is_active)
values
('services_landscape','services','services','Landshaft','Ландшафтный дизайн','category',true,null,null,false,false,false,115,true),
('services_cctv','services','services','Kuzatuv kamerasi','Камеры видеонаблюдения','category',true,null,null,false,false,false,120,true),
('services_ac_installation','services','services','Konditsioner o‘rnatish','Установка кондиционеров','category',true,null,null,false,false,false,125,true)
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

insert into public.listing_categories (code, parent_code, name_uz, name_ru, section_code, listing_type, property_type, entity_type, is_listable, is_mortgage_filter, is_new_construction_filter, sort_order, is_active)
values
('services_landscape','services','Landshaft','Ландшафтный дизайн','services',null,null,'service',true,false,false,115,true),
('services_cctv','services','Kuzatuv kamerasi','Камеры видеонаблюдения','services',null,null,'service',true,false,false,120,true),
('services_ac_installation','services','Konditsioner o‘rnatish','Установка кондиционеров','services',null,null,'service',true,false,false,125,true)
on conflict (code) do update set
  parent_code=excluded.parent_code,
  name_uz=excluded.name_uz,
  name_ru=excluded.name_ru,
  section_code=excluded.section_code,
  listing_type=excluded.listing_type,
  property_type=excluded.property_type,
  entity_type=excluded.entity_type,
  is_listable=excluded.is_listable,
  is_mortgage_filter=excluded.is_mortgage_filter,
  is_new_construction_filter=excluded.is_new_construction_filter,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

insert into public.partner_category_permissions (partner_type, category_code, can_create)
values
('contractor','services_landscape',true),
('contractor','services_cctv',true),
('contractor','services_ac_installation',true),
('service_provider','services_landscape',true),
('service_provider','services_cctv',true),
('service_provider','services_ac_installation',true)
on conflict (partner_type, category_code) do update set can_create=true;
