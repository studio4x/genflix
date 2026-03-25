-- Migration: 20260325141000_automate_workload_minutes.sql

begin;

-- 1. Adicionar campo de duração estimada em avaliações
alter table public.assessments 
add column if not exists estimated_minutes integer not null default 10;

-- 2. Função para recalcular a carga horária de um curso
create or replace function public.calculate_course_workload(_course_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _total_lessons_min integer := 0;
  _total_assessments_min integer := 0;
begin
  -- Somar aulas
  select coalesce(sum(l.estimated_minutes), 0)
    into _total_lessons_min
  from public.lessons l
  join public.course_modules cm on cm.id = l.module_id
  where cm.course_id = _course_id;

  -- Somar avaliações (módulo e final)
  select coalesce(sum(a.estimated_minutes), 0)
    into _total_assessments_min
  from public.assessments a
  where a.course_id = _course_id;

  return _total_lessons_min + _total_assessments_min;
end;
$$;

-- 3. Função disparada por trigger para atualizar o curso
create or replace function public.sync_course_workload_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _course_id uuid;
begin
  if (TG_TABLE_NAME = 'lessons') then
    -- Buscar course_id através do módulo
    select cm.course_id into _course_id
    from public.course_modules cm
    where cm.id = coalesce(new.module_id, old.module_id)
    limit 1;
  elsif (TG_TABLE_NAME = 'assessments') then
    _course_id := coalesce(new.course_id, old.course_id);
  elsif (TG_TABLE_NAME = 'course_modules') then
    _course_id := coalesce(new.course_id, old.course_id);
  end if;

  if _course_id is not null then
    update public.courses
    set workload_minutes = public.calculate_course_workload(_course_id)
    where id = _course_id;
  end if;

  return coalesce(new, old);
end;
$$;

-- 4. Criar os Triggers
drop trigger if exists trg_sync_workload_from_lessons on public.lessons;
create trigger trg_sync_workload_from_lessons
after insert or update of estimated_minutes or delete on public.lessons
for each row execute procedure public.sync_course_workload_trigger();

drop trigger if exists trg_sync_workload_from_assessments on public.assessments;
create trigger trg_sync_workload_from_assessments
after insert or update of estimated_minutes or delete on public.assessments
for each row execute procedure public.sync_course_workload_trigger();

-- Trigger no module_id em lessons (caso mude de módulo/curso - improvável mas possível)
drop trigger if exists trg_sync_workload_from_lessons_module on public.lessons;
create trigger trg_sync_workload_from_lessons_module
after update of module_id on public.lessons
for each row execute procedure public.sync_course_workload_trigger();

-- 5. Atualizar todos os cursos existentes agora
do $$
declare
  c record;
begin
  for c in select id from public.courses loop
    update public.courses
    set workload_minutes = public.calculate_course_workload(c.id)
    where id = c.id;
  end loop;
end $$;

commit;
