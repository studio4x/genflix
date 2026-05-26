begin;

alter table public.blog_posts
  add column if not exists content_html text;

commit;
