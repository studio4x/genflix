create table if not exists public.site_banners (
  id uuid primary key default gen_random_uuid(),
  location_key text not null,
  name text not null,
  title text not null,
  subtitle text,
  body text,
  background_asset_id uuid references public.site_assets (id) on delete set null,
  background_url text,
  theme_preset text not null default 'light-strong' check (theme_preset in ('light-strong', 'light-soft', 'dark-soft')),
  layout_desktop jsonb not null default '{}'::jsonb,
  primary_cta jsonb,
  secondary_cta jsonb,
  is_active boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create index if not exists site_banners_location_idx
  on public.site_banners (location_key, sort_order, is_active);

drop trigger if exists set_site_banners_updated_at on public.site_banners;
create trigger set_site_banners_updated_at
before update on public.site_banners
for each row execute procedure public.set_updated_at();

alter table public.site_banners enable row level security;

drop policy if exists "site_banners_public_select" on public.site_banners;
create policy "site_banners_public_select"
on public.site_banners
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "site_banners_admin_all" on public.site_banners;
create policy "site_banners_admin_all"
on public.site_banners
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

grant select on public.site_banners to anon, authenticated;
grant insert, update, delete on public.site_banners to authenticated;
grant all on public.site_banners to service_role;
