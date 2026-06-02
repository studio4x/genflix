begin;

create table if not exists public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.blog_posts (id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_by_name text,
  changed_by_email text,
  change_type text not null default 'update',
  created_at timest?mptz not null default timezone('utc', now())
);

create unique index if not exists blog_post_revisions_article_revision_key
  on public.blog_post_revisions (article_id, revision_number);

create index if not exists blog_post_revisions_article_idx
  on public.blog_post_revisions (article_id, created_at desc);

create or replace function public.set_blog_post_revision_number()
returns trigger
language plpgsql
as $$
begin
  if new.revision_number is null or new.revision_number <= 0 then
    select coalesce(max(revision_number), 0) + 1
    into new.revision_number
    from public.blog_post_revisions
    where article_id = new.article_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_blog_post_revisions_revision_number on public.blog_post_revisions;
create trigger trg_blog_post_revisions_revision_number
before insert on public.blog_post_revisions
for each row
execute function public.set_blog_post_revision_number();

alter table public.blog_post_revisions enable row level security;

drop policy if exists "blog_post_revisions_admin_select" on public.blog_post_revisions;
create policy "blog_post_revisions_admin_select"
on public.blog_post_revisions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "blog_post_revisions_admin_insert" on public.blog_post_revisions;
create policy "blog_post_revisions_admin_insert"
on public.blog_post_revisions
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

grant select, insert on public.blog_post_revisions to authenticated;
grant all on public.blog_post_revisions to service_role;

commit;
