begin;

-- 1. Tabela de Definições de Botões Globais Reutilizáveis (Biblioteca Central)
create table if not exists public.global_button_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) >= 2),
  label text not null check (length(trim(label)) >= 1),
  template_id uuid references public.button_templates (id) on delete set null,
  action_type text not null check (action_type in ('url', 'file', 'modal')),
  url text,
  open_target text not null default 'new-tab' check (open_target in ('same-tab', 'new-tab', 'new-window')),
  storage_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  modal_title text,
  modal_blocks jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (action_type = 'file' and storage_path is not null and coalesce(trim(file_name), '') <> '')
    or
    (action_type = 'url' and coalesce(trim(url), '') <> '')
    or
    (action_type = 'modal' and modal_title is not null and coalesce(trim(modal_title), '') <> '')
  )
);

create index if not exists global_button_definitions_template_id_idx
  on public.global_button_definitions (template_id);

create index if not exists global_button_definitions_is_active_idx
  on public.global_button_definitions (is_active);

drop trigger if exists set_global_button_definitions_updated_at on public.global_button_definitions;
create trigger set_global_button_definitions_updated_at
before update on public.global_button_definitions
for each row
execute procedure public.set_updated_at();

-- 2. Evolução da tabela de posicionamentos no rodapé (lesson_footer_actions)
alter table public.lesson_footer_actions
  add column if not exists global_button_id uuid references public.global_button_definitions (id) on delete set null,
  add column if not exists modal_title text,
  add column if not exists modal_blocks jsonb default '[]'::jsonb;

-- Atualização da constraint de action_type para permitir 'modal' em lesson_footer_actions
do $$
begin
  alter table public.lesson_footer_actions
    drop constraint if exists lesson_footer_actions_action_type_check;

  alter table public.lesson_footer_actions
    add constraint lesson_footer_actions_action_type_check
    check (action_type in ('file', 'url', 'modal'));
exception
  when others then null;
end $$;

-- Atualização da constraint de integridade de dados por action_type em lesson_footer_actions
do $$
begin
  alter table public.lesson_footer_actions
    drop constraint if exists lesson_footer_actions_check;

  alter table public.lesson_footer_actions
    add constraint lesson_footer_actions_check
    check (
      (action_type = 'file' and storage_path is not null and coalesce(trim(file_name), '') <> '')
      or
      (action_type = 'url' and coalesce(trim(url), '') <> '')
      or
      (action_type = 'modal' and modal_title is not null and coalesce(trim(modal_title), '') <> '')
    );
exception
  when others then null;
end $$;

create index if not exists lesson_footer_actions_global_button_id_idx
  on public.lesson_footer_actions (global_button_id);

-- 3. Permissões e RLS
grant select, insert, update, delete on public.global_button_definitions to authenticated;
grant all on public.global_button_definitions to service_role;

alter table public.global_button_definitions enable row level security;

-- Admin possui controle total
drop policy if exists "global_button_definitions_admin_all" on public.global_button_definitions;
create policy "global_button_definitions_admin_all"
on public.global_button_definitions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Aluno pode apenas visualizar definições ATIVAS para renderização do player
drop policy if exists "global_button_definitions_student_select" on public.global_button_definitions;
create policy "global_button_definitions_student_select"
on public.global_button_definitions
for select
to authenticated
using (
  is_active = true
  and (
    public.has_role(auth.uid(), 'student')
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "global_button_definitions_service_role_all" on public.global_button_definitions;
create policy "global_button_definitions_service_role_all"
on public.global_button_definitions
for all
to service_role
using (true)
with check (true);

commit;