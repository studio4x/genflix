begin;

create table if not exists public.site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.site_pages (page_key) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists site_page_versions_page_idx
  on public.site_page_versions (page_key, created_at desc);

alter table public.site_page_versions enable row level security;

drop policy if exists "site_page_versions_admin_select" on public.site_page_versions;
create policy "site_page_versions_admin_select"
on public.site_page_versions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_page_versions_admin_insert" on public.site_page_versions;
create policy "site_page_versions_admin_insert"
on public.site_page_versions
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

grant select, insert on public.site_page_versions to authenticated;
grant all on public.site_page_versions to service_role;

commit;
