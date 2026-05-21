alter table public.site_banners
  add column if not exists global_link_href text not null default '',
  add column if not exists global_link_is_internal boolean not null default true,
  add column if not exists global_link_open_in_new_tab boolean not null default false;
