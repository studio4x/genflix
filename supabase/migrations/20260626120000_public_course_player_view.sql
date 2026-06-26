create or replace function public.get_public_course_player_view(_slug text)
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
  module_base as (
    select
      cm.id,
      cm.title,
      cm.description,
      cm.position,
      cm.is_required,
      cm.starts_at,
      cm.ends_at,
      public.is_module_scheduled_open(cm.id) as is_scheduled_open
    from public.course_modules cm
    join eligible_course ec on ec.id = cm.course_id
  ),
  lesson_base as (
    select
      l.id as lesson_id,
      l.module_id,
      mb.position as module_position,
      l.title,
      l.description,
      l.position,
      l.is_required,
      l.lesson_type,
      l.youtube_url,
      l.text_content,
      l.estimated_minutes,
      l.starts_at,
      l.ends_at,
      coalesce(l.is_free_preview, false) as is_free_preview,
      public.is_lesson_scheduled_open(l.id) as is_scheduled_open
    from public.lessons l
    join module_base mb on mb.id = l.module_id
  ),
  first_lessons as (
    select lesson_id
    from lesson_base
    order by module_position, position, title
    limit 1
  ),
  first_accessible_lessons as (
    select lesson_id
    from lesson_base
    where is_free_preview = true
      and is_scheduled_open = true
      and exists (
        select 1
        from module_base mb
        where mb.id = lesson_base.module_id
          and mb.is_scheduled_open = true
      )
    order by module_position, position, title
    limit 1
  ),
  assembled_modules as (
    select
      mb.position,
      jsonb_build_object(
        'id', mb.id,
        'title', mb.title,
        'description', mb.description,
        'position', mb.position,
        'is_required', mb.is_required,
        'is_unlocked', mb.is_scheduled_open,
        'starts_at', mb.starts_at,
        'ends_at', mb.ends_at,
        'lessons', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', lb.lesson_id,
                'module_id', lb.module_id,
                'title', lb.title,
                'description', lb.description,
                'position', lb.position,
                'is_required', lb.is_required,
                'lesson_type', lb.lesson_type,
                'youtube_url', lb.youtube_url,
                'text_content', lb.text_content,
                'estimated_minutes', lb.estimated_minutes,
                'starts_at', lb.starts_at,
                'ends_at', lb.ends_at,
                'is_free_preview', lb.is_free_preview,
                'is_unlocked', lb.is_free_preview and lb.is_scheduled_open and mb.is_scheduled_open
              )
              order by lb.position, lb.title
            )
            from lesson_base lb
            where lb.module_id = mb.id
          ),
          '[]'::jsonb
        )
      ) as payload
    from module_base mb
  )
  select jsonb_build_object(
    'course_id', ec.id,
    'course_slug', ec.slug,
    'first_lesson_id', (select lesson_id from first_lessons),
    'first_accessible_lesson_id', (select lesson_id from first_accessible_lessons),
    'modules', coalesce(
      (
        select jsonb_agg(payload order by position)
        from assembled_modules
      ),
      '[]'::jsonb
    )
  )
  from eligible_course ec;
$$;

grant execute on function public.get_public_course_player_view(text) to anon, authenticated, service_role;
