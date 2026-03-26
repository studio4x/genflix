begin;

alter table public.assessment_questions
  add column if not exists essay_expected_answer text;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_question_type_check;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_points_check;

alter table public.assessment_questions
  add constraint assessment_questions_question_type_check
    check (question_type in ('single_choice', 'essay_ai'));

alter table public.assessment_questions
  add constraint assessment_questions_points_check
    check (points >= 0);

alter table public.assessment_questions
  drop constraint if exists assessment_questions_type_rules_check;

alter table public.assessment_questions
  add constraint assessment_questions_type_rules_check
    check (
      (question_type = 'single_choice' and points > 0)
      or (
        question_type = 'essay_ai'
        and points = 0
        and length(trim(coalesce(essay_expected_answer, ''))) >= 2
      )
    );

alter table public.assessment_answers
  add column if not exists answer_text text,
  add column if not exists ai_feedback text,
  add column if not exists ai_evaluation jsonb;

alter table public.assessment_answers
  drop constraint if exists assessment_answers_answer_text_check;

alter table public.assessment_answers
  add constraint assessment_answers_answer_text_check
    check (answer_text is null or length(trim(answer_text)) >= 1);

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
  _answer_text text;
  _option_is_correct boolean;
  _objective_questions integer := 0;
  _correct_answers integer := 0;
  _questions_seen integer := 0;
  _score numeric(5, 2);
  _approved boolean;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if public.has_role(_user_id, 'student') = false then
    raise exception 'Apenas alunos podem responder avaliacao.';
  end if;

  select *
    into _assessment
  from public.assessments a
  where a.id = _assessment_id
    and a.is_active = true
  limit 1;

  if not found then
    raise exception 'Avaliacao nao encontrada ou inativa.';
  end if;

  if public.is_course_released(_user_id, _assessment.course_id) = false then
    raise exception 'Avaliacao nao liberada para o usuario.';
  end if;

  if _assessment.assessment_type = 'module' then
    if _assessment.module_id is null then
      raise exception 'Avaliacao de modulo invalida.';
    end if;
    if public.is_module_unlocked(_user_id, _assessment.module_id) = false then
      raise exception 'Modulo bloqueado para avaliacao.';
    end if;
  else
    if public.are_required_modules_completed(_user_id, _assessment.course_id) = false then
      raise exception 'Avaliacao final bloqueada ate concluir os modulos obrigatorios.';
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
    raise exception 'Avaliacao ja concluida com aproveitamento maximo.';
  end if;

  if _attempts_used >= _effective_max_attempts then
    raise exception 'Limite de tentativas atingido para esta avaliacao.';
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
    select q.id, q.is_required, q.question_type
    from public.assessment_questions q
    where q.assessment_id = _assessment_id
    order by q.position
  loop
    _questions_seen := _questions_seen + 1;
    _selected_option_id := null;
    _answer_text := null;

    select
      nullif(item->>'option_id', '')::uuid,
      nullif(trim(coalesce(item->>'answer_text', '')), '')
    into
      _selected_option_id,
      _answer_text
    from jsonb_array_elements(_answers) item
    where (item->>'question_id')::uuid = _question.id
    limit 1;

    if _question.question_type = 'essay_ai' then
      if _answer_text is null and _question.is_required then
        raise exception 'Todas as questoes obrigatorias devem ser respondidas.';
      end if;

      insert into public.assessment_answers (
        attempt_id,
        question_id,
        selected_option_id,
        answer_text,
        is_correct
      )
      values (
        _attempt_id,
        _question.id,
        null,
        _answer_text,
        false
      );

      continue;
    end if;

    _objective_questions := _objective_questions + 1;

    if _selected_option_id is null and _question.is_required then
      raise exception 'Todas as questoes obrigatorias devem ser respondidas.';
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
      answer_text,
      is_correct
    )
    values (
      _attempt_id,
      _question.id,
      _selected_option_id,
      null,
      coalesce(_option_is_correct, false)
    );
  end loop;

  if _questions_seen = 0 then
    raise exception 'Avaliacao sem questoes cadastradas.';
  end if;

  if _objective_questions > 0 then
    _score := round((_correct_answers::numeric * 100) / _objective_questions, 2);
    _approved := (_score >= _assessment.passing_score);
  else
    _score := 0;
    _approved := false;
  end if;

  update public.assessment_attempts aa
  set
    score_percent = _score,
    correct_answers = _correct_answers,
    total_questions = _objective_questions,
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

grant execute on function public.submit_assessment_attempt(uuid, jsonb) to authenticated, service_role;

commit;
