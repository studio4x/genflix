alter table public.site_banners
  add column if not exists background_asset_id_mobile uuid references public.site_assets (id) on delete set null,
  add column if not exists background_url_mobile text;

update public.site_banners
set background_url_mobile = coalesce(background_url_mobile, background_url)
where background_url_mobile is null;
