alter table if exists public.blog_posts
  add column if not exists focus_keyword text null;

alter table if exists public.blog_posts
  add column if not exists scheduled_publish_at timestamptz null;

alter table if exists public.blog_posts
  add column if not exists seo_title text null;

alter table if exists public.blog_posts
  add column if not exists seo_canonical_url text null;

alter table if exists public.blog_posts
  add column if not exists seo_robots text null default 'index,follow';

alter table if exists public.blog_posts
  add column if not exists seo_og_title text null;

alter table if exists public.blog_posts
  add column if not exists seo_og_description text null;

alter table if exists public.blog_posts
  add column if not exists seo_og_image_url text null;

update public.blog_posts
set seo_robots = coalesce(seo_robots, 'index,follow');

