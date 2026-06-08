alter table if exists public.blog_posts
  add column if not exists seo_description text null;

update public.blog_posts
set seo_description = coalesce(seo_description, excerpt)
where seo_description is null
  and excerpt is not null
  and excerpt <> '';
