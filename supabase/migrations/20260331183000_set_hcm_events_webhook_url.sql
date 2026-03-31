begin;

insert into public.integration_runtime_settings (key, value, description)
values (
  'hcm_events_webhook_url',
  'https://rkjvtnadqkbwomgzyswr.supabase.co/functions/v1/lms-events-webhook',
  'Webhook privado da plataforma principal HomeCare Match para receber eventos do LMS.'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = timezone('utc', now());

commit;
