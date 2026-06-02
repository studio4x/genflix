create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text null,
  parent_id uuid null references public.blog_categories(id) on delete set null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  schema_json text null,
  se??o_title text null,
  se??o_description text null,
  se??o_canonical_url text null,
  se??o_robots text null default 'index,follow',
  se??o_og_title text null,
  se??o_og_description text null,
  se??o_og_image_url text null,
  created_at timest?mptz not null default now(),
  updated_at timest?mptz not null default now()
);

create unique index if not exists blog_categories_slug_key
  on public.blog_categories (slug);

create index if not exists blog_categories_parent_id_idx
  on public.blog_categories (parent_id);

create index if not exists blog_categories_is_active_idx
  on public.blog_categories (is_active);

create index if not exists blog_categories_display_order_idx
  on public.blog_categories (display_order);

create or replace function public.set_blog_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_blog_categories_updated_at on public.blog_categories;
create trigger trg_blog_categories_updated_at
before update on public.blog_categories
for each row
execute function public.set_blog_categories_updated_at();

alter table public.blog_categories enable row level security;

drop policy if exists "blog_categories_select_public" on public.blog_categories;
create policy "blog_categories_select_public"
on public.blog_categories
for select
to anon, authenticated
using (true);

drop policy if exists "blog_categories_insert_authenticated" on public.blog_categories;
create policy "blog_categories_insert_authenticated"
on public.blog_categories
for insert
to authenticated
with check (true);

drop policy if exists "blog_categories_update_authenticated" on public.blog_categories;
create policy "blog_categories_update_authenticated"
on public.blog_categories
for update
to authenticated
using (true)
with check (true);

drop policy if exists "blog_categories_delete_authenticated" on public.blog_categories;
create policy "blog_categories_delete_authenticated"
on public.blog_categories
for delete
to authenticated
using (true);
