begin;

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
  if to_regclass('public.integration_runtime_settings') is null then
    raise exception 'Tabela public.integration_runtime_settings ausente.';
  end if;

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
      rtrim(_app_public_url, '/') || '/api/admin/notifications?task=run_scheduled_security_scan',
      _cron_secret
    )
  ) into _job_id;

  return _job_id;
end;
$$;

select public.sync_security_scan_cron();

commit;
