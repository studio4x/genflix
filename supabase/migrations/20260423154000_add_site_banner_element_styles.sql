alter table public.site_banners
  add column if not exists element_styles jsonb not null default '{}'::jsonb;
