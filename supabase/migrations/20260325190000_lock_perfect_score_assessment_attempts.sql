begin;

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

  if _attempts_used >= _assessment.max_attempts then
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
    _assessment.max_attempts,
    greatest(_assessment.max_attempts - _attempt_number, 0);
end;
$$;

grant execute on function public.submit_assessment_attempt(uuid, jsonb) to authenticated, service_role;

commit;
