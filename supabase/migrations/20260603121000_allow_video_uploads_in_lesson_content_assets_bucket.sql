begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-content-assets',
  'lesson-content-assets',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/ogv',
    'video/quicktime',
    'video/x-m4v'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
