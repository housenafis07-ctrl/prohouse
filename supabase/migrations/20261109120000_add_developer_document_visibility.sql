-- Add admin-controlled public/private visibility to developer complex documents.
-- Keep the existing private bucket and signed-URL delivery model unchanged.
alter table public.developer_complex_documents
  add column if not exists requested_visibility_scope text not null default 'admin_only',
  add column if not exists visibility_scope text not null default 'admin_only';

alter table public.developer_complex_documents
  drop constraint if exists developer_complex_documents_requested_visibility_scope_check;
alter table public.developer_complex_documents
  add constraint developer_complex_documents_requested_visibility_scope_check
  check (requested_visibility_scope in ('public', 'admin_only'));

alter table public.developer_complex_documents
  drop constraint if exists developer_complex_documents_visibility_scope_check;
alter table public.developer_complex_documents
  add constraint developer_complex_documents_visibility_scope_check
  check (visibility_scope in ('public', 'admin_only'));

-- Preserve the current public behavior of documents that were already approved.
-- New uploads remain private until an administrator explicitly approves visibility.
update public.developer_complex_documents
set requested_visibility_scope = 'public',
    visibility_scope = 'public'
where moderation_status = 'approved'
  and requested_visibility_scope = 'admin_only'
  and visibility_scope = 'admin_only';

comment on column public.developer_complex_documents.requested_visibility_scope is
  'Visibility requested by the developer; does not grant public access.';
comment on column public.developer_complex_documents.visibility_scope is
  'Final visibility set by an administrator. Public documents still use short-lived signed URLs from the private bucket.';
