begin;

create table if not exists public.notification_admin_settings (
  id smallint primary key default 1 check (id = 1),
  admin_notification_email text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_notification_admin_settings_updated_at on public.notification_admin_settings;
create trigger set_notification_admin_settings_updated_at
before update on public.notification_admin_settings
for each row
execute procedure public.set_updated_at();

insert into public.notification_admin_settings (id, admin_notification_email)
values (1, null)
on conflict (id) do nothing;

alter table public.notification_admin_settings enable row level security;

drop policy if exists "notification_admin_settings_admin_select" on public.notification_admin_settings;
create policy "notification_admin_settings_admin_select"
on public.notification_admin_settings
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_admin_settings_admin_insert" on public.notification_admin_settings;
create policy "notification_admin_settings_admin_insert"
on public.notification_admin_settings
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_admin_settings_admin_update" on public.notification_admin_settings;
create policy "notification_admin_settings_admin_update"
on public.notification_admin_settings
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_admin_settings_service_role_all" on public.notification_admin_settings;
create policy "notification_admin_settings_service_role_all"
on public.notification_admin_settings
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.notification_admin_settings to authenticated;
grant all on public.notification_admin_settings to service_role;

commit;
