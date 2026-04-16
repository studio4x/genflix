begin;

create table if not exists public.global_quiz_type_settings (
  id smallint primary key default 1 check (id = 1),
  single_choice boolean not null default true,
  essay_ai boolean not null default true,
  drag_drop_labeling boolean not null default true,
  fill_in_the_blanks boolean not null default true,
  image_hotspot boolean not null default true,
  coloring boolean not null default true,
  case_study boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.global_quiz_type_settings is
  'Configura quais tipos de quiz estao disponiveis globalmente em toda a plataforma.';

drop trigger if exists set_global_quiz_type_settings_updated_at on public.global_quiz_type_settings;
create trigger set_global_quiz_type_settings_updated_at
before update on public.global_quiz_type_settings
for each row
execute procedure public.set_updated_at();

insert into public.global_quiz_type_settings (id)
values (1)
on conflict (id) do nothing;

grant select, insert, update on public.global_quiz_type_settings to authenticated;
grant all on public.global_quiz_type_settings to service_role;

alter table public.global_quiz_type_settings enable row level security;

drop policy if exists "global_quiz_type_settings_admin_all" on public.global_quiz_type_settings;
create policy "global_quiz_type_settings_admin_all"
on public.global_quiz_type_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "global_quiz_type_settings_service_role_all" on public.global_quiz_type_settings;
create policy "global_quiz_type_settings_service_role_all"
on public.global_quiz_type_settings
for all
to service_role
using (true)
with check (true);

commit;
