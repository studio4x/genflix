begin;

create table if not exists public.access_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists access_groups_name_unique_idx
  on public.access_groups (lower(name));

create table if not exists public.access_group_members (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.access_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (group_id, user_id)
);

create index if not exists access_group_members_group_id_idx
  on public.access_group_members (group_id);
create index if not exists access_group_members_user_id_idx
  on public.access_group_members (user_id);

create table if not exists public.course_releases (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  release_type text not null check (release_type in ('user', 'group')),
  user_id uuid references auth.users (id) on delete cascade,
  group_id uuid references public.access_groups (id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (release_type = 'user' and user_id is not null and group_id is null)
    or (release_type = 'group' and group_id is not null and user_id is null)
  ),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists course_releases_course_user_unique_idx
  on public.course_releases (course_id, user_id)
  where user_id is not null;

create unique index if not exists course_releases_course_group_unique_idx
  on public.course_releases (course_id, group_id)
  where group_id is not null;

create index if not exists course_releases_course_id_idx
  on public.course_releases (course_id);

drop trigger if exists set_access_groups_updated_at on public.access_groups;
create trigger set_access_groups_updated_at
before update on public.access_groups
for each row
execute procedure public.set_updated_at();

create or replace function public.is_course_released(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_releases cr
    left join public.access_group_members agm
      on agm.group_id = cr.group_id
      and agm.user_id = _user_id
    where cr.course_id = _course_id
      and cr.is_active = true
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      and (
        (cr.release_type = 'user' and cr.user_id = _user_id)
        or (cr.release_type = 'group' and agm.user_id is not null)
      )
  );
$$;

grant select, insert, update, delete on public.access_groups to authenticated;
grant select, insert, update, delete on public.access_group_members to authenticated;
grant select, insert, update, delete on public.course_releases to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.access_groups to service_role;
grant all on public.access_group_members to service_role;
grant all on public.course_releases to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.access_groups enable row level security;
alter table public.access_group_members enable row level security;
alter table public.course_releases enable row level security;

drop policy if exists "access_groups_admin_all" on public.access_groups;
create policy "access_groups_admin_all"
on public.access_groups
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "access_groups_service_role_all" on public.access_groups;
create policy "access_groups_service_role_all"
on public.access_groups
for all
to service_role
using (true)
with check (true);

drop policy if exists "access_group_members_admin_all" on public.access_group_members;
create policy "access_group_members_admin_all"
on public.access_group_members
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "access_group_members_service_role_all" on public.access_group_members;
create policy "access_group_members_service_role_all"
on public.access_group_members
for all
to service_role
using (true)
with check (true);

drop policy if exists "course_releases_admin_all" on public.course_releases;
create policy "course_releases_admin_all"
on public.course_releases
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_releases_service_role_all" on public.course_releases;
create policy "course_releases_service_role_all"
on public.course_releases
for all
to service_role
using (true)
with check (true);

drop policy if exists "courses_student_released_select" on public.courses;
create policy "courses_student_released_select"
on public.courses
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and status = 'published'
  and public.is_course_released(auth.uid(), id)
);

drop policy if exists "course_modules_student_released_select" on public.course_modules;
create policy "course_modules_student_released_select"
on public.course_modules
for select
to authenticated
using (
  public.has_role(auth.uid(), 'student')
  and exists (
    select 1
    from public.courses c
    where c.id = course_modules.course_id
      and c.status = 'published'
      and public.is_course_released(auth.uid(), c.id)
  )
);

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
  )
);

commit;
