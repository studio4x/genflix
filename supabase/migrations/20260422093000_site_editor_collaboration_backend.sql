create table if not exists public.site_editor_workspace_records (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.site_pages (page_key) on delete cascade,
  entry_key text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'published')),
  draft_raw_value text,
  draft_text_style jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (page_key, entry_key)
);

create index if not exists site_editor_workspace_records_page_key_idx
  on public.site_editor_workspace_records (page_key, updated_at desc);

create table if not exists public.site_editor_workspace_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.site_editor_workspace_records (id) on delete cascade,
  body text not null,
  author_role text not null default 'unknown',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists site_editor_workspace_comments_workspace_idx
  on public.site_editor_workspace_comments (workspace_id, created_at desc);

drop trigger if exists set_site_editor_workspace_records_updated_at on public.site_editor_workspace_records;
create trigger set_site_editor_workspace_records_updated_at
before update on public.site_editor_workspace_records
for each row execute procedure public.set_updated_at();

alter table public.site_editor_workspace_records enable row level security;
alter table public.site_editor_workspace_comments enable row level security;

drop policy if exists "site_editor_workspace_records_collaborators_select" on public.site_editor_workspace_records;
create policy "site_editor_workspace_records_collaborators_select"
on public.site_editor_workspace_records
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
);

drop policy if exists "site_editor_workspace_records_collaborators_insert" on public.site_editor_workspace_records;
create policy "site_editor_workspace_records_collaborators_insert"
on public.site_editor_workspace_records
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
);

drop policy if exists "site_editor_workspace_records_collaborators_update" on public.site_editor_workspace_records;
create policy "site_editor_workspace_records_collaborators_update"
on public.site_editor_workspace_records
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
);

drop policy if exists "site_editor_workspace_comments_collaborators_select" on public.site_editor_workspace_comments;
create policy "site_editor_workspace_comments_collaborators_select"
on public.site_editor_workspace_comments
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
);

drop policy if exists "site_editor_workspace_comments_collaborators_insert" on public.site_editor_workspace_comments;
create policy "site_editor_workspace_comments_collaborators_insert"
on public.site_editor_workspace_comments
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'criador')
  or public.has_role(auth.uid(), 'professor')
);

grant select, insert, update on public.site_editor_workspace_records to authenticated;
grant select, insert on public.site_editor_workspace_comments to authenticated;

grant all on public.site_editor_workspace_records to service_role;
grant all on public.site_editor_workspace_comments to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_editor_workspace_records'
  ) then
    alter publication supabase_realtime add table public.site_editor_workspace_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_editor_workspace_comments'
  ) then
    alter publication supabase_realtime add table public.site_editor_workspace_comments;
  end if;
end
$$;
