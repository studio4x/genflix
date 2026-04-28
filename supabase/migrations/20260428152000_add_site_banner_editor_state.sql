alter table public.site_banners
  add column if not exists editor_state_desktop jsonb not null default '{"content":[]}'::jsonb,
  add column if not exists editor_state_mobile jsonb not null default '{"content":[]}'::jsonb;
