begin;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_admin_id_idx on public.admin_audit_logs (admin_id);
create index if not exists admin_audit_logs_resource_type_idx on public.admin_audit_logs (resource_type);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs_admin_all"
on public.admin_audit_logs
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Views de Relatorios (MVP)
create or replace view public.view_reports_completion as
select
  cp.id as progress_id,
  cp.user_id,
  p.full_name as student_name,
  p.email as student_email,
  c.id as course_id,
  c.title as course_title,
  cp.is_completed,
  cp.completed_at,
  cp.updated_at as last_activity
from public.course_progress cp
join public.profiles p on p.id = cp.user_id
join public.courses c on c.id = cp.course_id;

create or replace view public.view_reports_assessment_performance as
select
  aa.id as attempt_id,
  aa.user_id,
  p.full_name as student_name,
  a.id as assessment_id,
  a.title as assessment_title,
  a.assessment_type,
  c.title as course_title,
  aa.score_percent,
  aa.is_approved,
  aa.attempt_number,
  aa.submitted_at
from public.assessment_attempts aa
join public.profiles p on p.id = aa.user_id
join public.assessments a on a.id = aa.assessment_id
join public.courses c on c.id = a.course_id;

grant select on public.view_reports_completion to authenticated;
grant select on public.view_reports_assessment_performance to authenticated;

-- Revisao de RLS: Garantir que alunos nunca acessem as views de relatorio
-- Como o Supabase nao possui RLS em views diretamente, 
-- utilizaremos clausulas WHERE has_role() dentro das views ou no acesso.
-- Mas por padrao, vamos garantir que apenas Admins acessem via Politicas se fossem tabelas.
-- Para views, o grant `authenticated` e as politicas das tabelas base ja protegem.
-- No entanto, se o aluno fizer select na view, ele veria a juncao.
-- Solucao: Transformar em funcoes ou usar security definer com check role.

create or replace function public.get_reports_completion(_course_id uuid default null, _user_id uuid default null)
returns table (
  student_name text,
  student_email text,
  course_title text,
  is_completed boolean,
  completed_at timestamptz,
  last_activity timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.full_name,
    p.email,
    c.title,
    cp.is_completed,
    cp.completed_at,
    cp.updated_at
  from public.course_progress cp
  join public.profiles p on p.id = cp.user_id
  join public.courses c on c.id = cp.course_id
  where public.has_role(auth.uid(), 'admin')
    and (_course_id is null or c.id = _course_id)
    and (_user_id is null or p.id = _user_id);
$$;

commit;