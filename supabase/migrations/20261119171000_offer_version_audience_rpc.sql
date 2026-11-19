create or replace function public.create_offer_version(
  p_version integer,
  p_title text,
  p_content text,
  p_audience text default 'public'
)
returns public.offer_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offer_versions;
  v_audience text := case when p_audience = 'partner' then 'partner' else 'public' end;
begin
  if p_version is null or p_version < 1 then
    raise exception 'INVALID_OFFER_VERSION' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'OFFER_CONTENT_REQUIRED' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('prohouse.offer_versions.' || v_audience, 0));

  update public.offer_versions
  set is_active = false
  where audience = v_audience and is_active = true;

  insert into public.offer_versions(version, title, content, audience, is_active)
  values (p_version, coalesce(nullif(btrim(p_title), ''), 'Ommaviy oferta'), btrim(p_content), v_audience, true)
  returning * into v_offer;

  return v_offer;
end;
$$;

revoke all on function public.create_offer_version(integer, text, text) from public, anon, authenticated;
revoke all on function public.create_offer_version(integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_offer_version(integer, text, text, text) to service_role;
