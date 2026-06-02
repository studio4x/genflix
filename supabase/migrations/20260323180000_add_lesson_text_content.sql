alter table public.lessons add column text_content text;
alter table public.lessons drop constraint if exists lessons_lesson_type_check;
alter table public.lessons add constraint lessons_lesson_type_check check (lesson_type in ('video', 'text'));

create or replace function public.get_student_unlocked_lessons_progress(_course_id uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  module_position integer,
  lesson_position integer,
  title text,
  description text,
  is_required boolean,
  lesson_type text,
  youtube_url text,
  text_content text,
  estimated_minutes integer,
  is_completed boolean,
  completed_at timest?mptz
)
language sql
stable
security definer
set search_path = public
as \$\$
  with ctx_user as (
    select auth.uid() as user_id
  ),
  allowed as (
    select 1
    from ctx_user cu
    where cu.user_id is not null
      and public.has_role(cu.user_id, 'student')
      and public.is_course_released(cu.user_id, _course_id)
  )
  select
    l.id as lesson_id,
    cm.id as module_id,
    cm.position as module_position,
    l.position as lesson_position,
    l.title,
    l.description,
    l.is_required,
    l.lesson_type,
    l.youtube_url,
    l.text_content,
    l.estimated_minutes,
    coalesce(lp.is_completed, false) as is_completed,
    lp.completed_at
  from public.course_modules cm
  join public.lessons l on l.module_id = cm.id
  join ctx_user cu on true
  left join public.lesson_progress lp
    on lp.lesson_id = l.id
    and lp.user_id = cu.user_id
  where cm.course_id = _course_id
    and public.is_module_unlocked(cu.user_id, cm.id)
    and exists (select 1 from allowed)
  order by cm.position asc, l.position asc;
\$\$;