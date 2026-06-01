begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.security_scan_settings (
  id uuid primary key default gen_random_uuid(),
  cron_expression text not null default '0 */6 * * *',
  auto_fix_enabled boolean not null default false,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.security_scan_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('manual', 'scheduled')),
  status text not null check (status in ('running', 'completed', 'failed')) default 'running',
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  findings_total integer not null default 0,
  findings_open integer not null default 0,
  findings_fixed integer not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.security_scan_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.security_scan_runs(id) on delete cascade,
  scanner_key text not null,
  title text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  status text not null check (status in ('open', 'fixed')) default 'open',
  description text not null,
  evidence text,
  recommendation text,
  fix_available boolean not null default false,
  auto_fix_supported boolean not null default false,
  fixed_at timestamptz,
  fixed_by uuid references auth.users(id) on delete set null,
  fixed_via text check (fixed_via in ('manual', 'automatic')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.security_scan_fixes (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.security_scan_findings(id) on delete cascade,
  run_id uuid references public.security_scan_runs(id) on delete set null,
  action_type text not null check (action_type in ('manual', 'automatic')),
  status text not null check (status in ('applied', 'failed')),
  details text,
  applied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_security_scan_runs_started_at on public.security_scan_runs(started_at desc);
create index if not exists idx_security_scan_findings_run_id on public.security_scan_findings(run_id);
create index if not exists idx_security_scan_findings_status on public.security_scan_findings(status);
create index if not exists idx_security_scan_fixes_finding_id on public.security_scan_fixes(finding_id);

insert into public.security_scan_settings (cron_expression, auto_fix_enabled, enabled)
select '0 */6 * * *', false, true
where not exists (select 1 from public.security_scan_settings);

alter table public.security_scan_settings enable row level security;
alter table public.security_scan_runs enable row level security;
alter table public.security_scan_findings enable row level security;
alter table public.security_scan_fixes enable row level security;

drop policy if exists "security_scan_settings_service_role_all" on public.security_scan_settings;
create policy "security_scan_settings_service_role_all"
on public.security_scan_settings
for all
to service_role
using (true)
with check (true);

drop policy if exists "security_scan_runs_service_role_all" on public.security_scan_runs;
create policy "security_scan_runs_service_role_all"
on public.security_scan_runs
for all
to service_role
using (true)
with check (true);

drop policy if exists "security_scan_findings_service_role_all" on public.security_scan_findings;
create policy "security_scan_findings_service_role_all"
on public.security_scan_findings
for all
to service_role
using (true)
with check (true);

drop policy if exists "security_scan_fixes_service_role_all" on public.security_scan_fixes;
create policy "security_scan_fixes_service_role_all"
on public.security_scan_fixes
for all
to service_role
using (true)
with check (true);

grant all on public.security_scan_settings to service_role;
grant all on public.security_scan_runs to service_role;
grant all on public.security_scan_findings to service_role;
grant all on public.security_scan_fixes to service_role;

create or replace function public.unschedule_security_scan_cron()
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
    where jobname = 'admin-security-scan'
  loop
    perform cron.unschedule(_job.jobid);
  end loop;
end;
$$;

create or replace function public.schedule_security_scan_cron(_schedule text default '0 */6 * * *')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  _app_public_url text;
  _cron_secret text;
  _job_id bigint;
begin
  select value into _app_public_url
  from public.integration_runtime_settings
  where key = 'app_public_url'
  limit 1;

  select value into _cron_secret
  from public.integration_runtime_settings
  where key = 'admin_api_cron_secret'
  limit 1;

  if _app_public_url is null or length(trim(_app_public_url)) = 0 then
    raise exception 'Configuracao integration_runtime_settings.app_public_url ausente.';
  end if;

  if _cron_secret is null or length(trim(_cron_secret)) = 0 then
    raise exception 'Configuracao integration_runtime_settings.admin_api_cron_secret ausente.';
  end if;

  perform public.unschedule_security_scan_cron();

  select cron.schedule(
    'admin-security-scan',
    _schedule,
    format(
      $job$
        select
          net.http_post(
            url := %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-cron-secret', %L
            ),
            body := '{"action":"run_scan"}'::jsonb
          ) as request_id;
      $job$,
      rtrim(_app_public_url, '/') || '/api/admin/security-scans?task=run_scheduled',
      _cron_secret
    )
  ) into _job_id;

  return _job_id;
end;
$$;

create or replace function public.sync_security_scan_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _settings record;
begin
  select * into _settings
  from public.security_scan_settings
  order by updated_at desc
  limit 1;

  if _settings is null then
    perform public.unschedule_security_scan_cron();
    return;
  end if;

  if _settings.enabled then
    perform public.schedule_security_scan_cron(_settings.cron_expression);
  else
    perform public.unschedule_security_scan_cron();
  end if;
end;
$$;

drop trigger if exists set_security_scan_settings_updated_at on public.security_scan_settings;
create trigger set_security_scan_settings_updated_at
before update on public.security_scan_settings
for each row
execute procedure public.set_updated_at();

create or replace function public.handle_security_scan_settings_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_security_scan_cron();
  return new;
end;
$$;

drop trigger if exists trigger_security_scan_settings_sync on public.security_scan_settings;
create trigger trigger_security_scan_settings_sync
after insert or update on public.security_scan_settings
for each row
execute procedure public.handle_security_scan_settings_sync();

do $$
begin
  perform public.sync_security_scan_cron();
exception
  when others then
    raise notice 'Nao foi possivel sincronizar cron de security scan automaticamente: %', sqlerrm;
end
$$;

commit;

