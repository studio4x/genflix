alter table public.courses
  add column if not exists cover_image_url text;

update public.courses
set
  cover_image_url = coalesce(nullif(trim(cover_image_url), ''), nullif(trim(thumbnail_url), '')),
  thumbnail_url = coalesce(nullif(trim(thumbnail_url), ''), nullif(trim(cover_image_url), ''))
where
  cover_image_url is distinct from thumbnail_url
  or cover_image_url is null
  or thumbnail_url is null;
