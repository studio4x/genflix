alter table public.site_banners
  add column if not exists height_desktop integer not null default 760 check (height_desktop between 320 and 1200),
  add column if not exists height_mobile integer not null default 560 check (height_mobile between 320 and 1200);
