begin;

insert into public.site_pages (page_key, path, title)
values ('support', '/suporte', 'Suporte')
on conflict (page_key) do update
set path = excluded.path,
    title = excluded.title,
    status = 'active',
    updated_at = timezone('utc', now());

commit;
