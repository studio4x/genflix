create table if not exists public.site_banner_carousel_targets (
  id uuid primary key default gen_random_uuid(),
  location_key text not null,
  page_key text not null,
  placement_key text not null default 'hero',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (location_key, page_key, placement_key)
);

create index if not exists site_banner_targets_lookup_idx
  on public.site_banner_carousel_targets (location_key, page_key, placement_key);

drop trigger if exists set_site_banner_targets_updated_at on public.site_banner_carousel_targets;
create trigger set_site_banner_targets_updated_at
before update on public.site_banner_carousel_targets
for each row execute procedure public.set_updated_at();

alter table public.site_banner_carousel_targets enable row level security;

drop policy if exists "site_banner_targets_public_select" on public.site_banner_carousel_targets;
create policy "site_banner_targets_public_select"
on public.site_banner_carousel_targets
for select
to anon, authenticated
using (true);

drop policy if exists "site_banner_targets_admin_all" on public.site_banner_carousel_targets;
create policy "site_banner_targets_admin_all"
on public.site_banner_carousel_targets
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

grant select on public.site_banner_carousel_targets to anon, authenticated;
grant insert, update, delete on public.site_banner_carousel_targets to authenticated;
grant all on public.site_banner_carousel_targets to service_role;
