-- Developer complex media: verified documents stay private and require admin review.
-- Construction updates are public immediately after upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('developer-complex-documents', 'developer-complex-documents', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('developer-construction-media', 'developer-construction-media', true, 524288000, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true;

create table if not exists public.developer_complex_documents (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.residential_complexes(id) on delete cascade,
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  document_type text not null check (document_type in ('land_rights','construction_permit','project_approval','expertise_conclusion','builder_license','commissioning_certificate','other')),
  title varchar(180) not null,
  document_number varchar(120),
  issued_at date,
  expires_at date,
  storage_path text not null unique,
  mime_type varchar(100) not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','expired')),
  moderation_note text,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists developer_complex_documents_complex_idx on public.developer_complex_documents(complex_id, created_at desc);
create index if not exists developer_complex_documents_developer_idx on public.developer_complex_documents(developer_id, moderation_status);

create table if not exists public.developer_construction_updates (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.residential_complexes(id) on delete cascade,
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  building_id uuid references public.residential_buildings(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  media_type text not null check (media_type in ('image','video')),
  storage_path text not null unique,
  public_url text not null,
  caption varchar(1200),
  construction_stage text not null check (construction_stage in ('foundation','structure','facade','interior','landscaping','completed','other')),
  captured_at date not null default current_date,
  created_at timestamptz not null default now(),
  is_visible boolean not null default true,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles(id) on delete set null,
  moderation_note text,
  constraint construction_update_media_url check (length(public_url) > 8)
);
create index if not exists developer_construction_updates_complex_idx on public.developer_construction_updates(complex_id, captured_at desc, created_at desc) where is_visible = true;
create index if not exists developer_construction_updates_developer_idx on public.developer_construction_updates(developer_id, created_at desc);

alter table public.developer_complex_documents enable row level security;
alter table public.developer_construction_updates enable row level security;
revoke all on public.developer_complex_documents from anon, authenticated;
revoke all on public.developer_construction_updates from anon, authenticated;
grant all on public.developer_complex_documents to service_role;
grant all on public.developer_construction_updates to service_role;

drop policy if exists "Public read construction media" on storage.objects;
create policy "Public read construction media" on storage.objects for select to anon, authenticated
using (bucket_id = 'developer-construction-media');
