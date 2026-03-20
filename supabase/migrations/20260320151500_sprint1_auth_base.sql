begin;

create table if not exists public.roles (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.roles (code, name)
values
  ('admin', 'Administrator'),
  ('student', 'Student')
on conflict (code) do update set name = excluded.name;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id bigint not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

create or replace function public.has_role(_user_id uuid, _role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = _user_id
      and r.code = _role_code
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_role_id bigint;
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  select id
    into student_role_id
  from public.roles
  where code = 'student'
  limit 1;

  if student_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, student_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

insert into public.profiles (id, email)
select u.id, coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
join public.roles r on r.code = 'student'
on conflict (user_id, role_id) do nothing;

grant select on public.roles to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.roles to service_role;
grant all on public.profiles to service_role;
grant all on public.user_roles to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all"
on public.profiles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_service_role_all" on public.profiles;
create policy "profiles_service_role_all"
on public.profiles
for all
to service_role
using (true)
with check (true);

drop policy if exists "user_roles_read_own_or_admin" on public.user_roles;
create policy "user_roles_read_own_or_admin"
on public.user_roles
for select
to authenticated
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert"
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update"
on public.user_roles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete"
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_service_role_all" on public.user_roles;
create policy "user_roles_service_role_all"
on public.user_roles
for all
to service_role
using (true)
with check (true);

commit;
