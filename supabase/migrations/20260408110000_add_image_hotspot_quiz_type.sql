begin;

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
      'fill_in_the_blanks',
      'image_hotspot',
      'coloring'
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
      or (
        question_type = 'image_hotspot'
        and points > 0
        and case_study_id is null
        and case_question_position is null
      )
      or (
        question_type = 'coloring'
        and points > 0
        and case_study_id is null
        and case_question_position is null
      )
    );

alter table public.courses
  alter column quiz_type_settings set default
  '{"single_choice": true, "essay_ai": true, "drag_drop_labeling": true, "fill_in_the_blanks": true, "image_hotspot": true, "coloring": true, "case_study": true}'::jsonb;

update public.courses
set quiz_type_settings = coalesce(quiz_type_settings, '{}'::jsonb) || '{"image_hotspot": true}'::jsonb
where not coalesce(quiz_type_settings, '{}'::jsonb)  'image_hotspot';

commit;
