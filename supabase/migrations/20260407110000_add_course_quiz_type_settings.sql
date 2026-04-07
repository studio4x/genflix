alter table public.courses
  add column if not exists quiz_type_settings jsonb not null default
  '{"single_choice": true, "essay_ai": true, "drag_drop_labeling": true, "fill_in_the_blanks": true, "coloring": true, "case_study": true}'::jsonb;

update public.courses
set quiz_type_settings = coalesce(
  quiz_type_settings,
  '{"single_choice": true, "essay_ai": true, "drag_drop_labeling": true, "fill_in_the_blanks": true, "coloring": true, "case_study": true}'::jsonb
);

comment on column public.courses.quiz_type_settings is
  'Controla quais tipos de quiz ficam disponiveis no builder administrativo de cada curso.';
