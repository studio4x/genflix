begin;

alter table public.course_modules
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists module_pdf_storage_path text,
  add column if not exists module_pdf_file_name text,
  add column if not exists module_pdf_uploaded_at timestamptz;

alter table public.lessons
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

create table if not exists public.button_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) >= 2),
  default_label text not null check (length(trim(default_label)) >= 2),
  variant text not null default 'outline' check (variant in ('primary', 'secondary', 'outline', 'ghost', 'link')),
  theme text not null default 'slate' check (theme in ('blue', 'emerald', 'amber', 'rose', 'slate', 'violet')),
  icon text not null default 'link' check (length(trim(icon)) >= 2),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lesson_footer_actions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  template_id uuid references public.button_templates (id) on delete set null,
  action_type text not null check (action_type in ('file', 'url')),
  label text,
  url text,
  storage_path text unique,
  file_name text,
  mime_type text,
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  position integer not null default 1 check (position > 0),
  open_in_new_tab boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (action_type = 'file' and storage_path is not null and coalesce(trim(file_name), '') <> '')
    or
    (action_type = 'url' and coalesce(trim(url), '') <> '')
  )
);

create unique index if not exists lesson_footer_actions_lesson_position_idx
  on public.lesson_footer_actions (lesson_id, position);

create index if not exists lesson_footer_actions_lesson_id_idx
  on public.lesson_footer_actions (lesson_id);

create index if not exists lesson_footer_actions_template_id_idx
  on public.lesson_footer_actions (template_id);

drop trigger if exists set_button_templates_updated_at on public.button_templates;
create trigger set_button_templates_updated_at
before update on public.button_templates
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_lesson_footer_actions_updated_at on public.lesson_footer_actions;
create trigger set_lesson_footer_actions_updated_at
before update on public.lesson_footer_actions
for each row
execute procedure public.set_updated_at();

grant select, insert, update, delete on public.button_templates to authenticated;
grant select, insert, update, delete on public.lesson_footer_actions to authenticated;
grant all on public.button_templates to service_role;
grant all on public.lesson_footer_actions to service_role;

alter table public.button_templates enable row level security;
alter table public.lesson_footer_actions enable row level security;

drop policy if exists "button_templates_admin_all" on public.button_templates;
create policy "button_templates_admin_all"
on public.button_templates
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "button_templates_student_select" on public.button_templates;
create policy "button_templates_student_select"
on public.button_templates
for select
to authenticated
using (
  is_active = true
  and (
    public.has_role(auth.uid(), 'student')
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "button_templates_service_role_all" on public.button_templates;
create policy "button_templates_service_role_all"
on public.button_templates
for all
to service_role
using (true)
with check (true);

drop policy if exists "lesson_footer_actions_admin_all" on public.lesson_footer_actions;
create policy "lesson_footer_actions_admin_all"
on public.lesson_footer_actions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lesson_footer_actions_service_role_all" on public.lesson_footer_actions;
create policy "lesson_footer_actions_service_role_all"
on public.lesson_footer_actions
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'module-pdfs',
    'module-pdfs',
    false,
    52428800,
    array['application/pdf']
  ),
  (
    'lesson-footer-assets',
    'lesson-footer-assets',
    false,
    52428800,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'text/plain',
      'application/zip'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "module_pdfs_admin_select" on storage.objects;
create policy "module_pdfs_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'module-pdfs'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "module_pdfs_admin_insert" on storage.objects;
create policy "module_pdfs_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'module-pdfs'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "module_pdfs_admin_update" on storage.objects;
create policy "module_pdfs_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'module-pdfs'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'module-pdfs'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "module_pdfs_admin_delete" on storage.objects;
create policy "module_pdfs_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'module-pdfs'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "module_pdfs_service_role_all" on storage.objects;
create policy "module_pdfs_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'module-pdfs')
with check (bucket_id = 'module-pdfs');

drop policy if exists "lesson_footer_assets_admin_select" on storage.objects;
create policy "lesson_footer_assets_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lesson-footer-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_footer_assets_admin_insert" on storage.objects;
create policy "lesson_footer_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-footer-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_footer_assets_admin_update" on storage.objects;
create policy "lesson_footer_assets_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-footer-assets'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'lesson-footer-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_footer_assets_admin_delete" on storage.objects;
create policy "lesson_footer_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-footer-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_footer_assets_service_role_all" on storage.objects;
create policy "lesson_footer_assets_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'lesson-footer-assets')
with check (bucket_id = 'lesson-footer-assets');

insert into public.button_templates (name, default_label, variant, theme, icon, is_active)
values
  ('Baixar PDF', 'Baixar PDF', 'primary', 'blue', 'download', true),
  ('Material Complementar', 'Material Complementar', 'outline', 'slate', 'file-text', true),
  ('Planilha', 'Abrir Planilha', 'secondary', 'emerald', 'sheet', true),
  ('Assistir Recurso', 'Assistir Recurso', 'primary', 'rose', 'play-circle', true),
  ('Abrir Link', 'Abrir Link', 'outline', 'blue', 'external-link', true),
  ('Acessar Guia', 'Acessar Guia', 'secondary', 'amber', 'book-open', true)
on conflict (name) do update
set
  default_label = excluded.default_label,
  variant = excluded.variant,
  theme = excluded.theme,
  icon = excluded.icon,
  is_active = excluded.is_active;

insert into public.lesson_footer_actions (
  lesson_id,
  template_id,
  action_type,
  label,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  position,
  open_in_new_tab,
  is_active,
  created_by,
  created_at,
  updated_at
)
select
  lm.lesson_id,
  bt.id,
  'file',
  null,
  lm.storage_path,
  lm.file_name,
  lm.mime_type,
  lm.file_size_bytes,
  row_number() over (partition by lm.lesson_id order by lm.created_at, lm.id),
  true,
  true,
  lm.created_by,
  lm.created_at,
  lm.created_at
from public.lesson_materials lm
join public.button_templates bt on bt.name = 'Material Complementar'
where not exists (
  select 1
  from public.lesson_footer_actions lfa
  where lfa.storage_path = lm.storage_path
);

alter table public.assessment_questions
  drop constraint if exists assessment_questions_question_type_check;

alter table public.assessment_questions
  add constraint assessment_questions_question_type_check
  check (
    question_type in (
      'single_choice',
      'essay_ai',
      'case_study_ai',
      'case_study_single_choice',
      'drag_drop_labeling',
      'fill_in_the_blanks',
      'coloring'
    )
  );

create or replace function public.is_module_scheduled_open(_module_id uuid, _reference timestamptz default timezone('utc', now()))
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_modules cm
    where cm.id = _module_id
      and (cm.starts_at is null or cm.starts_at <= _reference)
      and (cm.ends_at is null or cm.ends_at >= _reference)
  );
$$;

create or replace function public.is_lesson_scheduled_open(_lesson_id uuid, _reference timestamptz default timezone('utc', now()))
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    where l.id = _lesson_id
      and (l.starts_at is null or l.starts_at <= _reference)
      and (l.ends_at is null or l.ends_at >= _reference)
  );
$$;

create or replace function public.is_lesson_unlocked(_user_id uuid, _lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _module_id uuid;
begin
  if _user_id is null or _lesson_id is null then
    return false;
  end if;

  select l.module_id
    into _module_id
  from public.lessons l
  where l.id = _lesson_id
  limit 1;

  if _module_id is null then
    return false;
  end if;

  if public.has_role(_user_id, 'admin') then
    return true;
  end if;

  if public.is_module_unlocked(_user_id, _module_id) = false then
    return false;
  end if;

  return public.is_lesson_scheduled_open(_lesson_id);
end;
$$;

create or replace function public.is_module_unlocked(_user_id uuid, _module_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_linear boolean;
  v_prev_module_id uuid;
begin
  select c.has_linear_progression
    into v_has_linear
  from public.course_modules cm
  join public.courses c on c.id = cm.course_id
  where cm.id = _module_id;

  if v_has_linear is null then
    return false;
  end if;

  if public.has_role(_user_id, 'admin') then
    return true;
  end if;

  if public.is_module_scheduled_open(_module_id) = false then
    return false;
  end if;

  if v_has_linear = false then
    return true;
  end if;

  select cm_prev.id
    into v_prev_module_id
  from public.course_modules cm_prev
  join public.course_modules cm_curr on cm_curr.course_id = cm_prev.course_id
  where cm_curr.id = _module_id
    and cm_prev.position < cm_curr.position
  order by cm_prev.position desc
  limit 1;

  if v_prev_module_id is null then
    return true;
  end if;

  return public.is_module_completed(_user_id, v_prev_module_id);
end;
$$;

drop function if exists public.get_student_course_modules_progress(uuid);

create or replace function public.get_student_course_modules_progress(_course_id uuid)
returns table (
  module_id uuid,
  module_position integer,
  title text,
  description text,
  is_required boolean,
  state text,
  is_unlocked boolean,
  is_completed boolean,
  required_lessons_total integer,
  required_lessons_completed integer,
  has_required_assessment boolean,
  required_assessment_approved boolean,
  progress_percent integer,
  starts_at timestamptz,
  ends_at timestamptz,
  module_pdf_file_name text,
  module_pdf_storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx_user as (
    select auth.uid() as user_id
  ),
  allowed as (
    select 1
    from ctx_user cu
    where cu.user_id is not null
      and (
        (public.has_role(cu.user_id, 'student') and public.is_course_released(cu.user_id, _course_id))
        or public.has_role(cu.user_id, 'admin')
      )
  ),
  module_base as (
    select
      cm.id as module_id,
      cm.position,
      cm.title,
      cm.description,
      cm.is_required,
      cm.starts_at,
      cm.ends_at,
      cm.module_pdf_file_name,
      cm.module_pdf_storage_path,
      public.is_module_scheduled_open(cm.id) as is_scheduled_open,
      public.is_module_unlocked(cu.user_id, cm.id) as is_unlocked,
      public.is_module_completed(cu.user_id, cm.id) as is_completed,
      (
        select count(*)::int
        from public.lessons l
        where l.module_id = cm.id
          and l.is_required = true
      ) as required_lessons_total,
      (
        select count(*)::int
        from public.lessons l
        left join public.lesson_progress lp
          on lp.lesson_id = l.id
          and lp.user_id = cu.user_id
          and lp.is_completed = true
        where l.module_id = cm.id
          and l.is_required = true
      ) as required_lessons_completed,
      exists (
        select 1
        from public.assessments a
        where a.assessment_type = 'module'
          and a.module_id = cm.id
          and a.is_required = true
          and a.is_active = true
      ) as has_required_assessment,
      public.is_required_module_assessment_approved(cu.user_id, cm.id) as required_assessment_approved
    from public.course_modules cm
    cross join ctx_user cu
    where cm.course_id = _course_id
  )
  select
    mb.module_id,
    mb.position as module_position,
    mb.title,
    mb.description,
    mb.is_required,
    case
      when mb.is_scheduled_open = false then 'blocked_by_schedule'
      when mb.is_unlocked = false then 'blocked'
      when mb.is_completed = true then 'completed'
      else 'in_progress'
    end as state,
    mb.is_unlocked,
    mb.is_completed,
    mb.required_lessons_total,
    mb.required_lessons_completed,
    mb.has_required_assessment,
    mb.required_assessment_approved,
    case
      when (mb.required_lessons_total + case when mb.has_required_assessment then 1 else 0 end) = 0
        then 100
      else floor(
        (
          (mb.required_lessons_completed + case when (mb.has_required_assessment and mb.required_assessment_approved) then 1 else 0 end)::numeric
          * 100
        )
        / (mb.required_lessons_total + case when mb.has_required_assessment then 1 else 0 end)
      )::int
    end as progress_percent,
    mb.starts_at,
    mb.ends_at,
    mb.module_pdf_file_name,
    mb.module_pdf_storage_path
  from module_base mb
  where exists (select 1 from allowed)
  order by module_position asc;
$$;

drop function if exists public.get_student_unlocked_lessons_progress(uuid);

create or replace function public.get_student_unlocked_lessons_progress(_course_id uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  module_position integer,
  lesson_position integer,
  title text,
  description text,
  is_required boolean,
  lesson_type text,
  youtube_url text,
  text_content text,
  estimated_minutes integer,
  is_completed boolean,
  completed_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx_user as (
    select auth.uid() as user_id
  ),
  allowed as (
    select 1
    from ctx_user cu
    where cu.user_id is not null
      and (
        (public.has_role(cu.user_id, 'student') and public.is_course_released(cu.user_id, _course_id))
        or public.has_role(cu.user_id, 'admin')
      )
  )
  select
    l.id as lesson_id,
    cm.id as module_id,
    cm.position as module_position,
    l.position as lesson_position,
    l.title,
    l.description,
    l.is_required,
    l.lesson_type::text,
    l.youtube_url,
    l.text_content,
    l.estimated_minutes,
    coalesce(lp.is_completed, false) as is_completed,
    lp.completed_at,
    l.starts_at,
    l.ends_at
  from public.course_modules cm
  join public.lessons l on l.module_id = cm.id
  cross join ctx_user cu
  left join public.lesson_progress lp
    on lp.lesson_id = l.id
    and lp.user_id = cu.user_id
  where cm.course_id = _course_id
    and public.is_lesson_unlocked(cu.user_id, l.id)
    and exists (select 1 from allowed)
  order by cm.position asc, l.position asc;
$$;

drop function if exists public.get_student_course_assessments(uuid);

create or replace function public.get_student_course_assessments(_course_id uuid)
returns table (
  assessment_id uuid,
  assessment_type text,
  module_id uuid,
  module_position integer,
  title text,
  description text,
  is_required boolean,
  passing_score numeric,
  max_attempts integer,
  is_active boolean,
  is_unlocked boolean,
  attempts_used integer,
  last_score numeric,
  last_is_approved boolean,
  remaining_attempts integer,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  with ctx_user as (
    select auth.uid() as user_id
  ),
  allowed as (
    select 1
    from ctx_user cu
    where cu.user_id is not null
      and (
        (public.has_role(cu.user_id, 'student') and public.is_course_released(cu.user_id, _course_id))
        or public.has_role(cu.user_id, 'admin')
      )
  ),
  assessment_base as (
    select
      a.id as assessment_id,
      a.assessment_type,
      a.module_id,
      cm.position as module_position,
      a.title,
      a.description,
      a.is_required,
      a.passing_score,
      a.max_attempts,
      a.is_active,
      case
        when a.assessment_type = 'module' then public.is_module_unlocked(cu.user_id, a.module_id)
        else public.are_required_modules_completed(cu.user_id, a.course_id)
      end as is_unlocked,
      (
        select count(*)::int
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
      ) as attempts_used,
      (
        select aa.score_percent
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
        order by aa.attempt_number desc
        limit 1
      ) as last_score,
      (
        select aa.is_approved
        from public.assessment_attempts aa
        where aa.assessment_id = a.id
          and aa.user_id = cu.user_id
          and aa.status = 'submitted'
        order by aa.attempt_number desc
        limit 1
      ) as last_is_approved,
      case
        when a.assessment_type = 'module' and a.module_id is not null then public.is_module_scheduled_open(a.module_id)
        else true
      end as is_scheduled_open
    from public.assessments a
    join ctx_user cu on true
    left join public.course_modules cm on cm.id = a.module_id
    where a.course_id = _course_id
      and a.is_active = true
  )
  select
    ab.assessment_id,
    ab.assessment_type,
    ab.module_id,
    ab.module_position,
    ab.title,
    ab.description,
    ab.is_required,
    ab.passing_score,
    ab.max_attempts,
    ab.is_active,
    ab.is_unlocked,
    ab.attempts_used,
    ab.last_score,
    coalesce(ab.last_is_approved, false) as last_is_approved,
    greatest(ab.max_attempts - ab.attempts_used, 0) as remaining_attempts,
    case
      when ab.is_scheduled_open = false then 'blocked_by_schedule'
      when ab.is_unlocked = false then 'blocked'
      when coalesce(ab.last_is_approved, false) = true then 'approved'
      when ab.attempts_used >= ab.max_attempts then 'failed_limit'
      else 'available'
    end as state
  from assessment_base ab
  where exists (select 1 from allowed)
  order by ab.module_position nulls last, ab.assessment_type;
$$;

drop policy if exists "lessons_student_released_select" on public.lessons;
create policy "lessons_student_released_select"
on public.lessons
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.course_modules cm
    join public.courses c on c.id = cm.course_id
    where cm.id = lessons.module_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
      and public.is_lesson_unlocked(auth.uid(), lessons.id)
  )
);

grant execute on function public.is_module_scheduled_open(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.is_lesson_scheduled_open(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.is_lesson_unlocked(uuid, uuid) to authenticated, service_role;

drop policy if exists "lesson_footer_actions_student_select" on public.lesson_footer_actions;
create policy "lesson_footer_actions_student_select"
on public.lesson_footer_actions
for select
to authenticated
using (
  is_active = true
  and public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    join public.courses c on c.id = cm.course_id
    where l.id = lesson_footer_actions.lesson_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
      and public.is_module_unlocked(auth.uid(), cm.id)
      and public.is_lesson_unlocked(auth.uid(), l.id)
  )
);

commit;
