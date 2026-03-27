begin;

create table if not exists public.assessment_question_interactions (
  question_id uuid primary key references public.assessment_questions (id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assessment_question_answer_keys (
  question_id uuid primary key references public.assessment_questions (id) on delete cascade,
  grading_mode text not null default 'partial_by_item' check (grading_mode in ('partial_by_item', 'all_or_nothing')),
  answer_key jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists assessment_question_interactions_version_idx
  on public.assessment_question_interactions (version);

create index if not exists assessment_question_answer_keys_grading_mode_idx
  on public.assessment_question_answer_keys (grading_mode);

grant select, insert, update, delete on public.assessment_question_interactions to authenticated;
grant select, insert, update, delete on public.assessment_question_answer_keys to authenticated;
grant all on public.assessment_question_interactions to service_role;
grant all on public.assessment_question_answer_keys to service_role;

alter table public.assessment_question_interactions enable row level security;
alter table public.assessment_question_answer_keys enable row level security;

drop trigger if exists set_assessment_question_interactions_updated_at on public.assessment_question_interactions;
create trigger set_assessment_question_interactions_updated_at
before update on public.assessment_question_interactions
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_assessment_question_answer_keys_updated_at on public.assessment_question_answer_keys;
create trigger set_assessment_question_answer_keys_updated_at
before update on public.assessment_question_answer_keys
for each row
execute procedure public.set_updated_at();

drop policy if exists "assessment_question_interactions_admin_all" on public.assessment_question_interactions;
create policy "assessment_question_interactions_admin_all"
on public.assessment_question_interactions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_question_interactions_service_role_all" on public.assessment_question_interactions;
create policy "assessment_question_interactions_service_role_all"
on public.assessment_question_interactions
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_question_answer_keys_admin_all" on public.assessment_question_answer_keys;
create policy "assessment_question_answer_keys_admin_all"
on public.assessment_question_answer_keys
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_question_answer_keys_service_role_all" on public.assessment_question_answer_keys;
create policy "assessment_question_answer_keys_service_role_all"
on public.assessment_question_answer_keys
for all
to service_role
using (true)
with check (true);

alter table public.assessment_questions
  drop constraint if exists assessment_questions_question_type_check;

alter table public.assessment_questions
  add constraint assessment_questions_question_type_check
    check (
      question_type in (
        'single_choice',
        'essay_ai',
        'case_study_ai',
        'case_study_single_choice',
        'drag_drop_labeling',
        'fill_in_the_blanks'
      )
    );

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
      or (
        question_type = 'drag_drop_labeling'
        and points > 0
        and case_study_id is null
        and case_question_position is null
      )
      or (
        question_type = 'fill_in_the_blanks'
        and points > 0
        and case_study_id is null
        and case_question_position is null
      )
    );

alter table public.assessment_answers
  add column if not exists response_payload jsonb,
  add column if not exists earned_points numeric(10, 2) not null default 0;

alter table public.assessment_answers
  drop constraint if exists assessment_answers_response_payload_check;

alter table public.assessment_answers
  add constraint assessment_answers_response_payload_check
    check (response_payload is null or jsonb_typeof(response_payload) = 'object');

alter table public.assessment_answers
  drop constraint if exists assessment_answers_earned_points_check;

alter table public.assessment_answers
  add constraint assessment_answers_earned_points_check
    check (earned_points >= 0);

alter table public.assessment_attempts
  add column if not exists earned_points numeric(10, 2) not null default 0,
  add column if not exists possible_points numeric(10, 2) not null default 0;

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_earned_points_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_earned_points_check
    check (earned_points >= 0);

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_possible_points_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_possible_points_check
    check (possible_points >= 0);

update public.assessment_answers
set earned_points = case when coalesce(is_correct, false) then 1 else 0 end
where earned_points = 0;

update public.assessment_attempts
set
  earned_points = coalesce(correct_answers, 0),
  possible_points = coalesce(total_questions, 0)
where earned_points = 0
  and possible_points = 0;

drop policy if exists "assessment_questions_student_select_available" on public.assessment_questions;
drop policy if exists "assessment_options_student_select_available" on public.assessment_options;
drop policy if exists "assessment_case_studies_student_select_available" on public.assessment_case_studies;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-assets',
  'assessment-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "assessment_assets_admin_select" on storage.objects;
create policy "assessment_assets_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assessment-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "assessment_assets_admin_insert" on storage.objects;
create policy "assessment_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assessment-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "assessment_assets_admin_update" on storage.objects;
create policy "assessment_assets_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'assessment-assets'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'assessment-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "assessment_assets_admin_delete" on storage.objects;
create policy "assessment_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assessment-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "assessment_assets_service_role_all" on storage.objects;
create policy "assessment_assets_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'assessment-assets')
with check (bucket_id = 'assessment-assets');

commit;
