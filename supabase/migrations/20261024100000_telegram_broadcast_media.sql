begin;

create table if not exists public.telegram_broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  button_text text,
  button_url text,
  audience text not null check (audience in ('all','buyers','listings','realtors','trusted')),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  media_url text,
  media_type text check (media_type in ('image','video')),
  media_name text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.telegram_broadcast_campaigns add column if not exists media_url text;
alter table public.telegram_broadcast_campaigns add column if not exists media_type text;
alter table public.telegram_broadcast_campaigns add column if not exists media_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'telegram-media',
  'telegram-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']::text[];

commit;
