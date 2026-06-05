begin;

alter table public.lesson_footer_actions
  add column if not exists scope text not null default 'lesson',
  add column if not exists course_id uuid references public.courses (id) on delete cascade,
  add column if not exists module_id uuid references public.course_modules (id) on delete cascade;

alter table public.lesson_footer_actions
  alter column lesson_id drop not null;

do $$
begin
  alter table public.lesson_footer_actions
    add constraint lesson_footer_actions_scope_context_check
    check (
      (
        scope = 'lesson'
        and lesson_id is not null
        and module_id is null
        and course_id is null
      )
      or (
        scope = 'module'
        and module_id is not null
        and lesson_id is null
        and course_id is null
      )
      or (
        scope = 'course'
        and course_id is not null
        and lesson_id is null
        and module_id is null
      )
    );
exception
  when duplicate_object then null;
end $$;

drop index if exists lesson_footer_actions_lesson_position_idx;
create unique index if not exists lesson_footer_actions_lesson_position_idx
  on public.lesson_footer_actions (lesson_id, position)
  where scope = 'lesson';

create unique index if not exists lesson_footer_actions_module_position_idx
  on public.lesson_footer_actions (module_id, position)
  where scope = 'module';

create unique index if not exists lesson_footer_actions_course_position_idx
  on public.lesson_footer_actions (course_id, position)
  where scope = 'course';

create index if not exists lesson_footer_actions_module_id_idx
  on public.lesson_footer_actions (module_id);

create index if not exists lesson_footer_actions_course_id_idx
  on public.lesson_footer_actions (course_id);

drop policy if exists "lesson_footer_actions_student_select" on public.lesson_footer_actions;
create policy "lesson_footer_actions_student_select"
on public.lesson_footer_actions
for select
to authenticated
using (
  is_active = true
  and public.has_role(auth.uid(), 'student')
  and (
    (
      scope = 'lesson'
      and exists (
        select 1
        from public.lessons l
        join public.course_modules cm on cm.id = l.module_id
        join public.courses c on c.id = cm.course_id
        where l.id = lesson_footer_actions.lesson_id
          and c.status = 'published'
          and public.is_course_released(auth.uid(), c.id)
          and public.is_module_unlocked(auth.uid(), cm.id)
          and public.is_lesson_unlocked(auth.uid(), l.id)
      )
    )
    or (
      scope = 'module'
      and exists (
        select 1
        from public.course_modules cm
        join public.courses c on c.id = cm.course_id
        where cm.id = lesson_footer_actions.module_id
          and c.status = 'published'
          and public.is_course_released(auth.uid(), c.id)
          and public.is_module_unlocked(auth.uid(), cm.id)
      )
    )
    or (
      scope = 'course'
      and exists (
        select 1
        from public.courses c
        where c.id = lesson_footer_actions.course_id
          and c.status = 'published'
          and public.is_course_released(auth.uid(), c.id)
      )
    )
  )
);

commit;
