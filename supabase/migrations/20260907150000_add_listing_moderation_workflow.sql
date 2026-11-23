alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check check (status = any (array['draft'::text,'moderation'::text,'active'::text,'reserved'::text,'sold'::text,'rented'::text,'rejected'::text,'archived'::text]));

alter table public.listings replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end $$;
