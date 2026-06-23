alter table public.courses
  add column if not exists hero_video_url text,
  add column if not exists logo_url text,
  add column if not exists show_reviews boolean not null default true,
  add column if not exists resource_item_ids text[] not null default '{}'::text[];

update public.courses
set
  show_reviews = coalesce(show_reviews, true),
  resource_item_ids = coalesce(resource_item_ids, '{}'::text[])
where
  show_reviews is null
  or resource_item_ids is null;

comment on column public.courses.hero_video_url is
  'Video de hero exibido na pagina publica do curso quando informado.';

comment on column public.courses.logo_url is
  'Logo do curso exibido no hero da pagina publica quando informado.';

comment on column public.courses.show_reviews is
  'Define se a secao de avaliacao e reviews aparece na pagina publica do curso.';

comment on column public.courses.resource_item_ids is
  'Lista de ids dos recursos oficiais selecionados para exibir na lateral da pagina publica do curso.';

alter table public.lessons
  add column if not exists is_free_preview boolean not null default false;

update public.lessons
set is_free_preview = coalesce(is_free_preview, false)
where is_free_preview is null;

comment on column public.lessons.is_free_preview is
  'Marca as aulas que podem aparecer no preview publico gratuito do curso.';

create or replace function public.get_public_course_free_preview(_slug text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with eligible_course as (
    select c.id, c.slug
    from public.courses c
    where c.status = 'published'
      and coalesce(c.is_public, false)
      and lower(coalesce(c.slug, '')) = lower(trim(coalesce(_slug, '')))
    limit 1
  ),
  free_lessons as (
    select
      cm.id as module_id,
      cm.title as module_title,
      cm.description as module_description,
      cm.position as module_position,
      l.id as lesson_id,
      l.title as lesson_title,
      l.description as lesson_description,
      l.lesson_type,
      l.youtube_url,
      l.text_content,
      l.estimated_minutes,
      l.position as lesson_position
    from eligible_course ec
    join public.course_modules cm on cm.course_id = ec.id
    join public.lessons l on l.module_id = cm.id
    where coalesce(l.is_free_preview, false) = true
  ),
  module_payloads as (
    select
      fl.module_id,
      fl.module_title,
      fl.module_description,
      fl.module_position,
      jsonb_agg(
        jsonb_build_object(
          'id', fl.lesson_id,
          'module_id', fl.module_id,
          'title', fl.lesson_title,
          'description', fl.lesson_description,
          'lesson_type', fl.lesson_type,
          'youtube_url', fl.youtube_url,
          'text_content', fl.text_content,
          'estimated_minutes', fl.estimated_minutes,
          'position', fl.lesson_position
        )
        order by fl.lesson_position, fl.lesson_title
      ) as lessons
    from free_lessons fl
    group by fl.module_id, fl.module_title, fl.module_description, fl.module_position
  ),
  first_free_lesson as (
    select lesson_id
    from free_lessons
    order by module_position, lesson_position, lesson_title
    limit 1
  )
  select
    jsonb_build_object(
      'course_id', ec.id,
      'course_slug', ec.slug,
      'first_free_lesson_id', (select lesson_id from first_free_lesson),
      'modules', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', mp.module_id,
              'title', mp.module_title,
              'description', mp.module_description,
              'position', mp.module_position,
              'lessons', mp.lessons
            )
            order by mp.module_position, mp.module_title
          )
          from module_payloads mp
        ),
        '[]'::jsonb
      )
    )
  from eligible_course ec;
$$;

grant execute on function public.get_public_course_free_preview(text) to anon, authenticated, service_role;
