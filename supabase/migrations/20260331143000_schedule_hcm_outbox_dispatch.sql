begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.integration_runtime_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timest?mptz not null default timezone('utc', now())
);

drop trigger if exists set_integration_runtime_settings_updated_at on public.integration_runtime_settings;
create trigger set_integration_runtime_settings_updated_at
before update on public.integration_runtime_settings
for each row
execute procedure public.set_updated_at();

grant all on public.integration_runtime_settings to service_role;
alter table public.integration_runtime_settings enable row level security;

drop policy if exists "integration_runtime_settings_service_role_all" on public.integration_runtime_settings;
create policy "integration_runtime_settings_service_role_all"
on public.integration_runtime_settings
for all
to service_role
using (true)
with check (true);

create or replace function public.unschedule_hcm_outbox_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _job record;
begin
  for _job in
    select jobid
    from cron.job
    where jobname = 'hcm-outbox-dispatch'
  loop
    perform cron.unschedule(_job.jobid);
  end loop;
end;
$$;

create or replace function public.schedule_hcm_outbox_dispatch(_schedule text default '*/5 * * * *')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _project_url text;
  _cron_secret text;
  _job_id bigint;
begin
  select value
    into _project_url
  from public.integration_runtime_settings
  where key = 'supabase_project_url'
  limit 1;

  select value
    into _cron_secret
  from public.integration_runtime_settings
  where key = 'hcm_edge_cron_secret'
  limit 1;

  if _project_url is null or length(trim(_project_url)) = 0 then
    raise exception 'Configurao integration_runtime_settings.supabase_project_url ausente.';
  end if;

  if _cron_secret is null or length(trim(_cron_secret)) = 0 then
    raise exception 'Configurao integration_runtime_settings.hcm_edge_cron_secret ausente.';
  end if;

  perform public.unschedule_hcm_outbox_dispatch();

  select cron.schedule(
    'hcm-outbox-dispatch',
    _schedule,
    format(
      $job$
        select
          net.http_post(
            url := %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', %L
            ),
            body := '{}'::jsonb
          ) as request_id;
      $job$,
      _project_url || '/functions/v1/hcm-outbox-dispatch',
      'Bearer ' || _cron_secret
    )
  )
  into _job_id;

  return _job_id;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.integration_runtime_settings
    where key = 'supabase_project_url'
  ) and exists (
    select 1
    from public.integration_runtime_settings
    where key = 'hcm_edge_cron_secret'
  ) then
    perform public.schedule_hcm_outbox_dispatch();
  end if;
exception
  when others then
    raise notice 'N?o foi possvel agendar hcm-outbox-dispatch automticamente: %', sqlerrm;
end
$$;

commit;
