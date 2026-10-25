create or replace function public.merge_profile_accounts(source_profile_id uuid, target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fk record;
  source_wallet public.wallet_accounts%rowtype;
  target_wallet public.wallet_accounts%rowtype;
begin
  if source_profile_id is null or target_profile_id is null or source_profile_id = target_profile_id then
    return;
  end if;

  if not exists (select 1 from public.profiles where id = source_profile_id) then
    raise exception 'SOURCE_PROFILE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'TARGET_PROFILE_NOT_FOUND';
  end if;

  update public.profiles target
  set full_name = coalesce(nullif(target.full_name, ''), source.full_name),
      company_name = coalesce(nullif(target.company_name, ''), source.company_name),
      account_type = coalesce(target.account_type, source.account_type),
      partner_type = coalesce(target.partner_type, source.partner_type),
      inn = coalesce(nullif(target.inn, ''), source.inn),
      bank_name = coalesce(nullif(target.bank_name, ''), source.bank_name),
      bank_account = coalesce(nullif(target.bank_account, ''), source.bank_account),
      mfo = coalesce(nullif(target.mfo, ''), source.mfo),
      oked = coalesce(nullif(target.oked, ''), source.oked),
      director_full_name = coalesce(nullif(target.director_full_name, ''), source.director_full_name)
  from public.profiles source
  where target.id = target_profile_id
    and source.id = source_profile_id;

  for fk in
    select
      n_child.nspname as schema_name,
      c_child.relname as table_name,
      a_child.attname as column_name
    from pg_constraint c
    join pg_class c_child on c_child.oid = c.conrelid
    join pg_namespace n_child on n_child.oid = c_child.relnamespace
    join pg_attribute a_child on a_child.attrelid = c.conrelid and a_child.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and array_length(c.conkey, 1) = 1
      and array_length(c.confkey, 1) = 1
      and c.conkey[1] = a_child.attnum
      and c.conrelid <> 'public.profiles'::regclass
    order by n_child.nspname, c_child.relname, a_child.attname
  loop
    execute format(
      'update %I.%I set %I = $1 where %I = $2',
      fk.schema_name, fk.table_name, fk.column_name, fk.column_name
    ) using target_profile_id, source_profile_id;
  end loop;

  if to_regclass('public.wallet_accounts') is not null then
    select * into source_wallet from public.wallet_accounts where user_id = source_profile_id;
    select * into target_wallet from public.wallet_accounts where user_id = target_profile_id;

    if source_wallet.id is not null then
      if target_wallet.id is null then
        update public.wallet_accounts set user_id = target_profile_id where id = source_wallet.id;
      else
        update public.wallet_transactions
        set wallet_id = target_wallet.id,
            user_id = target_profile_id
        where wallet_id = source_wallet.id or user_id = source_profile_id;

        update public.wallet_accounts
        set balance = balance + source_wallet.balance
        where id = target_wallet.id;

        delete from public.wallet_accounts where id = source_wallet.id;
      end if;
    end if;
  end if;

  for fk in
    select
      n_child.nspname as schema_name,
      c_child.relname as table_name,
      a_child.attname as column_name
    from pg_constraint c
    join pg_class c_child on c_child.oid = c.conrelid
    join pg_namespace n_child on n_child.oid = c_child.relnamespace
    join pg_attribute a_child on a_child.attrelid = c.conrelid and a_child.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and array_length(c.conkey, 1) = 1
      and array_length(c.confkey, 1) = 1
      and c.conkey[1] = a_child.attnum
      and c.conrelid not in ('public.profiles'::regclass, 'public.wallet_accounts'::regclass, 'public.wallet_transactions'::regclass)
    order by n_child.nspname, c_child.relname, a_child.attname
  loop
    execute format(
      'update %I.%I set %I = $1 where %I = $2',
      fk.schema_name, fk.table_name, fk.column_name, fk.column_name
    ) using target_profile_id, source_profile_id;
  end loop;
end;
$$;

revoke all on function public.merge_profile_accounts(uuid, uuid) from public;
grant execute on function public.merge_profile_accounts(uuid, uuid) to service_role;
