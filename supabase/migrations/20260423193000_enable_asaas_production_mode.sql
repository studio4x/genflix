begin;

insert into public.payment_gateway_settings (
  id,
  gateway_code,
  environment,
  is_active
)
values (
  1,
  'asaas',
  'production',
  true
)
on conflict (id) do update
set
  gateway_code = excluded.gateway_code,
  environment = excluded.environment,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

commit;
