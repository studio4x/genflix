begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-content-assets',
  'lesson-content-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lesson_content_assets_authenticated_select" on storage.objects;
create policy "lesson_content_assets_authenticated_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'lesson-content-assets');

drop policy if exists "lesson_content_assets_admin_insert" on storage.objects;
create policy "lesson_content_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-content-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_content_assets_admin_update" on storage.objects;
create policy "lesson_content_assets_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-content-assets'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'lesson-content-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_content_assets_admin_delete" on storage.objects;
create policy "lesson_content_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-content-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_content_assets_service_role_all" on storage.objects;
create policy "lesson_content_assets_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'lesson-content-assets')
with check (bucket_id = 'lesson-content-assets');

commit;
