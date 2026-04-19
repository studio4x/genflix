begin;

do $$
declare
  cron_job record;
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    for cron_job in
      select jobid
      from cron.job
      where jobname = 'hcm-outbox-dispatch'
    loop
      perform cron.unschedule(cron_job.jobid);
    end loop;
  end if;
exception
  when undefined_table then null;
  when insufficient_privilege then null;
end $$;

do $$
begin
  if to_regclass('public.lesson_progress') is not null then
    drop trigger if exists trg_enqueue_integration_from_lesson_progress on public.lesson_progress;
  end if;

  if to_regclass('public.assessment_attempts') is not null then
    drop trigger if exists trg_enqueue_integration_from_assessment_attempts on public.assessment_attempts;
  end if;

  if to_regclass('public.course_progress') is not null then
    drop trigger if exists trg_enqueue_integration_from_course_progress on public.course_progress;
  end if;

  if to_regclass('public.external_user_identities') is not null then
    drop trigger if exists set_external_user_identities_updated_at on public.external_user_identities;
  end if;

  if to_regclass('public.external_course_mappings') is not null then
    drop trigger if exists set_external_course_mappings_updated_at on public.external_course_mappings;
  end if;

  if to_regclass('public.integration_runtime_settings') is not null then
    drop trigger if exists set_integration_runtime_settings_updated_at on public.integration_runtime_settings;
  end if;
end $$;

drop function if exists public.trg_enqueue_integration_from_lesson_progress();
drop function if exists public.trg_enqueue_integration_from_assessment_attempts();
drop function if exists public.trg_enqueue_integration_from_course_progress();
drop function if exists public.enqueue_integration_event(text, text, uuid, uuid, jsonb);
drop function if exists public.get_course_integration_snapshot(uuid, uuid);
drop function if exists public.schedule_hcm_outbox_dispatch(text);
drop function if exists public.unschedule_hcm_outbox_dispatch();

drop table if exists public.integration_event_outbox cascade;
drop table if exists public.integration_access_nonces cascade;
drop table if exists public.integration_logs cascade;
drop table if exists public.external_course_mappings cascade;
drop table if exists public.external_user_identities cascade;
drop table if exists public.integration_runtime_settings cascade;

update public.course_releases
set release_source = 'admin'
where release_source = 'integration';

alter table public.course_releases
  drop constraint if exists course_releases_release_source_check;

alter table public.course_releases
  add constraint course_releases_release_source_check
  check (
    release_source is null
    or release_source in ('purchase', 'free_enrollment', 'admin', 'group')
  );

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
      and coalesce(cr.release_status, 'active') = 'active'
      and cr.revoked_at is null
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      and (
        (cr.release_type = 'user' and cr.user_id = _user_id)
        or (cr.release_type = 'group' and agm.user_id is not null)
      )
  );
$$;

-- Storage buckets, when present, must be removed through the Storage API or dashboard.
-- Direct deletes from storage.buckets are blocked by Supabase managed triggers.

delete from public.admin_bootstrap_emails
where lower(email) in ('contato@homecarematch.com.br', 'admin@homecarematch.com');

insert into public.admin_bootstrap_emails (email)
values ('contato@studio4x.com.br')
on conflict (email) do nothing;

commit;
