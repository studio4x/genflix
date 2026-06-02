begin;

create table if not exists public.admin_bootstrap_emails (
  email text primary key,
  created_at timest?mptz not null default timezone('utc', now()),
  consumed_at timest?mptz
);

insert into public.admin_bootstrap_emails (email)
values ('contato@homecarematch.com.br')
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_role_id bigint;
  admin_role_id bigint;
  should_assign_admin boolean;
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

  select exists (
    select 1
    from public.admin_bootstrap_emails abe
    where lower(abe.email) = lower(coalesce(new.email, ''))
      and abe.consumed_at is null
  )
    into should_assign_admin;

  if should_assign_admin then
    select id
      into admin_role_id
    from public.roles
    where code = 'admin'
    limit 1;

    if admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, admin_role_id)
      on conflict (user_id, role_id) do nothing;
    end if;

    update public.admin_bootstrap_emails
    set consumed_at = timezone('utc', now())
    where lower(email) = lower(coalesce(new.email, ''))
      and consumed_at is null;
  end if;

  return new;
end;
$$;

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
join public.roles r on r.code = 'admin'
join public.admin_bootstrap_emails abe on lower(abe.email) = lower(u.email)
where abe.consumed_at is null
on conflict (user_id, role_id) do nothing;

update public.admin_bootstrap_emails abe
set consumed_at = timezone('utc', now())
where abe.consumed_at is null
  and exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(abe.email)
  );

revoke all on public.admin_bootstrap_emails from anon, authenticated;
grant all on public.admin_bootstrap_emails to service_role;

alter table public.admin_bootstrap_emails enable row level security;

drop policy if exists "admin_bootstrap_service_role_all" on public.admin_bootstrap_emails;
create policy "admin_bootstrap_service_role_all"
on public.admin_bootstrap_emails
for all
to service_role
using (true)
with check (true);

commit;