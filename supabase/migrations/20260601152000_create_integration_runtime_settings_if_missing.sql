begin;

create table if not exists public.integration_runtime_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.integration_runtime_settings enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists set_integration_runtime_settings_updated_at on public.integration_runtime_settings';
    execute 'create trigger set_integration_runtime_settings_updated_at before update on public.integration_runtime_settings for each row execute procedure public.set_updated_at()';
  end if;
end $$;

drop policy if exists "integration_runtime_settings_service_role_all" on public.integration_runtime_settings;
create policy "integration_runtime_settings_service_role_all"
on public.integration_runtime_settings
for all
to service_role
using (true)
with check (true);

grant all on public.integration_runtime_settings to service_role;

commit;
