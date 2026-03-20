begin;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  workload_hours integer not null default 0 check (workload_hours >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists courses_status_idx on public.courses (status);
create index if not exists courses_created_at_idx on public.courses (created_at desc);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  description text,
  position integer not null check (position > 0),
  is_required boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, position)
);

create index if not exists course_modules_course_id_idx on public.course_modules (course_id);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  description text,
  position integer not null check (position > 0),
  is_required boolean not null default true,
  lesson_type text not null default 'video' check (lesson_type in ('video')),
  youtube_url text check (
    youtube_url is null
    or youtube_url ~* '^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/'
  ),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_id, position)
);

create index if not exists lessons_module_id_idx on public.lessons (module_id);

create table if not exists public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lesson_materials_lesson_id_idx on public.lesson_materials (lesson_id);

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_course_modules_updated_at on public.course_modules;
create trigger set_course_modules_updated_at
before update on public.course_modules
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_lessons_updated_at on public.lessons;
create trigger set_lessons_updated_at
before update on public.lessons
for each row
execute procedure public.set_updated_at();

grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_modules to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.lesson_materials to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.courses to service_role;
grant all on public.course_modules to service_role;
grant all on public.lessons to service_role;
grant all on public.lesson_materials to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_materials enable row level security;

drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all"
on public.courses
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "courses_service_role_all" on public.courses;
create policy "courses_service_role_all"
on public.courses
for all
to service_role
using (true)
with check (true);

drop policy if exists "modules_admin_all" on public.course_modules;
create policy "modules_admin_all"
on public.course_modules
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "modules_service_role_all" on public.course_modules;
create policy "modules_service_role_all"
on public.course_modules
for all
to service_role
using (true)
with check (true);

drop policy if exists "lessons_admin_all" on public.lessons;
create policy "lessons_admin_all"
on public.lessons
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lessons_service_role_all" on public.lessons;
create policy "lessons_service_role_all"
on public.lessons
for all
to service_role
using (true)
with check (true);

drop policy if exists "lesson_materials_admin_all" on public.lesson_materials;
create policy "lesson_materials_admin_all"
on public.lesson_materials
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lesson_materials_service_role_all" on public.lesson_materials;
create policy "lesson_materials_service_role_all"
on public.lesson_materials
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
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

drop policy if exists "materials_admin_select" on storage.objects;
create policy "materials_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "materials_admin_insert" on storage.objects;
create policy "materials_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "materials_admin_update" on storage.objects;
create policy "materials_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "materials_admin_delete" on storage.objects;
create policy "materials_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'materials'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "materials_service_role_all" on storage.objects;
create policy "materials_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'materials')
with check (bucket_id = 'materials');

commit;
