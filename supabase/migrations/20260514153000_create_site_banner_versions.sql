create table if not exists public.site_banner_versions (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.site_banners (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text not null default 'update',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists site_banner_versions_banner_idx
  on public.site_banner_versions (banner_id, created_at desc);

alter table public.site_banner_versions enable row level security;

drop policy if exists "site_banner_versions_admin_select" on public.site_banner_versions;
create policy "site_banner_versions_admin_select"
on public.site_banner_versions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_banner_versions_admin_insert" on public.site_banner_versions;
create policy "site_banner_versions_admin_insert"
on public.site_banner_versions
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

grant select on public.site_banner_versions to authenticated;
grant insert on public.site_banner_versions to authenticated;
grant all on public.site_banner_versions to service_role;
