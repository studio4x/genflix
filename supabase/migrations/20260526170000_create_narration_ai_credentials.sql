create table if not exists public.narration_ai_credentials (
  id boolean primary key default true check (id = true),
  openai_api_key text,
  gemini_api_key text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_narration_ai_credentials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_narration_ai_credentials_updated_at on public.narration_ai_credentials;
create trigger set_narration_ai_credentials_updated_at
before update on public.narration_ai_credentials
for each row
execute function public.set_narration_ai_credentials_updated_at();

alter table public.narration_ai_credentials enable row level security;

revoke all on public.narration_ai_credentials from anon, authenticated;
grant all on public.narration_ai_credentials to service_role;

drop policy if exists "narration_ai_credentials_service_role_all" on public.narration_ai_credentials;
create policy "narration_ai_credentials_service_role_all"
on public.narration_ai_credentials
for all
to service_role
using (true)
with check (true);

insert into public.narration_ai_credentials (id, openai_api_key, gemini_api_key)
values (
  true,
  nullif(current_setting('app.settings.openai_api_key', true), ''),
  nullif(current_setting('app.settings.gemini_api_key', true), '')
)
on conflict (id) do nothing;
