-- Fix individual owner listing creation for the sale_house taxonomy.
-- The listings INSERT RLS policy requires an owner permission row.
insert into public.partner_category_permissions (partner_type, category_code, can_create)
values ('owner', 'sale_house', true)
on conflict (partner_type, category_code)
do update set can_create = excluded.can_create;
