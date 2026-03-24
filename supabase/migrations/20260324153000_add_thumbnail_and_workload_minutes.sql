begin;

-- Add thumbnail_url to courses if not exists
alter table public.courses add column if not exists thumbnail_url text;

-- Rename workload_hours to workload_minutes
alter table public.courses rename column workload_hours to workload_minutes;

-- Create public thumbnails bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails',
  'thumbnails',
  true,
  10485760, -- 10MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true;

-- Policies for thumbnails
drop policy if exists "thumbnails_public_select" on storage.objects;
create policy "thumbnails_public_select"
on storage.objects for select
using (bucket_id = 'thumbnails');

drop policy if exists "thumbnails_admin_insert" on storage.objects;
create policy "thumbnails_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'thumbnails'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "thumbnails_admin_update" on storage.objects;
create policy "thumbnails_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'thumbnails'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'thumbnails'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "thumbnails_admin_delete" on storage.objects;
create policy "thumbnails_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'thumbnails'
  and public.has_role(auth.uid(), 'admin')
);

commit;
