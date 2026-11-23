create or replace function public.protect_owner_listing_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if coalesce(auth.role(), '')='service_role' then return new; end if;
  if v_uid is null or old.owner_id<>v_uid then return new; end if;
  if new.owner_id<>old.owner_id then raise exception 'LISTING_OWNER_IMMUTABLE' using errcode='42501'; end if;
  if old.status<>new.status then
    if old.status='draft' and new.status not in ('draft','moderation') then raise exception 'INVALID_OWNER_LISTING_STATUS_TRANSITION'; end if;
    if old.status='rejected' and new.status not in ('rejected','moderation','draft') then raise exception 'INVALID_OWNER_LISTING_STATUS_TRANSITION'; end if;
    if old.status='moderation' and new.status not in ('moderation','rejected','draft') then raise exception 'INVALID_OWNER_LISTING_STATUS_TRANSITION'; end if;
    if old.status='active' and new.status not in ('active','sold','rented','archived','moderation') then raise exception 'INVALID_OWNER_LISTING_STATUS_TRANSITION'; end if;
    if old.status in ('sold','rented','archived') and new.status<>'moderation' then raise exception 'INVALID_OWNER_LISTING_STATUS_TRANSITION'; end if;
  end if;
  if old.status='active' and new.status in ('sold','rented') then new.sold_or_rented_at:=coalesce(old.sold_or_rented_at,now());new.published_at:=null;
  elsif old.status='active' and new.status='archived' then new.sold_or_rented_at:=null;new.published_at:=null;
  elsif new.status='moderation' and old.status<>'moderation' then new.submitted_at:=now();new.moderation_note:=null;new.moderation_updated_at:=null;new.is_verified:=false;new.published_at:=null;new.sold_or_rented_at:=null;
  end if;
  new.updated_at:=now(); return new;
end;
$$;
create or replace function public.transition_owner_listing_status(p_listing_id uuid,p_next_status text)
returns public.listings language plpgsql security definer set search_path=public as $$
declare v_listing public.listings%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_listing from public.listings where id=p_listing_id and owner_id=auth.uid() for update;
  if not found then raise exception 'LISTING_NOT_FOUND' using errcode='P0002'; end if;
  if p_next_status not in ('sold','rented','archived','moderation') then raise exception 'INVALID_OWNER_LISTING_STATUS'; end if;
  update public.listings set status=p_next_status where id=p_listing_id;
  select * into v_listing from public.listings where id=p_listing_id; return v_listing;
end;
$$;
revoke all on function public.transition_owner_listing_status(uuid,text) from public,anon;
grant execute on function public.transition_owner_listing_status(uuid,text) to authenticated;
