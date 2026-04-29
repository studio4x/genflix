alter table public.site_banners
  drop constraint if exists site_banners_theme_preset_check;

alter table public.site_banners
  add constraint site_banners_theme_preset_check
  check (theme_preset in ('light-strong', 'light-soft', 'dark-soft', 'no-overlay'));
