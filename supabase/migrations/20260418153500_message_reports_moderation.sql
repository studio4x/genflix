begin;

create or replace function public.list_message_reports(
  _status text default 'pending',
  _limit integer default 50
)
returns table (
  report_id uuid,
  message_id uuid,
  conversation_id uuid,
  message_content text,
  sender_id uuid,
  sender_name text,
  sender_email text,
  reported_by_id uuid,
  reporter_name text,
  reporter_email text,
  reason text,
  description text,
  status text,
  created_at timest?mptz,
  resolved_at timest?mptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(_limit, 50), 1), 100);
  normalized_status text := coalesce(nullif(trim(_status), ''), 'pending');
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    mr.id as report_id,
    m.id as message_id,
    m.conversation_id,
    m.content as message_content,
    m.sender_id,
    coalesce(nullif(sender_profile.full_name, ''), sender_profile.email, 'Usuário GenFlix') as sender_name,
    sender_profile.email as sender_email,
    mr.reported_by as reported_by_id,
    coalesce(nullif(reporter_profile.full_name, ''), reporter_profile.email, 'Usuário GenFlix') as reporter_name,
    reporter_profile.email as reporter_email,
    mr.reason,
    mr.description,
    mr.status,
    mr.created_at,
    mr.resolved_at
  from public.message_reports mr
  join public.messages m on m.id = mr.message_id
  left join public.profiles sender_profile on sender_profile.id = m.sender_id
  left join public.profiles reporter_profile on reporter_profile.id = mr.reported_by
  where normalized_status = 'all'
    or mr.status = normalized_status
  order by
    case when mr.status = 'pending' then 0 else 1 end,
    mr.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.resolve_message_report(_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  update public.message_reports
  set
    status = 'resolved',
    resolved_at = timezone('utc', now())
  where id = _report_id;
end;
$$;

grant execute on function public.list_message_reports(text, integer) to authenticated, service_role;
grant execute on function public.resolve_message_report(uuid) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.message_reports;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
