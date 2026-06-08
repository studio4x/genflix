alter table public.courses
  add column if not exists student_hero_image_url text;

update public.courses
set student_hero_image_url = coalesce(
  nullif(trim(student_hero_image_url), ''),
  nullif(trim(cover_image_url), ''),
  nullif(trim(thumbnail_url), '')
)
where
  student_hero_image_url is null
  or trim(coalesce(student_hero_image_url, '')) = ''
  or student_hero_image_url is distinct from coalesce(
    nullif(trim(cover_image_url), ''),
    nullif(trim(thumbnail_url), '')
  );
