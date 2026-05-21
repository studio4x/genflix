alter table public.site_banners
  add column if not exists global_link_target text not null default 'same-tab';
