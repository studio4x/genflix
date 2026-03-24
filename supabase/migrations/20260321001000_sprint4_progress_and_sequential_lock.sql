begin;

create table if not exists public.module_assessments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.course_modules (id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  is_required boolean not null default false,
  passing_score numeric(5, 2) not null default 70.00 check (passing_score >= 0 and passing_score <= 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists module_assessments_module_id_idx
  on public.module_assessments (module_id);

create table if not exists public.module_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.module_assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  is_approved boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists module_assessment_attempts_assessment_user_idx
  on public.module_assessment_attempts (assessment_id, user_id);
create index if not exists module_assessment_attempts_user_submitted_idx
  on public.module_assessment_attempts (user_id, submitted_at desc);

create table if not exists public.lesson_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  is_completed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, lesson_id),
  check (
    (is_completed = true and completed_at is not null)
    or (is_completed = false and completed_at is null)
  )
);

create index if not exists lesson_progress_user_id_idx
  on public.lesson_progress (user_id);
create index if not exists lesson_progress_lesson_id_idx
  on public.lesson_progress (lesson_id);

create or replace function public.set_lesson_progress_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_completed then
    if new.completed_at is null then
      new.completed_at = timezone('utc', now());
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_module_assessments_updated_at on public.module_assessments;
create trigger set_module_assessments_updated_at
before update on public.module_assessments
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_lesson_progress_updated_at on public.lesson_progress;
create trigger set_lesson_progress_updated_at
before update on public.lesson_progress
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_lesson_progress_completed_at on public.lesson_progress;
create trigger set_lesson_progress_completed_at
before insert or update on public.lesson_progress
for each row
execute procedure public.set_lesson_progress_completed_at();

create or replace function public.is_required_module_assessment_approved(_user_id uuid, _module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_assessments ma
    join public.module_assessment_attempts maa on maa.assessment_id = ma.id
    where ma.module_id = _module_id
      and ma.is_required = true
      and maa.user_id = _user_id
      and maa.is_approved = true
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
      from public.module_assessments ma
      where ma.module_id = _module_id
        and ma.is_required = true
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

create or replace function public.is_module_unlocked(_user_id uuid, _module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_module as (
    select cm.id, cm.course_id, cm.position
    from public.course_modules cm
    where cm.id = _module_id
    limit 1
  ),
  previous_module as (
    select cm_prev.id
    from public.course_modules cm_prev
    join current_module cm on cm.course_id = cm_prev.course_id
    where cm_prev.position < cm.position
    order by cm_prev.position desc
    limit 1
  )
  select case
    when not exists (select 1 from current_module) then false
    when not exists (select 1 from previous_module) then true
    else public.is_module_completed(
      _user_id,
      (select id from previous_module)
    )
  end;
$$;

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
        from public.module_assessments ma
        where ma.module_id = cm.id
          and ma.is_required = true
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

create or replace function public.get_student_unlocked_lessons_progress(_course_id uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  module_position integer,
  lesson_position integer,
  title text,
  description text,
  is_required boolean,
  youtube_url text,
  estimated_minutes integer,
  is_completed boolean,
  completed_at timestamptz
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
  )
  select
    l.id as lesson_id,
    cm.id as module_id,
    cm.position as module_position,
    l.position as lesson_position,
    l.title,
    l.description,
    l.is_required,
    l.youtube_url,
    l.estimated_minutes,
    coalesce(lp.is_completed, false) as is_completed,
    lp.completed_at
  from public.course_modules cm
  join public.lessons l on l.module_id = cm.id
  join ctx_user cu on true
  left join public.lesson_progress lp
    on lp.lesson_id = l.id
    and lp.user_id = cu.user_id
  where cm.course_id = _course_id
    and public.is_module_unlocked(cu.user_id, cm.id)
    and exists (select 1 from allowed)
  order by cm.position asc, l.position asc;
$$;

grant execute on function public.is_required_module_assessment_approved(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_module_completed(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_module_unlocked(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_student_course_modules_progress(uuid) to authenticated, service_role;
grant execute on function public.get_student_unlocked_lessons_progress(uuid) to authenticated, service_role;

grant select, insert, update, delete on public.module_assessments to authenticated;
grant select, insert, update, delete on public.module_assessment_attempts to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.module_assessments to service_role;
grant all on public.module_assessment_attempts to service_role;
grant all on public.lesson_progress to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.module_assessments enable row level security;
alter table public.module_assessment_attempts enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "module_assessments_admin_all" on public.module_assessments;
create policy "module_assessments_admin_all"
on public.module_assessments
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "module_assessments_service_role_all" on public.module_assessments;
create policy "module_assessments_service_role_all"
on public.module_assessments
for all
to service_role
using (true)
with check (true);

drop policy if exists "module_assessment_attempts_admin_all" on public.module_assessment_attempts;
create policy "module_assessment_attempts_admin_all"
on public.module_assessment_attempts
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "module_assessment_attempts_service_role_all" on public.module_assessment_attempts;
create policy "module_assessment_attempts_service_role_all"
on public.module_assessment_attempts
for all
to service_role
using (true)
with check (true);

drop policy if exists "lesson_progress_student_select_own" on public.lesson_progress;
create policy "lesson_progress_student_select_own"
on public.lesson_progress
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where l.id = lesson_progress.lesson_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
  )
);

drop policy if exists "lesson_progress_student_insert_own" on public.lesson_progress;
create policy "lesson_progress_student_insert_own"
on public.lesson_progress
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where l.id = lesson_progress.lesson_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
  )
);

drop policy if exists "lesson_progress_student_update_own" on public.lesson_progress;
create policy "lesson_progress_student_update_own"
on public.lesson_progress
for update
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
)
with check (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where l.id = lesson_progress.lesson_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
  )
);

drop policy if exists "lesson_progress_student_delete_own" on public.lesson_progress;
create policy "lesson_progress_student_delete_own"
on public.lesson_progress
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and user_id = auth.uid()
);

drop policy if exists "lesson_progress_admin_all" on public.lesson_progress;
create policy "lesson_progress_admin_all"
on public.lesson_progress
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lesson_progress_service_role_all" on public.lesson_progress;
create policy "lesson_progress_service_role_all"
on public.lesson_progress
for all
to service_role
using (true)
with check (true);

drop policy if exists "lessons_student_released_select" on public.lessons;
create policy "lessons_student_released_select"
on public.lessons
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.course_modules cm
    join public.courses c on c.id = cm.course_id
    where cm.id = lessons.module_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
  )
);

commit;