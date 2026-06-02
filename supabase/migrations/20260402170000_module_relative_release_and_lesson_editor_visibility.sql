begin;

alter table public.course_modules
  add column if not exists release_days_after_enrollment integer;

alter table public.course_modules
  drop constraint if exists course_modules_release_days_after_enrollment_check;

alter table public.course_modules
  add constraint course_modules_release_days_after_enrollment_check
  check (release_days_after_enrollment is null or release_days_after_enrollment >= 0);

create or replace function public.get_course_release_reference_at(_user_id uuid, _course_id uuid)
returns timest?mptz
language sql
stable
security definer
set search_path = public
as $$
  with effective_releases as (
    select
      case
        when cr.release_type = 'user'
          then coalesce(cr.starts_at, cr.created_at)
        when cr.release_type = 'group' and agm.user_id is not null
          then greatest(coalesce(cr.starts_at, cr.created_at), agm.created_at)
        else null
      end as effective_at
    from public.course_releases cr
    left join public.access_group_members agm
      on agm.group_id = cr.group_id
      and agm.user_id = _user_id
    where cr.course_id = _course_id
      and cr.is_active = true
      and coalesce(cr.release_status, 'active') = 'active'
      and (
        (cr.release_type = 'user' and cr.user_id = _user_id)
        or (cr.release_type = 'group' and agm.user_id is not null)
      )
  )
  select min(effective_at)
  from effective_releases
  where effective_at is not null;
$$;

drop function if exists public.is_module_scheduled_open_for_user(uuid, uuid, timest?mptz);

create or replace function public.is_module_scheduled_open_for_user(
  _user_id uuid,
  _module_id uuid,
  _reference timest?mptz default timezone('utc', now())
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_starts_at timest?mptz;
  v_ends_at timest?mptz;
  v_release_days integer;
  v_release_reference timest?mptz;
begin
  select
    cm.course_id,
    cm.starts_at,
    cm.ends_at,
    cm.release_days_after_enrollment
  into
    v_course_id,
    v_starts_at,
    v_ends_at,
    v_release_days
  from public.course_modules cm
  where cm.id = _module_id;

  if v_course_id is null then
    return false;
  end if;

  if v_starts_at is not null and v_starts_at > _reference then
    return false;
  end if;

  if v_ends_at is not null and v_ends_at < _reference then
    return false;
  end if;

  if v_release_days is not null then
    v_release_reference := public.get_course_release_reference_at(_user_id, v_course_id);

    if v_release_reference is null then
      return false;
    end if;

    if v_release_reference + make_interval(days => v_release_days) > _reference then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.is_module_unlocked(_user_id uuid, _module_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_linear boolean;
  v_prev_module_id uuid;
begin
  select c.has_linear_progression
    into v_has_linear
  from public.course_modules cm
  join public.courses c on c.id = cm.course_id
  where cm.id = _module_id;

  if v_has_linear is null then
    return false;
  end if;

  if public.has_role(_user_id, 'admin') then
    return true;
  end if;

  if public.is_module_scheduled_open_for_user(_user_id, _module_id) = false then
    return false;
  end if;

  if v_has_linear = false then
    return true;
  end if;

  select cm_prev.id
    into v_prev_module_id
  from public.course_modules cm_prev
  join public.course_modules cm_curr on cm_curr.course_id = cm_prev.course_id
  where cm_curr.id = _module_id
    and cm_prev.position < cm_curr.position
  order by cm_prev.position desc
  limit 1;

  if v_prev_module_id is null then
    return true;
  end if;

  return public.is_module_completed(_user_id, v_prev_module_id);
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
  progress_percent integer,
  starts_at timest?mptz,
  ends_at timest?mptz,
  module_pdf_file_name text,
  module_pdf_storage_path text
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
      and (
        (public.has_role(cu.user_id, 'student') and public.is_course_released(cu.user_id, _course_id))
        or public.has_role(cu.user_id, 'admin')
      )
  ),
  module_base as (
    select
      cm.id as module_id,
      cm.position,
      cm.title,
      cm.description,
      cm.is_required,
      cm.starts_at,
      cm.ends_at,
      cm.module_pdf_file_name,
      cm.module_pdf_storage_path,
      case
        when public.has_role(cu.user_id, 'admin') then true
        else public.is_module_scheduled_open_for_user(cu.user_id, cm.id)
      end as is_scheduled_open,
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
        left join public.lesson_progress lp
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
    cross join ctx_user cu
    where cm.course_id = _course_id
  )
  select
    mb.module_id,
    mb.position as module_position,
    mb.title,
    mb.description,
    mb.is_required,
    case
      when mb.is_scheduled_open = false then 'blocked_by_schedule'
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
    end as progress_percent,
    mb.starts_at,
    mb.ends_at,
    mb.module_pdf_file_name,
    mb.module_pdf_storage_path
  from module_base mb
  where exists (select 1 from allowed)
  order by module_position asc;
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
      and (
        (public.has_role(cu.user_id, 'student') and public.is_course_released(cu.user_id, _course_id))
        or public.has_role(cu.user_id, 'admin')
      )
  ),
  assessment_base as (
    select
      a.id as assessment_id,
      a.assessment_type::text as assessment_type,
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
      ) as last_is_approved,
      case
        when public.has_role(cu.user_id, 'admin') then true
        when a.assessment_type = 'module' and a.module_id is not null then public.is_module_scheduled_open_for_user(cu.user_id, a.module_id)
        else true
      end as is_scheduled_open
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
      when ab.is_scheduled_open = false then 'blocked_by_schedule'
      when ab.is_unlocked = false then 'blocked'
      when coalesce(ab.last_is_approved, false) = true then 'approved'
      when ab.attempts_used >= ab.max_attempts then 'failed_limit'
      else 'available'
    end as state
  from assessment_base ab
  where exists (select 1 from allowed)
  order by ab.module_position nulls last, ab.assessment_type;
$$;

grant execute on function public.get_course_release_reference_at(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_module_scheduled_open_for_user(uuid, uuid, timest?mptz) to authenticated, service_role;

commit;
