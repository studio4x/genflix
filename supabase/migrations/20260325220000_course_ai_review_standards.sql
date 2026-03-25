begin;

create table if not exists public.course_ai_review_standards (
  course_id uuid primary key references public.courses (id) on delete cascade,
  ideal_course_structure text,
  required_elements text,
  bibliography_rules text,
  table_formatting_rules text,
  additional_review_rules text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null
);

grant select, insert, update on public.course_ai_review_standards to authenticated;
grant all on public.course_ai_review_standards to service_role;

alter table public.course_ai_review_standards enable row level security;

drop policy if exists "course_ai_review_standards_admin_read_all" on public.course_ai_review_standards;
create policy "course_ai_review_standards_admin_read_all"
on public.course_ai_review_standards
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_ai_review_standards_admin_insert" on public.course_ai_review_standards;
create policy "course_ai_review_standards_admin_insert"
on public.course_ai_review_standards
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_ai_review_standards_admin_update" on public.course_ai_review_standards;
create policy "course_ai_review_standards_admin_update"
on public.course_ai_review_standards
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_ai_review_standards_service_role_all" on public.course_ai_review_standards;
create policy "course_ai_review_standards_service_role_all"
on public.course_ai_review_standards
for all
to service_role
using (true)
with check (true);

drop trigger if exists set_course_ai_review_standards_updated_at on public.course_ai_review_standards;
create trigger set_course_ai_review_standards_updated_at
before update on public.course_ai_review_standards
for each row
execute procedure public.set_updated_at();

commit;
