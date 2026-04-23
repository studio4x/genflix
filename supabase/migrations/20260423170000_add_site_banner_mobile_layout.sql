alter table public.site_banners
  add column if not exists layout_mobile jsonb not null default '{}'::jsonb;

update public.site_banners
set layout_mobile = jsonb_build_object(
  'title', jsonb_build_object('x', 8, 'y', 12, 'width', 84, 'visible', true, 'zIndex', 3),
  'subtitle', jsonb_build_object('x', 8, 'y', 52, 'width', 84, 'visible', true, 'zIndex', 3),
  'body', jsonb_build_object('x', 8, 'y', 68, 'width', 82, 'visible', false, 'zIndex', 3),
  'primaryCta', jsonb_build_object('x', 8, 'y', 82, 'width', 78, 'visible', true, 'zIndex', 4),
  'secondaryCta', jsonb_build_object('x', 8, 'y', 90, 'width', 78, 'visible', true, 'zIndex', 4)
)
where coalesce(layout_mobile, '{}'::jsonb) = '{}'::jsonb;
