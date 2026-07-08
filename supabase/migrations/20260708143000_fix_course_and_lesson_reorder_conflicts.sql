begin;

create or replace function public.reorder_course_modules(_course_id uuid, _ordered_module_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _expected_count integer;
  _provided_count integer;
  _distinct_count integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Acesso negado.';
  end if;

  _provided_count := coalesce(array_length(_ordered_module_ids, 1), 0);

  select count(*)
  into _expected_count
  from public.course_modules
  where course_id = _course_id;

  select count(distinct ordered.module_id)
  into _distinct_count
  from unnest(coalesce(_ordered_module_ids, array[]::uuid[])) as ordered(module_id);

  if _provided_count <> _expected_count then
    raise exception 'Lista de módulos inválida para reordenação.';
  end if;

  if _distinct_count <> _provided_count then
    raise exception 'A lista de módulos contém itens duplicados.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(_ordered_module_ids, array[]::uuid[])) as ordered(module_id)
    left join public.course_modules cm
      on cm.id = ordered.module_id
     and cm.course_id = _course_id
    where cm.id is null
  ) then
    raise exception 'A lista de módulos contém itens fora do curso informado.';
  end if;

  with ordered as (
    select module_id, ordinality::integer as position
    from unnest(_ordered_module_ids) with ordinality as input(module_id, ordinality)
  )
  update public.course_modules cm
  set position = 1000000 + ordered.position
  from ordered
  where cm.id = ordered.module_id
    and cm.course_id = _course_id;

  with ordered as (
    select module_id, ordinality::integer as position
    from unnest(_ordered_module_ids) with ordinality as input(module_id, ordinality)
  )
  update public.course_modules cm
  set position = ordered.position
  from ordered
  where cm.id = ordered.module_id
    and cm.course_id = _course_id;
end;
$$;

create or replace function public.reorder_module_lessons(_module_id uuid, _ordered_lesson_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _expected_count integer;
  _provided_count integer;
  _distinct_count integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Acesso negado.';
  end if;

  _provided_count := coalesce(array_length(_ordered_lesson_ids, 1), 0);

  select count(*)
  into _expected_count
  from public.lessons
  where module_id = _module_id;

  select count(distinct ordered.lesson_id)
  into _distinct_count
  from unnest(coalesce(_ordered_lesson_ids, array[]::uuid[])) as ordered(lesson_id);

  if _provided_count <> _expected_count then
    raise exception 'Lista de aulas inválida para reordenação.';
  end if;

  if _distinct_count <> _provided_count then
    raise exception 'A lista de aulas contém itens duplicados.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(_ordered_lesson_ids, array[]::uuid[])) as ordered(lesson_id)
    left join public.lessons l
      on l.id = ordered.lesson_id
     and l.module_id = _module_id
    where l.id is null
  ) then
    raise exception 'A lista de aulas contém itens fora do módulo informado.';
  end if;

  with ordered as (
    select lesson_id, ordinality::integer as position
    from unnest(_ordered_lesson_ids) with ordinality as input(lesson_id, ordinality)
  )
  update public.lessons l
  set position = 1000000 + ordered.position
  from ordered
  where l.id = ordered.lesson_id
    and l.module_id = _module_id;

  with ordered as (
    select lesson_id, ordinality::integer as position
    from unnest(_ordered_lesson_ids) with ordinality as input(lesson_id, ordinality)
  )
  update public.lessons l
  set position = ordered.position
  from ordered
  where l.id = ordered.lesson_id
    and l.module_id = _module_id;
end;
$$;

revoke all on function public.reorder_course_modules(uuid, uuid[]) from public;
revoke all on function public.reorder_module_lessons(uuid, uuid[]) from public;

grant execute on function public.reorder_course_modules(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_module_lessons(uuid, uuid[]) to authenticated, service_role;

commit;
