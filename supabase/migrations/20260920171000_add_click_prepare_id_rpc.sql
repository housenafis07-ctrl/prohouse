begin;

create or replace function public.allocate_click_prepare_id()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.monetization_click_prepare_seq');
$$;

revoke all on function public.allocate_click_prepare_id() from public, anon, authenticated;
grant execute on function public.allocate_click_prepare_id() to service_role;

commit;
