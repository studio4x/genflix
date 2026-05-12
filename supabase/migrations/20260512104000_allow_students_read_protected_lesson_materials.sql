begin;

drop policy if exists "lesson_materials_student_released_select" on public.lesson_materials;
create policy "lesson_materials_student_released_select"
on public.lesson_materials
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where l.id = lesson_materials.lesson_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
  )
);

drop policy if exists "materials_student_released_select" on storage.objects;
create policy "materials_student_released_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.lesson_materials lm
    join public.lessons l on l.id = lm.lesson_id
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where lm.storage_path = storage.objects.name
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
  )
);

commit;
