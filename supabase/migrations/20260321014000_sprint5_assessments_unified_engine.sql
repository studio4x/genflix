begin;

create table if not exists public.course_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, course_id),
  check (
    (is_completed = true and completed_at is not null)
    or (is_completed = false and completed_at is null)
  )
);

create index if not exists course_progress_user_id_idx
  on public.course_progress (user_id);
create index if not exists course_progress_course_id_idx
  on public.course_progress (course_id);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.course_modules (id) on delete cascade,
  assessment_type text not null check (assessment_type in ('module', 'final')),
  title text not null check (length(trim(title)) >= 2),
  description text,
  is_required boolean not null default true,
  passing_score numeric(5, 2) not null default 70.00 check (passing_score >= 0 and passing_score <= 100),
  max_attempts integer not null default 3 check (max_attempts > 0 and max_attempts <= 20),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (assessment_type = 'module' and module_id is not null)
    or (assessment_type = 'final' and module_id is null)
  )
);

create unique index if not exists assessments_module_unique_idx
  on public.assessments (module_id, assessment_type)
  where module_id is not null;

create unique index if not exists assessments_final_unique_idx
  on public.assessments (course_id, assessment_type)
  where assessment_type = 'final';

create index if not exists assessments_course_id_idx
  on public.assessments (course_id);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_text text not null check (length(trim(question_text)) >= 2),
  question_type text not null default 'single_choice' check (question_type in ('single_choice')),
  position integer not null check (position > 0),
  is_required boolean not null default true,
  points numeric(8, 2) not null default 1.00 check (points > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, position)
);

create index if not exists assessment_questions_assessment_id_idx
  on public.assessment_questions (assessment_id);

create table if not exists public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  option_text text not null check (length(trim(option_text)) >= 1),
  position integer not null check (position > 0),
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, position)
);

create index if not exists assessment_options_question_id_idx
  on public.assessment_options (question_id);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'submitted' check (status in ('submitted')),
  score_percent numeric(5, 2) not null default 0 check (score_percent >= 0 and score_percent <= 100),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  is_approved boolean not null default false,
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, user_id, attempt_number)
);

create index if not exists assessment_attempts_assessment_user_idx
  on public.assessment_attempts (assessment_id, user_id);

create index if not exists assessment_attempts_user_created_idx
  on public.assessment_attempts (user_id, created_at desc);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  selected_option_id uuid references public.assessment_options (id) on delete set null,
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id, question_id)
);

create index if not exists assessment_answers_attempt_id_idx
  on public.assessment_answers (attempt_id);

create index if not exists assessment_answers_question_id_idx
  on public.assessment_answers (question_id);

drop trigger if exists set_course_progress_updated_at on public.course_progress;
create trigger set_course_progress_updated_at
before update on public.course_progress
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_assessments_updated_at on public.assessments;
create trigger set_assessments_updated_at
before update on public.assessments
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_assessment_questions_updated_at on public.assessment_questions;
create trigger set_assessment_questions_updated_at
before update on public.assessment_questions
for each row
execute procedure public.set_updated_at();

insert into public.assessments (
  course_id,
  module_id,
  assessment_type,
  title,
  description,
  is_required,
  passing_score,
  max_attempts,
  is_active,
  created_by,
  created_at,
  updated_at
)
select
  cm.course_id,
  ma.module_id,
  'module',
  ma.title,
  null::text,
  ma.is_required,
  ma.passing_score,
  3,
  true,
  ma.created_by,
  ma.created_at,
  ma.updated_at
from public.module_assessments ma
join public.course_modules cm on cm.id = ma.module_id
where not exists (
  select 1
  from public.assessments a
  where a.assessment_type = 'module'
    and a.module_id = ma.module_id
);

with ranked_attempts as (
  select
    a.id as new_assessment_id,
    maa.user_id,
    row_number() over (
      partition by a.id, maa.user_id
      order by coalesce(maa.submitted_at, maa.created_at), maa.id
    )::int as attempt_number,
    coalesce(maa.score, 0)::numeric(5, 2) as score_percent,
    0::int as correct_answers,
    0::int as total_questions,
    maa.is_approved,
    coalesce(maa.started_at, maa.created_at) as started_at,
    coalesce(maa.submitted_at, maa.created_at) as submitted_at,
    maa.created_at
  from public.module_assessment_attempts maa
  join public.module_assessments ma on ma.id = maa.assessment_id
  join public.assessments a
    on a.module_id = ma.module_id
    and a.assessment_type = 'module'
)
insert into public.assessment_attempts (
  assessment_id,
  user_id,
  attempt_number,
  status,
  score_percent,
  correct_answers,
  total_questions,
  is_approved,
  started_at,
  submitted_at,
  created_at
)
select
  ra.new_assessment_id,
  ra.user_id,
  ra.attempt_number,
  'submitted',
  ra.score_percent,
  ra.correct_answers,
  ra.total_questions,
  ra.is_approved,
  ra.started_at,
  ra.submitted_at,
  ra.created_at
from ranked_attempts ra
on conflict (assessment_id, user_id, attempt_number) do nothing;

create or replace function public.is_required_module_assessment_approved(_user_id uuid, _module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    join public.assessment_attempts aa on aa.assessment_id = a.id
    where a.assessment_type = 'module'
      and a.module_id = _module_id
      and a.is_required = true
      and a.is_active = true
      and aa.user_id = _user_id
      and aa.status = 'submitted'
      and aa.is_approved = true
  );
$$;

create or replace function public.is_required_final_assessment_approved(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    join public.assessment_attempts aa on aa.assessment_id = a.id
    where a.assessment_type = 'final'
      and a.course_id = _course_id
      and a.is_required = true
      and a.is_active = true
      and aa.user_id = _user_id
      and aa.status = 'submitted'
      and aa.is_approved = true
  );
$$;

create or replace function public.is_module_completed(_user_id uuid, _module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with required_lesson_counts as (
    select
      count(*)::int as required_total,
      count(lp.id)::int as required_completed
    from public.lessons l
    left join public.lesson_progress lp
      on lp.lesson_id = l.id
      and lp.user_id = _user_id
      and lp.is_completed = true
    where l.module_id = _module_id
      and l.is_required = true
  ),
  assessment_requirement as (
    select exists (
      select 1
      from public.assessments a
      where a.assessment_type = 'module'
        and a.module_id = _module_id
        and a.is_required = true
        and a.is_active = true
    ) as has_required_assessment
  )
  select
    (rlc.required_total = rlc.required_completed)
    and (
      ar.has_required_assessment = false
      or public.is_required_module_assessment_approved(_user_id, _module_id)
    )
  from required_lesson_counts rlc
  cross join assessment_requirement ar;
$$;

create or replace function public.are_required_modules_completed(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with required_modules as (
    select cm.id
    from public.course_modules cm
    where cm.course_id = _course_id
      and cm.is_required = true
  )
  select not exists (
    select 1
    from required_modules rm
    where public.is_module_completed(_user_id, rm.id) = false
  );
$$;

create or replace function public.is_course_completed(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with final_requirement as (
    select exists (
      select 1
      from public.assessments a
      where a.assessment_type = 'final'
        and a.course_id = _course_id
        and a.is_required = true
        and a.is_active = true
    ) as has_required_final_assessment
  )
  select
    public.are_required_modules_completed(_user_id, _course_id)
    and (
      fr.has_required_final_assessment = false
      or public.is_required_final_assessment_approved(_user_id, _course_id)
    )
  from final_requirement fr;
$$;

create or replace function public.refresh_course_progress(_user_id uuid, _course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_completed boolean;
begin
  if _user_id is null or _course_id is null then
    return;
  end if;

  _is_completed := public.is_course_completed(_user_id, _course_id);

  insert into public.course_progress (
    user_id,
    course_id,
    is_completed,
    completed_at
  )
  values (
    _user_id,
    _course_id,
    _is_completed,
    case when _is_completed then timezone('utc', now()) else null end
  )
  on conflict (user_id, course_id) do update
  set
    is_completed = excluded.is_completed,
    completed_at = case
      when excluded.is_completed then coalesce(public.course_progress.completed_at, excluded.completed_at)
      else null
    end,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.sync_course_progress_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _lesson_id uuid;
  _course_id uuid;
  _user_id uuid;
begin
  _lesson_id := coalesce(new.lesson_id, old.lesson_id);
  _user_id := coalesce(new.user_id, old.user_id);

  select cm.course_id
    into _course_id
  from public.lessons l
  join public.course_modules cm on cm.id = l.module_id
  where l.id = _lesson_id
  limit 1;

  perform public.refresh_course_progress(_user_id, _course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_course_progress_from_lesson_progress on public.lesson_progress;
create trigger trg_sync_course_progress_from_lesson_progress
after insert or update or delete on public.lesson_progress
for each row
execute procedure public.sync_course_progress_from_lesson_progress();

create or replace function public.sync_course_progress_from_assessment_attempts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _assessment_id uuid;
  _course_id uuid;
  _user_id uuid;
begin
  _assessment_id := coalesce(new.assessment_id, old.assessment_id);
  _user_id := coalesce(new.user_id, old.user_id);

  select a.course_id
    into _course_id
  from public.assessments a
  where a.id = _assessment_id
  limit 1;

  perform public.refresh_course_progress(_user_id, _course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_course_progress_from_assessment_attempts on public.assessment_attempts;
create trigger trg_sync_course_progress_from_assessment_attempts
after insert or update or delete on public.assessment_attempts
for each row
execute procedure public.sync_course_progress_from_assessment_attempts();

create or replace function public.get_student_course_modules_progress(_course_id uuid)
returns table (
  module_id uuid,
  module_position integer,
  title text,
  description text,
  is_required boolean,
  state text,
  is_unlocked boolean,
  is_completed boolean,
  required_lessons_total integer,
  required_lessons_completed integer,
  has_required_assessment boolean,
  required_assessment_approved boolean,
  progress_percent integer
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
  module_base as (
    select
      cm.id as module_id,
      cm.position,
      cm.title,
      cm.description,
      cm.is_required,
      public.is_module_unlocked(cu.user_id, cm.id) as is_unlocked,
      public.is_module_completed(cu.user_id, cm.id) as is_completed,
      (
        select count(*)::int
        from public.lessons l
        where l.module_id = cm.id
          and l.is_required = true
      ) as required_lessons_total,
      (
        select count(*)::int
        from public.lessons l
        join public.lesson_progress lp
          on lp.lesson_id = l.id
          and lp.user_id = cu.user_id
          and lp.is_completed = true
        where l.module_id = cm.id
          and l.is_required = true
      ) as required_lessons_completed,
      exists (
        select 1
        from public.assessments a
        where a.assessment_type = 'module'
          and a.module_id = cm.id
          and a.is_required = true
          and a.is_active = true
      ) as has_required_assessment,
      public.is_required_module_assessment_approved(cu.user_id, cm.id) as required_assessment_approved
    from public.course_modules cm
    join ctx_user cu on true
    where cm.course_id = _course_id
  )
  select
    mb.module_id,
    mb.position as module_position,
    mb.title,
    mb.description,
    mb.is_required,
    case
      when mb.is_unlocked = false then 'blocked'
      when mb.is_completed = true then 'completed'
      else 'in_progress'
    end as state,
    mb.is_unlocked,
    mb.is_completed,
    mb.required_lessons_total,
    mb.required_lessons_completed,
    mb.has_required_assessment,
    mb.required_assessment_approved,
    case
      when (mb.required_lessons_total + case when mb.has_required_assessment then 1 else 0 end) = 0
        then 100
      else floor(
        (
          (mb.required_lessons_completed + case when (mb.has_required_assessment and mb.required_assessment_approved) then 1 else 0 end)::numeric
          * 100
        )
        / (mb.required_lessons_total + case when mb.has_required_assessment then 1 else 0 end)
      )::int
    end as progress_percent
  from module_base mb
  where exists (select 1 from allowed)
  order by mb.position asc;
$$;

create or replace function public.get_student_course_status(_course_id uuid)
returns table (
  is_completed boolean,
  required_modules_total integer,
  required_modules_completed integer,
  has_required_final_assessment boolean,
  required_final_assessment_approved boolean
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
  module_totals as (
    select
      count(*)::int as required_modules_total,
      count(*) filter (where public.is_module_completed(cu.user_id, cm.id))::int as required_modules_completed
    from public.course_modules cm
    join ctx_user cu on true
    where cm.course_id = _course_id
      and cm.is_required = true
  ),
  final_requirement as (
    select
      exists (
        select 1
        from public.assessments a
        where a.course_id = _course_id
          and a.assessment_type = 'final'
          and a.is_required = true
          and a.is_active = true
      ) as has_required_final_assessment,
      public.is_required_final_assessment_approved(
        (select user_id from ctx_user),
        _course_id
      ) as required_final_assessment_approved
  )
  select
    public.is_course_completed((select user_id from ctx_user), _course_id) as is_completed,
    mt.required_modules_total,
    mt.required_modules_completed,
    fr.has_required_final_assessment,
    fr.required_final_assessment_approved
  from module_totals mt
  cross join final_requirement fr
  where exists (select 1 from allowed);
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
      a.max_attempts,
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

  if exists (
    select 1
    from public.assessment_attempts aa
    where aa.assessment_id = _assessment_id
      and aa.user_id = _user_id
      and aa.status = 'submitted'
      and aa.is_approved = true
  ) then
    raise exception 'Avaliacao ja aprovada.';
  end if;

  if _attempts_used >= _assessment.max_attempts then
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
    raise exception 'Avaliacao sem questoes cadastradas.';
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

grant execute on function public.is_required_module_assessment_approved(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_required_final_assessment_approved(uuid, uuid) to authenticated, service_role;
grant execute on function public.are_required_modules_completed(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_module_completed(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_course_completed(uuid, uuid) to authenticated, service_role;
grant execute on function public.refresh_course_progress(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_student_course_modules_progress(uuid) to authenticated, service_role;
grant execute on function public.get_student_course_status(uuid) to authenticated, service_role;
grant execute on function public.get_student_course_assessments(uuid) to authenticated, service_role;
grant execute on function public.submit_assessment_attempt(uuid, jsonb) to authenticated, service_role;

grant select, insert, update, delete on public.course_progress to authenticated;
grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert, update, delete on public.assessment_questions to authenticated;
grant select, insert, update, delete on public.assessment_options to authenticated;
grant select, insert, update, delete on public.assessment_attempts to authenticated;
grant select, insert, update, delete on public.assessment_answers to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.course_progress to service_role;
grant all on public.assessments to service_role;
grant all on public.assessment_questions to service_role;
grant all on public.assessment_options to service_role;
grant all on public.assessment_attempts to service_role;
grant all on public.assessment_answers to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.course_progress enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;

drop policy if exists "course_progress_student_select_own" on public.course_progress;
create policy "course_progress_student_select_own"
on public.course_progress
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
);

drop policy if exists "course_progress_admin_all" on public.course_progress;
create policy "course_progress_admin_all"
on public.course_progress
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_progress_service_role_all" on public.course_progress;
create policy "course_progress_service_role_all"
on public.course_progress
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessments_admin_all" on public.assessments;
create policy "assessments_admin_all"
on public.assessments
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessments_student_select_available" on public.assessments;
create policy "assessments_student_select_available"
on public.assessments
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and is_active = true
  and public.is_course_released(auth.uid(), course_id)
  and (
    (assessment_type = 'module' and module_id is not null and public.is_module_unlocked(auth.uid(), module_id))
    or (assessment_type = 'final' and public.are_required_modules_completed(auth.uid(), course_id))
  )
);

drop policy if exists "assessments_service_role_all" on public.assessments;
create policy "assessments_service_role_all"
on public.assessments
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_questions_admin_all" on public.assessment_questions;
create policy "assessment_questions_admin_all"
on public.assessment_questions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_questions_student_select_available" on public.assessment_questions;
create policy "assessment_questions_student_select_available"
on public.assessment_questions
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_questions.assessment_id
      and a.is_active = true
      and public.is_course_released(auth.uid(), a.course_id)
      and (
        (a.assessment_type = 'module' and a.module_id is not null and public.is_module_unlocked(auth.uid(), a.module_id))
        or (a.assessment_type = 'final' and public.are_required_modules_completed(auth.uid(), a.course_id))
      )
  )
);

drop policy if exists "assessment_questions_service_role_all" on public.assessment_questions;
create policy "assessment_questions_service_role_all"
on public.assessment_questions
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_options_admin_all" on public.assessment_options;
create policy "assessment_options_admin_all"
on public.assessment_options
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_options_student_select_available" on public.assessment_options;
create policy "assessment_options_student_select_available"
on public.assessment_options
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = assessment_options.question_id
      and a.is_active = true
      and public.is_course_released(auth.uid(), a.course_id)
      and (
        (a.assessment_type = 'module' and a.module_id is not null and public.is_module_unlocked(auth.uid(), a.module_id))
        or (a.assessment_type = 'final' and public.are_required_modules_completed(auth.uid(), a.course_id))
      )
  )
);

drop policy if exists "assessment_options_service_role_all" on public.assessment_options;
create policy "assessment_options_service_role_all"
on public.assessment_options
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_attempts_admin_all" on public.assessment_attempts;
create policy "assessment_attempts_admin_all"
on public.assessment_attempts
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_attempts_student_select_own" on public.assessment_attempts;
create policy "assessment_attempts_student_select_own"
on public.assessment_attempts
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
);

drop policy if exists "assessment_attempts_service_role_all" on public.assessment_attempts;
create policy "assessment_attempts_service_role_all"
on public.assessment_attempts
for all
to service_role
using (true)
with check (true);

drop policy if exists "assessment_answers_admin_all" on public.assessment_answers;
create policy "assessment_answers_admin_all"
on public.assessment_answers
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "assessment_answers_student_select_own" on public.assessment_answers;
create policy "assessment_answers_student_select_own"
on public.assessment_answers
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = assessment_answers.attempt_id
      and aa.user_id = auth.uid()
  )
);

drop policy if exists "assessment_answers_service_role_all" on public.assessment_answers;
create policy "assessment_answers_service_role_all"
on public.assessment_answers
for all
to service_role
using (true)
with check (true);

drop table if exists public.module_assessment_attempts;
drop table if exists public.module_assessments;

commit;