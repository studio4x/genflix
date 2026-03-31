begin;

grant select on public.courses to anon;

drop policy if exists "courses_anon_published_select" on public.courses;
create policy "courses_anon_published_select"
on public.courses
for select
to anon
using (status = 'published');

commit;
