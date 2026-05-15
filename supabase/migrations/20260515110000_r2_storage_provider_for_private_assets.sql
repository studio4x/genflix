alter table if exists public.lesson_materials
  add column if not exists storage_provider text not null default 'supabase';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesson_materials_storage_provider_check'
  ) then
    alter table public.lesson_materials
      add constraint lesson_materials_storage_provider_check
      check (storage_provider in ('supabase', 'r2'));
  end if;
end $$;

alter table if exists public.course_modules
  add column if not exists module_pdf_storage_provider text not null default 'supabase';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_modules_module_pdf_storage_provider_check'
  ) then
    alter table public.course_modules
      add constraint course_modules_module_pdf_storage_provider_check
      check (module_pdf_storage_provider in ('supabase', 'r2'));
  end if;
end $$;
