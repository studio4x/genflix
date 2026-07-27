begin;

alter table public.courses
  add column if not exists show_in_home_news boolean not null default true;

comment on column public.courses.show_in_home_news is
  'Define se o curso aparece na seção Novidades da home pública.';

create index if not exists courses_home_news_order_idx
  on public.courses (show_in_home_news, display_order, created_at desc)
  where status = 'published' and is_public = true;

commit;
