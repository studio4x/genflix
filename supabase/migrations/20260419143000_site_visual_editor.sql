create table if not exists public.site_editor_settings (
  id integer primary key default 1 check (id = 1),
  is_enabled boolean not null default true,
  read_overrides_enabled boolean not null default true,
  editing_enabled boolean not null default true,
  fallback_mode boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.site_editor_settings (id, is_enabled, read_overrides_enabled, editing_enabled, fallback_mode)
values (1, true, true, true, false)
on conflict (id) do nothing;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  path text not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_content_entries (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.site_pages (page_key) on delete cascade,
  entry_key text not null,
  entry_type text not null check (entry_type in ('text', 'rich_text', 'image', 'link', 'button', 'list', 'json')),
  value jsonb not null,
  schema jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (page_key, entry_key)
);

create index if not exists site_content_entries_page_key_idx
  on public.site_content_entries (page_key, is_enabled);

create table if not exists public.site_content_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.site_content_entries (id) on delete cascade,
  page_key text not null,
  entry_key text not null,
  entry_type text not null,
  previous_value jsonb,
  next_value jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists site_content_versions_entry_idx
  on public.site_content_versions (entry_id, created_at desc);

create table if not exists public.site_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  public_url text,
  alt text,
  width integer,
  height integer,
  mime_type text,
  file_size integer,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.site_pages (page_key, path, title)
values
  ('global', '*', 'Componentes globais'),
  ('home', '/', 'Início'),
  ('courses', '/cursos', 'Cursos'),
  ('course-detail', '/cursos/:slug', 'Página de curso'),
  ('about', '/sobre', 'Sobre'),
  ('blog', '/blog', 'Blog'),
  ('blog-post', '/blog/:slug', 'Post do blog'),
  ('contact', '/contato', 'Contato'),
  ('community', '/comunidade', 'Comunidade'),
  ('resources', '/recursos', 'Recursos'),
  ('privacy', '/privacidade', 'Privacidade'),
  ('cookies', '/cookies', 'Cookies'),
  ('terms', '/termos-de-uso', 'Termos de uso')
on conflict (page_key) do update
set path = excluded.path,
    title = excluded.title,
    status = 'active',
    updated_at = timezone('utc', now());

drop trigger if exists set_site_editor_settings_updated_at on public.site_editor_settings;
create trigger set_site_editor_settings_updated_at
before update on public.site_editor_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists set_site_pages_updated_at on public.site_pages;
create trigger set_site_pages_updated_at
before update on public.site_pages
for each row execute procedure public.set_updated_at();

drop trigger if exists set_site_content_entries_updated_at on public.site_content_entries;
create trigger set_site_content_entries_updated_at
before update on public.site_content_entries
for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.site_editor_settings enable row level security;
alter table public.site_pages enable row level security;
alter table public.site_content_entries enable row level security;
alter table public.site_content_versions enable row level security;
alter table public.site_assets enable row level security;

drop policy if exists "site_editor_settings_public_select" on public.site_editor_settings;
create policy "site_editor_settings_public_select"
on public.site_editor_settings
for select
to anon, authenticated
using (true);

drop policy if exists "site_editor_settings_admin_all" on public.site_editor_settings;
create policy "site_editor_settings_admin_all"
on public.site_editor_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_pages_public_select" on public.site_pages;
create policy "site_pages_public_select"
on public.site_pages
for select
to anon, authenticated
using (status = 'active' or public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_pages_admin_all" on public.site_pages;
create policy "site_pages_admin_all"
on public.site_pages
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_content_entries_public_select" on public.site_content_entries;
create policy "site_content_entries_public_select"
on public.site_content_entries
for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.site_editor_settings settings
    where settings.id = 1
      and settings.is_enabled = true
      and settings.read_overrides_enabled = true
      and settings.fallback_mode = false
  )
);

drop policy if exists "site_content_entries_admin_all" on public.site_content_entries;
create policy "site_content_entries_admin_all"
on public.site_content_entries
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_content_versions_admin_select" on public.site_content_versions;
create policy "site_content_versions_admin_select"
on public.site_content_versions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_content_versions_admin_insert" on public.site_content_versions;
create policy "site_content_versions_admin_insert"
on public.site_content_versions
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_assets_public_select" on public.site_assets;
create policy "site_assets_public_select"
on public.site_assets
for select
to anon, authenticated
using (true);

drop policy if exists "site_assets_admin_all" on public.site_assets;
create policy "site_assets_admin_all"
on public.site_assets
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "site_assets_public_storage_select" on storage.objects;
create policy "site_assets_public_storage_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-assets');

drop policy if exists "site_assets_admin_storage_insert" on storage.objects;
create policy "site_assets_admin_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "site_assets_admin_storage_update" on storage.objects;
create policy "site_assets_admin_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-assets'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'site-assets'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "site_assets_admin_storage_delete" on storage.objects;
create policy "site_assets_admin_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and public.has_role(auth.uid(), 'admin')
);

grant select on public.site_editor_settings to anon, authenticated;
grant select on public.site_pages to anon, authenticated;
grant select on public.site_content_entries to anon, authenticated;
grant select on public.site_assets to anon, authenticated;
grant insert, update, delete on public.site_editor_settings to authenticated;
grant insert, update, delete on public.site_pages to authenticated;
grant insert, update, delete on public.site_content_entries to authenticated;
grant select, insert on public.site_content_versions to authenticated;
grant insert, update, delete on public.site_assets to authenticated;
grant all on public.site_editor_settings to service_role;
grant all on public.site_pages to service_role;
grant all on public.site_content_entries to service_role;
grant all on public.site_content_versions to service_role;
grant all on public.site_assets to service_role;
