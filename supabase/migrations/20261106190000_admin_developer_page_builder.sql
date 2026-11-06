create table if not exists public.admin_developer_page_drafts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_email text,
  contact_phone text,
  page_content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','handed_off')),
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  handed_off_to uuid references auth.users(id) on delete set null,
  handed_off_by uuid references auth.users(id) on delete set null,
  handed_off_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_developer_page_drafts_status_idx
  on public.admin_developer_page_drafts(status, updated_at desc);
create index if not exists admin_developer_page_drafts_profile_idx
  on public.admin_developer_page_drafts(developer_profile_id);

alter table public.admin_developer_page_drafts enable row level security;
revoke all on public.admin_developer_page_drafts from anon, authenticated;
grant all on public.admin_developer_page_drafts to service_role;

insert into public.admin_permissions (code, name_uz)
values ('developer_pages.manage', 'Developer sahifalarini yaratish va topshirish')
on conflict (code) do update set name_uz = excluded.name_uz;
