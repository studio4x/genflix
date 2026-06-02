begin;

create table if not exists public.assessment_attempt_grants (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  extra_attempts integer not null check (extra_attempts > 0),
  reason text,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists assessment_attempt_grants_assessment_user_idx
  on public.assessment_attempt_grants (assessment_id, user_id);

create table if not exists public.assessment_attempt_requests (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_message text,
  admin_response text,
  requested_at timest?mptz not null default timezone('utc', now()),
  reviewed_at timest?mptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists assessment_attempt_requests_user_requested_idx
  on public.assessment_attempt_requests (user_id, requested_at desc);

create index if not exists assessment_attempt_requests_status_requested_idx
  on public.assessment_attempt_requests (status, requested_at desc);

create unique index if not exists assessment_attempt_requests_pending_unique
  on public.assessment_attempt_requests (assessment_id, user_id)
  where status = 'pending';

grant select on public.assessment_attempt_grants to authenticated;
grant select on public.assessment_attempt_requests to authenticated;

grant all on public.assessment_attempt_grants to service_role;
grant all on public.assessment_attempt_requests to service_role;

alter table public.assessment_attempt_grants enable row level security;
alter table public.assessment_attempt_requests enable row level security;

drop policy if exists "assessment_attempt_grants_admin_all" on public.assessment_attempt_grants;
create policy "assessment_attempt_grants_admin_all"
on public.assessment_attempt_grants
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_attempt_grants_student_select_own" on public.assessment_attempt_grants;
create policy "assessment_attempt_grants_student_select_own"
on public.assessment_attempt_grants
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "assessment_attempt_grants_service_role_all" on public.assessment_attempt_grants;
create policy "assessment_attempt_grants_service_role_all"
on public.assessment_attempt_grants
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_attempt_requests_admin_all" on public.assessment_attempt_requests;
create policy "assessment_attempt_requests_admin_all"
on public.assessment_attempt_requests
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_attempt_requests_student_select_own" on public.assessment_attempt_requests;
create policy "assessment_attempt_requests_student_select_own"
on public.assessment_attempt_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "assessment_attempt_requests_service_role_all" on public.assessment_attempt_requests;
create policy "assessment_attempt_requests_service_role_all"
on public.assessment_attempt_requests
for all
to service_role
using (true)
with check (true);

create or replace function public.get_assessment_extra_attempts_total(_assessment_id uuid, _user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(g.extra_attempts), 0)::integer
  from public.assessment_attempt_grants g
  where g.assessment_id = _assessment_id
    and g.user_id = _user_id;
$$;

create or replace function public.get_assessment_effective_max_attempts(_assessment_id uuid, _user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select a.max_attempts + public.get_assessment_extra_attempts_total(a.id, _user_id)
  from public.assessments a
  where a.id = _assessment_id;
$$;

create or replace function public.get_student_course_assessments(_course_id uuid)
returns table (
  assessment_id uuid,
  assessment_type text,
  module_id uuid,
  module_position integer,
  title text,
  description text,
  is_required boolean,
  passing_score numeric,
  max_attempts integer,
  is_active boolean,
  is_unlocked boolean,
  attempts_used integer,
  last_score numeric,
  last_is_approved boolean,
  remaining_attempts integer,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx_user as (
    select auth.uid() as user_id
  ),
  allowed as (
    select 1
    from ctx_user cu
    where cu.user_id is not null
      and public.has_role(cu.user_id, 'student')
      and public.is_course_released(cu.user_id, _course_id)
  ),
  assessment_base as (
    select
      a.id as assessment_id,
      a.assessment_type,
      a.module_id,
      cm.position as module_position,
      a.title,
      a.description,
      a.is_required,
      a.passing_score,
      public.get_assessment_effective_max_attempts(a.id, cu.user_id) as max_attempts,
      a.is_active,
      case
        when a.assessment_type = 'module' then public.is_module_unlocked(cu.user_id, a.module_id)
        else public.are_required_modules_completed(cu.user_id, a.course_id)
      end as is_unlocked,
      (
        select count(*)::int
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
      ) as attempts_used,
      (
        select aa.score_percent
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
        order by aa.attempt_number desc
        limit 1
      ) as last_score,
      (
        select aa.is_approved
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
        order by aa.attempt_number desc
        limit 1
      ) as last_is_approved
    from public.assessments a
    join ctx_user cu on true
    left join public.course_modules cm on cm.id = a.module_id
    where a.course_id = _course_id
      and a.is_active = true
  )
  select
    ab.assessment_id,
    ab.assessment_type,
    ab.module_id,
    ab.module_position,
    ab.title,
    ab.description,
    ab.is_required,
    ab.passing_score,
    ab.max_attempts,
    ab.is_active,
    ab.is_unlocked,
    ab.attempts_used,
    ab.last_score,
    coalesce(ab.last_is_approved, false) as last_is_approved,
    greatest(ab.max_attempts - ab.attempts_used, 0) as remaining_attempts,
    case
      when ab.is_unlocked = false then 'blocked'
      when coalesce(ab.last_is_approved, false) = true then 'approved'
      when ab.attempts_used >= ab.max_attempts then 'failed_limit'
      else 'available'
    end as state
  from assessment_base ab
  where exists (select 1 from allowed)
  order by ab.module_position nulls last, ab.assessment_type;
$$;

create or replace function public.request_assessment_attempt_retry(
  _assessment_id uuid,
  _requested_message text default null
)
returns table (
  request_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _assessment public.assessments%rowtype;
  _attempts_used integer;
  _effective_max_attempts integer;
  _existing_request public.assessment_attempt_requests%rowtype;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  if public.has_role(_user_id, 'student') = false then
    raise exception 'Apenas alunos podem solicitar nova tentativa.';
  end if;

  select *
    into _assessment
  from public.assessments a
  where a.id = _assessment_id
    and a.is_active = true
  limit 1;

  if not found then
    raise exception 'Avalia??o n?o encontrada ou inativa.';
  end if;

  if public.is_course_released(_user_id, _assessment.course_id) = false then
    raise exception 'Avalia??o n?o liberada para o usurio.';
  end if;

  select count(*)::int
    into _attempts_used
  from public.assessment_attempts aa
  where aa.assessment_id = _assessment_id
    and aa.user_id = _user_id
    and aa.status = 'submitted';

  _effective_max_attempts := public.get_assessment_effective_max_attempts(_assessment_id, _user_id);

  if _attempts_used < _effective_max_attempts then
    raise exception 'Esta avalia??o ainda possui tentativas disponiveis.';
  end if;

  select *
    into _existing_request
  from public.assessment_attempt_requests ar
  where ar.assessment_id = _assessment_id
    and ar.user_id = _user_id
    and ar.status = 'pending'
  order by ar.requested_at desc
  limit 1;

  if found then
    return query
    select _existing_request.id, _existing_request.status;
    return;
  end if;

  insert into public.assessment_attempt_requests (
    assessment_id,
    user_id,
    requested_message
  )
  values (
    _assessment_id,
    _user_id,
    nullif(trim(coalesce(_requested_message, '')), '')
  )
  returning id, assessment_attempt_requests.status
  into _existing_request.id, _existing_request.status;

  return query
  select _existing_request.id, _existing_request.status;
end;
$$;

create or replace function public.admin_review_assessment_attempt_request(
  _request_id uuid,
  _decision text,
  _extra_attempts integer default 1,
  _admin_response text default null
)
returns table (
  request_id uuid,
  status text,
  total_extra_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_id uuid;
  _request public.assessment_attempt_requests%rowtype;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  if public.has_role(_admin_id, 'admin') = false then
    raise exception 'Apenas administradores podem revisar solicitacoes.';
  end if;

  if _decision not in ('approved', 'rejected') then
    raise exception 'Decisao invalida.';
  end if;

  select *
    into _request
  from public.assessment_attempt_requests ar
  where ar.id = _request_id
  limit 1;

  if not found then
    raise exception 'Solicitacao n?o encontrada.';
  end if;

  if _request.status <> 'pending' then
    raise exception 'Esta solicita??o ja foi analisada.';
  end if;

  if _decision = 'approved' then
    if coalesce(_extra_attempts, 0) <= 0 then
      raise exception 'Informe ao menos uma tentativa extra.';
    end if;

    insert into public.assessment_attempt_grants (
      assessment_id,
      user_id,
      extra_attempts,
      reason,
      granted_by
    )
    values (
      _request.assessment_id,
      _request.user_id,
      _extra_attempts,
      nullif(trim(coalesce(_admin_response, '')), ''),
      _admin_id
    );
  end if;

  update public.assessment_attempt_requests ar
  set
    status = _decision,
    admin_response = nullif(trim(coalesce(_admin_response, '')), ''),
    reviewed_at = timezone('utc', now()),
    reviewed_by = _admin_id
  where ar.id = _request_id;

  return query
  select
    _request_id,
    _decision,
    public.get_assessment_extra_attempts_total(_request.assessment_id, _request.user_id);
end;
$$;

create or replace function public.get_assessment_attempt_requests(_status text default null)
returns table (
  request_id uuid,
  status text,
  requested_message text,
  admin_response text,
  requested_at timest?mptz,
  reviewed_at timest?mptz,
  student_id uuid,
  student_email text,
  student_name text,
  assessment_id uuid,
  assessment_title text,
  assessment_type text,
  course_id uuid,
  course_title text,
  module_id uuid,
  module_title text,
  base_max_attempts integer,
  total_extra_attempts integer,
  effective_max_attempts integer,
  attempts_used integer,
  last_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx_admin as (
    select auth.uid() as user_id
  )
  select
    ar.id as request_id,
    ar.status,
    ar.requested_message,
    ar.admin_response,
    ar.requested_at,
    ar.reviewed_at,
    ar.user_id as student_id,
    p.email as student_email,
    p.full_name as student_name,
    a.id as assessment_id,
    a.title as assessment_title,
    a.assessment_type,
    c.id as course_id,
    c.title as course_title,
    cm.id as module_id,
    cm.title as module_title,
    a.max_attempts as base_max_attempts,
    public.get_assessment_extra_attempts_total(a.id, ar.user_id) as total_extra_attempts,
    public.get_assessment_effective_max_attempts(a.id, ar.user_id) as effective_max_attempts,
    (
      select count(*)::int
      from public.assessment_attempts aa
      where aa.assessment_id = a.id
        and aa.user_id = ar.user_id
        and aa.status = 'submitted'
    ) as attempts_used,
    (
      select aa.score_percent
      from public.assessment_attempts aa
      where aa.assessment_id = a.id
        and aa.user_id = ar.user_id
        and aa.status = 'submitted'
      order by aa.attempt_number desc
      limit 1
    ) as last_score
  from public.assessment_attempt_requests ar
  join public.assessments a on a.id = ar.assessment_id
  join public.courses c on c.id = a.course_id
  left join public.course_modules cm on cm.id = a.module_id
  join public.profiles p on p.id = ar.user_id
  join ctx_admin ca on true
  where ca.user_id is not null
    and public.has_role(ca.user_id, 'admin')
    and (_status is null or ar.status = _status)
  order by
    case when ar.status = 'pending' then 0 else 1 end,
    ar.requested_at desc;
$$;

create or replace function public.submit_assessment_attempt(_assessment_id uuid, _answers jsonb)
returns table (
  attempt_id uuid,
  score_percent numeric,
  is_approved boolean,
  attempt_number integer,
  max_attempts integer,
  remaining_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _assessment public.assessments%rowtype;
  _attempts_used integer;
  _effective_max_attempts integer;
  _attempt_number integer;
  _attempt_id uuid;
  _question record;
  _selected_option_id uuid;
  _option_is_correct boolean;
  _total_questions integer := 0;
  _correct_answers integer := 0;
  _score numeric(5, 2);
  _approved boolean;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  if public.has_role(_user_id, 'student') = false then
    raise exception 'Apenas alunos podem responder avalia??o.';
  end if;

  select *
    into _assessment
  from public.assessments a
  where a.id = _assessment_id
    and a.is_active = true
  limit 1;

  if not found then
    raise exception 'Avalia??o n?o encontrada ou inativa.';
  end if;

  if public.is_course_released(_user_id, _assessment.course_id) = false then
    raise exception 'Avalia??o n?o liberada para o usurio.';
  end if;

  if _assessment.assessment_type = 'module' then
    if _assessment.module_id is null then
      raise exception 'Avalia??o de m?dulo invalida.';
    end if;
    if public.is_module_unlocked(_user_id, _assessment.module_id) = false then
      raise exception 'Mdulo bloqueado para avalia??o.';
    end if;
  else
    if public.are_required_modules_completed(_user_id, _assessment.course_id) = false then
      raise exception 'Avalia??o final bloqueada ate concluir os m?dulos obrigatrios.';
    end if;
  end if;

  select count(*)::int
    into _attempts_used
  from public.assessment_attempts aa
  where aa.assessment_id = _assessment_id
    and aa.user_id = _user_id
    and aa.status = 'submitted';

  _effective_max_attempts := public.get_assessment_effective_max_attempts(_assessment_id, _user_id);

  if exists (
    select 1
    from public.assessment_attempts aa
    where aa.assessment_id = _assessment_id
      and aa.user_id = _user_id
      and aa.status = 'submitted'
      and aa.is_approved = true
      and coalesce(aa.score_percent, 0) >= 100
  ) then
    raise exception 'Avalia??o ja concluida com aproveitamento maximo.';
  end if;

  if _attempts_used >= _effective_max_attempts then
    raise exception 'Limite de tentativas atingido para est? avalia??o.';
  end if;

  if _answers is null or jsonb_typeof(_answers) <> 'array' then
    raise exception 'Respostas invalidas.';
  end if;

  _attempt_number := _attempts_used + 1;
  _attempt_id := gen_random_uuid();

  insert into public.assessment_attempts (
    id,
    assessment_id,
    user_id,
    attempt_number,
    status,
    started_at,
    submitted_at
  )
  values (
    _attempt_id,
    _assessment_id,
    _user_id,
    _attempt_number,
    'submitted',
    timezone('utc', now()),
    timezone('utc', now())
  );

  for _question in
    select q.id, q.is_required
    from public.assessment_questions q
    where q.assessment_id = _assessment_id
    order by q.position
  loop
    _total_questions := _total_questions + 1;

    select (item->>'option_id')::uuid
      into _selected_option_id
    from jsonb_array_elements(_answers) item
    where (item->>'question_id')::uuid = _question.id
    limit 1;

    if _selected_option_id is null and _question.is_required then
      raise exception 'Todas as questoes obrigatrias devem ser respondidas.';
    end if;

    _option_is_correct := false;
    if _selected_option_id is not null then
      select ao.is_correct
        into _option_is_correct
      from public.assessment_options ao
      where ao.id = _selected_option_id
        and ao.question_id = _question.id
      limit 1;

      if _option_is_correct is null then
        raise exception 'Opcao invalida para uma das questoes.';
      end if;
    end if;

    if coalesce(_option_is_correct, false) then
      _correct_answers := _correct_answers + 1;
    end if;

    insert into public.assessment_answers (
      attempt_id,
      question_id,
      selected_option_id,
      is_correct
    )
    values (
      _attempt_id,
      _question.id,
      _selected_option_id,
      coalesce(_option_is_correct, false)
    );
  end loop;

  if _total_questions = 0 then
    raise exception 'Avalia??o sem questoes cadastradas.';
  end if;

  _score := round((_correct_answers::numeric * 100) / _total_questions, 2);
  _approved := (_score >= _assessment.passing_score);

  update public.assessment_attempts aa
  set
    score_percent = _score,
    correct_answers = _correct_answers,
    total_questions = _total_questions,
    is_approved = _approved
  where aa.id = _attempt_id;

  perform public.refresh_course_progress(_user_id, _assessment.course_id);

  return query
  select
    _attempt_id,
    _score,
    _approved,
    _attempt_number,
    _effective_max_attempts,
    greatest(_effective_max_attempts - _attempt_number, 0);
end;
$$;

grant execute on function public.get_assessment_extra_attempts_total(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_assessment_effective_max_attempts(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_student_course_assessments(uuid) to authenticated, service_role;
grant execute on function public.request_assessment_attempt_retry(uuid, text) to authenticated, service_role;
grant execute on function public.admin_review_assessment_attempt_request(uuid, text, integer, text) to authenticated, service_role;
grant execute on function public.get_assessment_attempt_requests(text) to authenticated, service_role;
grant execute on function public.submit_assessment_attempt(uuid, jsonb) to authenticated, service_role;

commit;
