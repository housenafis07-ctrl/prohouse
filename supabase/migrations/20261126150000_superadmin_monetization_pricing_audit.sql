begin;

create table if not exists public.monetization_price_audit (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  old_price_uzs numeric(18,2) not null,
  new_price_uzs numeric(18,2) not null,
  old_duration_days integer not null,
  new_duration_days integer not null,
  old_active boolean not null,
  new_active boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists monetization_price_audit_created_idx
  on public.monetization_price_audit(created_at desc);
create index if not exists monetization_price_audit_product_idx
  on public.monetization_price_audit(product_code, created_at desc);

alter table public.monetization_price_audit enable row level security;
revoke all on public.monetization_price_audit from anon, authenticated;
grant select, insert on public.monetization_price_audit to service_role;

create or replace function public.admin_update_monetization_product_price(
  p_product_code text,
  p_price_uzs numeric,
  p_duration_days integer,
  p_active boolean,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.monetization_products%rowtype;
begin
  if p_product_code is null or length(trim(p_product_code)) = 0 then
    raise exception 'PRODUCT_CODE_REQUIRED' using errcode = '22023';
  end if;
  if p_price_uzs is null or p_price_uzs < 0 or p_price_uzs > 1000000000 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 3650 then
    raise exception 'INVALID_DURATION' using errcode = '22023';
  end if;
  if p_active is null or p_admin_user_id is null then
    raise exception 'INVALID_ADMIN_UPDATE' using errcode = '22023';
  end if;
  if p_active and p_price_uzs = 0 then
    raise exception 'ZERO_PRICE_CANNOT_BE_ACTIVE' using errcode = '22023';
  end if;

  select * into v_product
  from public.monetization_products
  where code = trim(p_product_code)
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.monetization_products
  set price_uzs = p_price_uzs,
      duration_days = p_duration_days,
      active = p_active,
      updated_at = now()
  where code = v_product.code;

  insert into public.monetization_price_audit (
    product_code, admin_user_id,
    old_price_uzs, new_price_uzs,
    old_duration_days, new_duration_days,
    old_active, new_active
  ) values (
    v_product.code, p_admin_user_id,
    v_product.price_uzs, p_price_uzs,
    v_product.duration_days, p_duration_days,
    v_product.active, p_active
  );

  return jsonb_build_object(
    'code', v_product.code,
    'old_price_uzs', v_product.price_uzs,
    'new_price_uzs', p_price_uzs,
    'old_duration_days', v_product.duration_days,
    'new_duration_days', p_duration_days,
    'old_active', v_product.active,
    'new_active', p_active
  );
end;
$$;

revoke all on function public.admin_update_monetization_product_price(text, numeric, integer, boolean, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_monetization_product_price(text, numeric, integer, boolean, uuid) to service_role;

commit;
