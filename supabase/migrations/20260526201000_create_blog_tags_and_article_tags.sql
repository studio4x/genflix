create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text null,
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

create unique index if not exists blog_tags_slug_key
  on public.blog_tags (slug);

create or replace function public.set_blog_tags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_blog_tags_updated_at on public.blog_tags;
create trigger trg_blog_tags_updated_at
before update on public.blog_tags
for each row
execute function public.set_blog_tags_updated_at();

alter table public.blog_tags enable row level security;

drop policy if exists "blog_tags_select_public" on public.blog_tags;
create policy "blog_tags_select_public"
on public.blog_tags
for select
to anon, authenticated
using (true);

drop policy if exists "blog_tags_insert_authenticated" on public.blog_tags;
create policy "blog_tags_insert_authenticated"
on public.blog_tags
for insert
to authenticated
with check (true);

drop policy if exists "blog_tags_update_authenticated" on public.blog_tags;
create policy "blog_tags_update_authenticated"
on public.blog_tags
for update
to authenticated
using (true)
with check (true);

drop policy if exists "blog_tags_delete_authenticated" on public.blog_tags;
create policy "blog_tags_delete_authenticated"
on public.blog_tags
for delete
to authenticated
using (true);

create table if not exists public.blog_article_tags (
  article_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  created_at timest?mptz not null default now(),
  primary key (article_id, tag_id)
);

create index if not exists blog_article_tags_article_id_idx
  on public.blog_article_tags (article_id);

create index if not exists blog_article_tags_tag_id_idx
  on public.blog_article_tags (tag_id);

alter table public.blog_article_tags enable row level security;

drop policy if exists "blog_article_tags_select_public" on public.blog_article_tags;
create policy "blog_article_tags_select_public"
on public.blog_article_tags
for select
to anon, authenticated
using (true);

drop policy if exists "blog_article_tags_insert_authenticated" on public.blog_article_tags;
create policy "blog_article_tags_insert_authenticated"
on public.blog_article_tags
for insert
to authenticated
with check (true);

drop policy if exists "blog_article_tags_delete_authenticated" on public.blog_article_tags;
create policy "blog_article_tags_delete_authenticated"
on public.blog_article_tags
for delete
to authenticated
using (true);
