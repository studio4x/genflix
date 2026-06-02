begin;

create table if not exists public.external_user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_system text not null check (length(trim(source_system)) >= 2),
  external_user_id text not null check (length(trim(external_user_id)) >= 1),
  external_email text,
  external_reference_id text,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now()),
  unique (source_system, external_user_id),
  unique (source_system, user_id)
);

create index if not exists external_user_identities_user_id_idx
  on public.external_user_identities (user_id);

create table if not exists public.external_course_mappings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  source_system text not null check (length(trim(source_system)) >= 2),
  external_course_id text not null check (length(trim(external_course_id)) >= 1),
  external_reference_id text,
  is_active boolean not null default true,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now()),
  unique (source_system, external_course_id),
  unique (source_system, course_id)
);

create index if not exists external_course_mappings_course_id_idx
  on public.external_course_mappings (course_id);

create table if not exists public.integration_logs (
  id bigint generated always as identity primary key,
  source_system text not null check (length(trim(source_system)) >= 2),
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  event_type text not null check (length(trim(event_type)) >= 2),
  request_id text,
  correlation_id text,
  user_id uuid references auth.users (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  external_user_id text,
  external_course_id text,
  http_status integer,
  status text not null check (status in ('received', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists integration_logs_source_system_idx
  on public.integration_logs (source_system);
create index if not exists integration_logs_created_at_idx
  on public.integration_logs (created_at desc);
create index if not exists integration_logs_request_id_idx
  on public.integration_logs (request_id);

create table if not exists public.integration_access_nonces (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (length(trim(source_system)) >= 2),
  jti text not null check (length(trim(jti)) >= 8),
  external_user_id text not null check (length(trim(external_user_id)) >= 1),
  external_course_id text not null check (length(trim(external_course_id)) >= 1),
  expected_user_id uuid references auth.users (id) on delete cascade,
  expected_course_id uuid references public.courses (id) on delete cascade,
  redirect_path text not null check (length(trim(redirect_path)) >= 1),
  expires_at timest?mptz not null,
  consumed_at timest?mptz,
  created_at timest?mptz not null default timezone('utc', now()),
  unique (source_system, jti)
);

create index if not exists integration_access_nonces_expires_at_idx
  on public.integration_access_nonces (expires_at);

create table if not exists public.integration_event_outbox (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (length(trim(source_system)) >= 2),
  event_type text not null check (event_type in ('course.progress.updated', 'course.completed', 'course.approval.updated')),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timest?mptz not null default timezone('utc', now()),
  last_attempt_at timest?mptz,
  delivered_at timest?mptz,
  last_error text,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists integration_event_outbox_pending_idx
  on public.integration_event_outbox (delivery_status, next_attempt_at, created_at);
create index if not exists integration_event_outbox_course_user_idx
  on public.integration_event_outbox (course_id, user_id, created_at desc);

alter table public.course_releases
  add column if not exists source_system text;

alter table public.course_releases
  add column if not exists release_source text;

alter table public.course_releases
  add column if not exists release_status text not null default 'active';

alter table public.course_releases
  add column if not exists external_reference_id text;

alter table public.course_releases
  add column if not exists managed_by_integration boolean not null default false;

alter table public.course_releases
  add column if not exists last_synced_at timest?mptz;

alter table public.course_releases
  add column if not exists revoked_at timest?mptz;

alter table public.course_releases
  add column if not exists revoked_reason text;

create index if not exists course_releases_source_system_idx
  on public.course_releases (source_system);

alter table public.course_releases
  drop constraint if exists course_releases_release_source_check;

alter table public.course_releases
  add constraint course_releases_release_source_check
  check (
    release_source is null
    or release_source in ('purchase', 'free_enrollment', 'admin', 'group', 'integration')
  );

alter table public.course_releases
  drop constraint if exists course_releases_release_status_check;

alter table public.course_releases
  add constraint course_releases_release_status_check
  check (release_status in ('active', 'revoked', 'expired', 'pending'));

drop trigger if exists set_external_user_identities_updated_at on public.external_user_identities;
create trigger set_external_user_identities_updated_at
before update on public.external_user_identities
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_external_course_mappings_updated_at on public.external_course_mappings;
create trigger set_external_course_mappings_updated_at
before update on public.external_course_mappings
for each row
execute procedure public.set_updated_at();

create or replace function public.is_course_released(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_releases cr
    left join public.access_group_members agm
      on agm.group_id = cr.group_id
      and agm.user_id = _user_id
    where cr.course_id = _course_id
      and cr.is_active = true
      and cr.release_status = 'active'
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      and (
        (cr.release_type = 'user' and cr.user_id = _user_id)
        or (cr.release_type = 'group' and agm.user_id is not null)
      )
  );
$$;

create or replace function public.enqueue_integration_event(
  _source_system text,
  _event_type text,
  _user_id uuid,
  _course_id uuid,
  _payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _event_id uuid;
begin
  insert into public.integration_event_outbox (
    source_system,
    event_type,
    user_id,
    course_id,
    payload
  )
  values (
    _source_system,
    _event_type,
    _user_id,
    _course_id,
    coalesce(_payload, '{}'::jsonb)
  )
  returning id into _event_id;

  return _event_id;
end;
$$;

create or replace function public.get_course_integration_snapshot(_user_id uuid, _course_id uuid)
returns table (
  progress_percent integer,
  is_completed boolean,
  approval_status text,
  completed_at timest?mptz,
  last_activity_at timest?mptz
)
language sql
stable
security definer
set search_path = public
as $$
  with required_lessons as (
    select
      count(*)::int as total,
      count(lp.id)::int as completed
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    left join public.lesson_progress lp
      on lp.lesson_id = l.id
      and lp.user_id = _user_id
      and lp.is_completed = true
    where cm.course_id = _course_id
      and l.is_required = true
  ),
  required_module_assessments as (
    select
      count(*)::int as total,
      count(distinct case when aa.is_approved = true then a.id end)::int as completed
    from public.assessments a
    left join public.assessment_attempts aa
      on aa.assessment_id = a.id
      and aa.user_id = _user_id
      and aa.status = 'submitted'
    where a.course_id = _course_id
      and a.assessment_type = 'module'
      and a.is_required = true
      and a.is_active = true
  ),
  required_final_assessments as (
    select
      count(*)::int as total,
      count(distinct case when fas.is_approved = true then fas.assessment_id end)::int as completed,
      count(distinct case when fas.is_rejected = true then fas.assessment_id end)::int as rejected
    from (
      select
        a.id as assessment_id,
        exists (
          select 1
          from public.assessment_attempts aa
          where aa.assessment_id = a.id
            and aa.user_id = _user_id
            and aa.status = 'submitted'
            and aa.is_approved = true
        ) as is_approved,
        (
          select count(*)::int
          from public.assessment_attempts aa
          where aa.assessment_id = a.id
            and aa.user_id = _user_id
            and aa.status = 'submitted'
        ) >= a.max_attempts
        and exists (
          select 1
          from public.assessment_attempts aa
          where aa.assessment_id = a.id
            and aa.user_id = _user_id
            and aa.status = 'submitted'
        )
        and not exists (
          select 1
          from public.assessment_attempts aa
          where aa.assessment_id = a.id
            and aa.user_id = _user_id
            and aa.status = 'submitted'
            and aa.is_approved = true
        ) as is_rejected
      from public.assessments a
      where a.course_id = _course_id
        and a.assessment_type = 'final'
        and a.is_required = true
        and a.is_active = true
    ) fas
  ),
  totals as (
    select
      rl.total + rma.total + rfa.total as total_units,
      rl.completed + rma.completed + rfa.completed as completed_units,
      rfa.total as final_total,
      rfa.completed as final_completed,
      rfa.rejected as final_rejected
    from required_lessons rl
    cross join required_module_assessments rma
    cross join required_final_assessments rfa
  )
  select
    case
      when totals.total_units <= 0 then 0
      else least(100, greatest(0, round((totals.completed_units::numeric / totals.total_units::numeric) * 100)::int))
    end as progress_percent,
    public.is_course_completed(_user_id, _course_id) as is_completed,
    case
      when totals.final_total = 0 then 'not_applicable'
      when totals.final_completed > 0 then 'approved'
      when totals.final_rejected >= totals.final_total then 'rejected'
      else 'pending'
    end as approval_status,
    cp.completed_at,
    coalesce(cp.updated_at, timezone('utc', now())) as last_activity_at
  from totals
  left join public.course_progress cp
    on cp.user_id = _user_id
    and cp.course_id = _course_id;
$$;

create or replace function public.trg_enqueue_integration_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _lesson_id uuid;
  _user_id uuid;
  _course_id uuid;
begin
  _lesson_id := coalesce(new.lesson_id, old.lesson_id);
  _user_id := coalesce(new.user_id, old.user_id);

  select cm.course_id
    into _course_id
  from public.lessons l
  join public.course_modules cm on cm.id = l.module_id
  where l.id = _lesson_id
  limit 1;

  if _course_id is not null and _user_id is not null then
    perform public.enqueue_integration_event(
      'homecare_match',
      'course.progress.updated',
      _user_id,
      _course_id,
      jsonb_build_object('origin', 'lesson_progress')
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_integration_from_lesson_progress on public.lesson_progress;
create trigger trg_enqueue_integration_from_lesson_progress
after insert or update or delete on public.lesson_progress
for each row
execute procedure public.trg_enqueue_integration_from_lesson_progress();

create or replace function public.trg_enqueue_integration_from_assessment_attempts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _assessment_id uuid;
  _user_id uuid;
  _course_id uuid;
  _assessment_type text;
begin
  _assessment_id := coalesce(new.assessment_id, old.assessment_id);
  _user_id := coalesce(new.user_id, old.user_id);

  select a.course_id, a.assessment_type
    into _course_id, _assessment_type
  from public.assessments a
  where a.id = _assessment_id
  limit 1;

  if _course_id is not null and _user_id is not null then
    perform public.enqueue_integration_event(
      'homecare_match',
      'course.progress.updated',
      _user_id,
      _course_id,
      jsonb_build_object('origin', 'assessment_attempts')
    );

    if _assessment_type = 'final' then
      perform public.enqueue_integration_event(
        'homecare_match',
        'course.approval.updated',
        _user_id,
        _course_id,
        jsonb_build_object('origin', 'assessment_attempts')
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_integration_from_assessment_attempts on public.assessment_attempts;
create trigger trg_enqueue_integration_from_assessment_attempts
after insert or update on public.assessment_attempts
for each row
execute procedure public.trg_enqueue_integration_from_assessment_attempts();

create or replace function public.trg_enqueue_integration_from_course_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_completed = true and coalesce(old.is_completed, false) = false then
    perform public.enqueue_integration_event(
      'homecare_match',
      'course.completed',
      new.user_id,
      new.course_id,
      jsonb_build_object('origin', 'course_progress')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_integration_from_course_progress on public.course_progress;
create trigger trg_enqueue_integration_from_course_progress
after insert or update on public.course_progress
for each row
execute procedure public.trg_enqueue_integration_from_course_progress();

grant select, insert, update, delete on public.external_user_identities to authenticated;
grant select, insert, update, delete on public.external_course_mappings to authenticated;
grant select on public.integration_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.external_user_identities to service_role;
grant all on public.external_course_mappings to service_role;
grant all on public.integration_logs to service_role;
grant all on public.integration_access_nonces to service_role;
grant all on public.integration_event_outbox to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.external_user_identities enable row level security;
alter table public.external_course_mappings enable row level security;
alter table public.integration_logs enable row level security;
alter table public.integration_access_nonces enable row level security;
alter table public.integration_event_outbox enable row level security;

drop policy if exists "external_user_identities_admin_all" on public.external_user_identities;
create policy "external_user_identities_admin_all"
on public.external_user_identities
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "external_user_identities_service_role_all" on public.external_user_identities;
create policy "external_user_identities_service_role_all"
on public.external_user_identities
for all
to service_role
using (true)
with check (true);

drop policy if exists "external_course_mappings_admin_all" on public.external_course_mappings;
create policy "external_course_mappings_admin_all"
on public.external_course_mappings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "external_course_mappings_service_role_all" on public.external_course_mappings;
create policy "external_course_mappings_service_role_all"
on public.external_course_mappings
for all
to service_role
using (true)
with check (true);

drop policy if exists "integration_logs_admin_select" on public.integration_logs;
create policy "integration_logs_admin_select"
on public.integration_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "integration_logs_service_role_all" on public.integration_logs;
create policy "integration_logs_service_role_all"
on public.integration_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "integration_access_nonces_service_role_all" on public.integration_access_nonces;
create policy "integration_access_nonces_service_role_all"
on public.integration_access_nonces
for all
to service_role
using (true)
with check (true);

drop policy if exists "integration_event_outbox_admin_select" on public.integration_event_outbox;
create policy "integration_event_outbox_admin_select"
on public.integration_event_outbox
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "integration_event_outbox_service_role_all" on public.integration_event_outbox;
create policy "integration_event_outbox_service_role_all"
on public.integration_event_outbox
for all
to service_role
using (true)
with check (true);

commit;
