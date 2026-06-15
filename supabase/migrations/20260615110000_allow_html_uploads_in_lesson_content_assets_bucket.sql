begin;

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/gif',
    'image/avif',
    'image/bmp',
    'image/tiff',
    'image/vnd.microsoft.icon',
    'image/x-icon',
    'image/heic',
    'image/heif',
    'image/jxl',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/ogv',
    'video/quicktime',
    'video/x-m4v',
    'text/html',
    'application/xhtml+xml'
  ]
where id = 'lesson-content-assets';

commit;
