alter table if exists public.blog_posts
  add column if not exists card_image_url text;

update public.blog_posts
set card_image_url = image_url
where card_image_url is null
  and image_url is not null;
