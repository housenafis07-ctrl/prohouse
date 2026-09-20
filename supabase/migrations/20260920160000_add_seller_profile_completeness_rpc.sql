begin;

create or replace function public.get_seller_profile_completeness()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles%rowtype;
  required_total integer := 0;
  completed_total integer := 0;
  items jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;

  items := items || jsonb_build_array(jsonb_build_object('code','phone','label','Telefon raqami','required',true,'completed',nullif(trim(coalesce(p.phone,'')),'') is not null));
  items := items || jsonb_build_array(jsonb_build_object('code','full_name','label','F.I.O.','required',true,'completed',nullif(trim(coalesce(p.full_name,'')),'') is not null));
  required_total := 2;
  completed_total := (case when nullif(trim(coalesce(p.phone,'')),'') is not null then 1 else 0 end) + (case when nullif(trim(coalesce(p.full_name,'')),'') is not null then 1 else 0 end);

  if p.account_type = 'partner' then
    items := items || jsonb_build_array(jsonb_build_object('code','inn','label','INN','required',true,'completed',nullif(trim(coalesce(p.inn,'')),'') is not null));
    required_total := required_total + 1;
    completed_total := completed_total + (case when nullif(trim(coalesce(p.inn,'')),'') is not null then 1 else 0 end);

    if p.partner_type = 'llc' then
      items := items || jsonb_build_array(jsonb_build_object('code','company_name','label','Tashkilot nomi','required',true,'completed',nullif(trim(coalesce(p.company_name,'')),'') is not null));
      items := items || jsonb_build_array(jsonb_build_object('code','director_full_name','label','Rahbar F.I.O.','required',true,'completed',nullif(trim(coalesce(p.director_full_name,'')),'') is not null));
      required_total := required_total + 2;
      completed_total := completed_total + (case when nullif(trim(coalesce(p.company_name,'')),'') is not null then 1 else 0 end) + (case when nullif(trim(coalesce(p.director_full_name,'')),'') is not null then 1 else 0 end);
    end if;

    items := items || jsonb_build_array(jsonb_build_object('code','bank_account','label','Hisob raqami','required',true,'completed',nullif(trim(coalesce(p.bank_account,'')),'') is not null));
    items := items || jsonb_build_array(jsonb_build_object('code','mfo','label','MFO','required',true,'completed',nullif(trim(coalesce(p.mfo,'')),'') is not null));
    required_total := required_total + 2;
    completed_total := completed_total + (case when nullif(trim(coalesce(p.bank_account,'')),'') is not null then 1 else 0 end) + (case when nullif(trim(coalesce(p.mfo,'')),'') is not null then 1 else 0 end);
  end if;

  items := items || jsonb_build_array(jsonb_build_object('code','verification','label','Profil verifikatsiyasi','required',false,'completed',p.verification_status = 'verified'));
  items := items || jsonb_build_array(jsonb_build_object('code','trusted_profile','label','Ishonchli profil','required',false,'completed',coalesce(p.trusted_profile,false)));

  return jsonb_build_object('account_type',p.account_type,'partner_type',p.partner_type,'required_total',required_total,'completed_total',completed_total,'completion_percent',case when required_total=0 then 0 else round(completed_total::numeric * 100 / required_total)::integer end,'items',items);
end;
$$;

revoke all on function public.get_seller_profile_completeness() from public, anon;
grant execute on function public.get_seller_profile_completeness() to authenticated;

commit;
