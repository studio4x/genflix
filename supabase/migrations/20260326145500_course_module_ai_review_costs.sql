begin;

alter table public.course_module_ai_reviews
  add column if not exists ai_provider text,
  add column if not exists ai_model text,
  add column if not exists token_count_method text check (token_count_method in ('actual', 'estimated')),
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists total_tokens integer,
  add column if not exists estimated_cost_usd numeric(12, 6);

commit;
