begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-audio',
  'lesson-audio',
  false,
  52428800,
  array['audio/mpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lesson_audio_service_role_all" on storage.objects;
create policy "lesson_audio_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'lesson-audio')
with check (bucket_id = 'lesson-audio');

commit;
