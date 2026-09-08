-- P0 safety: catalog rows are not sellable until an administrator configures a non-zero price and enables them.
-- This prevents accidental zero-value orders while payment providers are not connected.
update public.monetization_products
set active=false, updated_at=now()
where code in ('extra_listing','top_1','top_3','top_7','top_14','top_30','up','highlight','premium','featured_7','premium_14');
