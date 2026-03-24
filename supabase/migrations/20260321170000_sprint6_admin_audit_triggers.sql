begin;

create or replace function public.process_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_id uuid;
begin
  _admin_id := auth.uid();
  
  -- Se nao houver admin no contexto, pode ser uma acao de sistema/service_role
  if _admin_id is null or not public.has_role(_admin_id, 'admin') then
    return coalesce(new, old);
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  )
  values (
    _admin_id,
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

-- Aplicar auditoria nas tabelas principais
drop trigger if exists audit_courses on public.courses;
create trigger audit_courses
after insert or update or delete on public.courses
for each row execute procedure public.process_admin_audit_log();

drop trigger if exists audit_course_modules on public.course_modules;
create trigger audit_course_modules
after insert or update or delete on public.course_modules
for each row execute procedure public.process_admin_audit_log();

drop trigger if exists audit_lessons on public.lessons;
create trigger audit_lessons
after insert or update or delete on public.lessons
for each row execute procedure public.process_admin_audit_log();

drop trigger if exists audit_assessments on public.assessments;
create trigger audit_assessments
after insert or update or delete on public.assessments
for each row execute procedure public.process_admin_audit_log();

commit;