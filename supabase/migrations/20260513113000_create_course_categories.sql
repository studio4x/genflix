begin;

create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now()),
  constraint course_categories_name_unique unique (name),
  constraint course_categories_slug_unique unique (slug)
);

create index if not exists idx_course_categories_display_order
  on public.course_categories (display_order asc, name asc);

alter table public.course_categories enable row level security;

drop trigger if exists set_course_categories_updated_at on public.course_categories;
create trigger set_course_categories_updated_at
before update on public.course_categories
for each row
execute procedure public.set_updated_at();

drop policy if exists "course_categories_public_select_active" on public.course_categories;
create policy "course_categories_public_select_active"
on public.course_categories
for select
to anon, authenticated
using (is_active = true or public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_categories_admin_all" on public.course_categories;
create policy "course_categories_admin_all"
on public.course_categories
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_categories_service_role_all" on public.course_categories;
create policy "course_categories_service_role_all"
on public.course_categories
for all
to service_role
using (true)
with check (true);

grant select on public.course_categories to anon, authenticated;
grant insert, update, delete on public.course_categories to authenticated;
grant all on public.course_categories to service_role;

commit;
