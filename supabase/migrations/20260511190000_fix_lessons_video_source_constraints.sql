begin;

alter table public.lessons
  drop constraint if exists lessons_lesson_type_check;

alter table public.lessons
  add constraint lessons_lesson_type_check
  check (lesson_type in ('video', 'text', 'hybrid', 'file'));

alter table public.lessons
  drop constraint if exists lessons_youtube_url_check;

alter table public.lessons
  add constraint lessons_youtube_url_check
  check (
    youtube_url is null
    or btrim(youtube_url) = ''
    or youtube_url ~* '^(asset:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(https?:\/\/)[^\s]+\.(mp4|webm|ogg|ogv|m4v|mov)(\?.*)?(#.*)?|((https?:\/\/)?(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\/.+))$'
  );

commit;
