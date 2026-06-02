begin;

create table if not exists public.assessment_case_studies (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  title text,
  case_text text not null check (length(trim(case_text)) >= 10),
  position integer not null check (position > 0),
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create index if not exists assessment_case_studies_assessment_id_idx
  on public.assessment_case_studies (assessment_id);

create unique index if not exists assessment_case_studies_assessment_position_idx
  on public.assessment_case_studies (assessment_id, position);

alter table public.assessment_case_studies enable row level security;

grant select, insert, update, delete on public.assessment_case_studies to authenticated;
grant all on public.assessment_case_studies to service_role;

drop trigger if exists set_assessment_case_studies_updated_at on public.assessment_case_studies;
create trigger set_assessment_case_studies_updated_at
before update on public.assessment_case_studies
for each row
execute procedure public.set_updated_at();

drop policy if exists "assessment_case_studies_admin_all" on public.assessment_case_studies;
create policy "assessment_case_studies_admin_all"
on public.assessment_case_studies
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_case_studies_student_select_available" on public.assessment_case_studies;
create policy "assessment_case_studies_student_select_available"
on public.assessment_case_studies
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_case_studies.assessment_id
      and a.is_active = true
      and public.is_course_released(auth.uid(), a.course_id)
      and (
        (a.assessment_type = 'module' and a.module_id is not null and public.is_module_unlocked(auth.uid(), a.module_id))
        or (a.assessment_type = 'final' and public.are_required_modules_completed(auth.uid(), a.course_id))
      )
  )
);

drop policy if exists "assessment_case_studies_service_role_all" on public.assessment_case_studies;
create policy "assessment_case_studies_service_role_all"
on public.assessment_case_studies
for all
to service_role
using (true)
with check (true);

alter table public.assessment_questions
  add column if not exists case_study_id uuid references public.assessment_case_studies (id) on delete cascade,
  add column if not exists case_question_position integer;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_assessment_id_position_key;

drop index if exists public.assessment_questions_assessment_id_position_key;

create unique index if not exists assessment_questions_standalone_position_idx
  on public.assessment_questions (assessment_id, position)
  where case_study_id is null;

create unique index if not exists assessment_questions_case_position_idx
  on public.assessment_questions (case_study_id, case_question_position)
  where case_study_id is not null;

create index if not exists assessment_questions_case_study_id_idx
  on public.assessment_questions (case_study_id);

alter table public.assessment_questions
  drop constraint if exists assessment_questions_question_type_check;

alter table public.assessment_questions
  add constraint assessment_questions_question_type_check
    check (question_type in ('single_choice', 'essay_ai', 'case_study_ai', 'case_study_single_choice'));

alter table public.assessment_questions
  drop constraint if exists assessment_questions_case_question_position_check;

alter table public.assessment_questions
  add constraint assessment_questions_case_question_position_check
    check (case_question_position is null or case_question_position > 0);

alter table public.assessment_questions
  drop constraint if exists assessment_questions_type_rules_check;

alter table public.assessment_questions
  add constraint assessment_questions_type_rules_check
    check (
      (
        question_type = 'single_choice'
        and points > 0
        and case_study_id is null
        and case_question_position is null
      )
      or (
        question_type = 'essay_ai'
        and points = 0
        and length(trim(coalesce(essay_expected_answer, ''))) >= 2
        and case_study_id is null
        and case_question_position is null
      )
      or (
        question_type = 'case_study_ai'
        and points > 0
        and length(trim(coalesce(essay_expected_answer, ''))) >= 2
        and case_study_id is not null
        and case_question_position is not null
      )
      or (
        question_type = 'case_study_single_choice'
        and points > 0
        and case_study_id is not null
        and case_question_position is not null
      )
    );

commit;
