-- Harden the wallet promotion RPC: only promotion products can be purchased here,
-- and partner plan entitlements remain enforced even when paying from bonus credits.
create or replace function public.purchase_listing_promotion(p_listing_id uuid, p_product_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  w public.wallet_accounts%rowtype;
  p public.monetization_products%rowtype;
  current_end timestamptz;
  new_end timestamptz;
  tx_id uuid;
  bonus_used numeric(18,2);
  cash_used numeric(18,2);
  bonus_after numeric(18,2);
  cash_after numeric(18,2);
  v_account_type text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.listings where id=p_listing_id and owner_id=uid) then raise exception 'LISTING_NOT_OWNED'; end if;
  select * into p from public.monetization_products where code=p_product_code and active=true;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p.product_type not in ('top','up','highlight','premium') then raise exception 'PROMOTION_PRODUCT_REQUIRED'; end if;
  select account_type into v_account_type from public.profiles where id=uid;
  if coalesce(v_account_type,'')='partner' and not public.partner_plan_has_feature(uid,'promo_tools') then
    raise exception 'PARTNER_PROMO_TOOLS_REQUIRED: PRO yoki BUSINESS tarifi kerak.' using errcode='check_violation';
  end if;
  select * into w from public.wallet_accounts where user_id=uid and status='active' for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  bonus_used:=least(w.bonus_balance,p.price_uzs);
  cash_used:=p.price_uzs-bonus_used;
  if w.balance < cash_used then raise exception 'INSUFFICIENT_BALANCE'; end if;
  bonus_after:=w.bonus_balance-bonus_used;
  cash_after:=w.balance-cash_used;

  update public.wallet_accounts set balance=cash_after,bonus_balance=bonus_after where id=w.id;
  if bonus_used>0 then
    insert into public.wallet_bonus_transactions(wallet_id,user_id,amount,balance_after,type,description)
      values(w.id,uid,bonus_used,bonus_after,'promotion_purchase','E’lonni ilgari surish: '||p.name);
  end if;
  if cash_used>0 then
    insert into public.wallet_transactions(wallet_id,user_id,listing_id,type,amount,balance_after,description,status,provider)
      values(w.id,uid,p_listing_id,'purchase',cash_used,cash_after,'Promotion: '||p.name,'completed','wallet')
      returning id into tx_id;
  end if;

  select promoted_until into current_end from public.listings where id=p_listing_id;
  new_end:=greatest(coalesce(current_end,now()),now())+make_interval(days=>p.duration_days);
  update public.listings set promoted_until=new_end,promotion_rank=greatest(promotion_rank,p.boost_rank),promotion_badge=p.badge,is_featured=(p.boost_rank>=60) where id=p_listing_id;
  insert into public.listing_promotions(user_id,listing_id,product_code,price_paid_uzs,starts_at,ends_at,status,transaction_id)
    values(uid,p_listing_id,p.code,p.price_uzs,now(),new_end,'active',tx_id);
  return jsonb_build_object('ok',true,'ends_at',new_end,'balance',cash_after,'bonus_balance',bonus_after,'transaction_id',tx_id);
end;
$$;
revoke all on function public.purchase_listing_promotion(uuid,text) from public;
grant execute on function public.purchase_listing_promotion(uuid,text) to authenticated;
