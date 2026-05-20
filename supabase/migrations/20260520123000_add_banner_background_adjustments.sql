alter table public.site_banners
  add column if not exists background_position_desktop text,
  add column if not exists background_size_desktop text,
  add column if not exists background_repeat_desktop text,
  add column if not exists background_position_mobile text,
  add column if not exists background_size_mobile text,
  add column if not exists background_repeat_mobile text;

update public.site_banners
set
  background_position_desktop = coalesce(background_position_desktop, 'center center'),
  background_size_desktop = coalesce(background_size_desktop, 'cover'),
  background_repeat_desktop = coalesce(background_repeat_desktop, 'no-repeat'),
  background_position_mobile = coalesce(background_position_mobile, 'center center'),
  background_size_mobile = coalesce(background_size_mobile, 'cover'),
  background_repeat_mobile = coalesce(background_repeat_mobile, 'no-repeat');
