alter table if exists public.blog_posts
  add column if not exists excerpt text;

do $$
declare
  has_se??o_description boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'blog_posts'
      and column_name = 'se??o_description'
  ) into has_se??o_description;

  if has_se??o_description then
    execute $sql$
      update public.blog_posts
      set excerpt = coalesce(nullif(trim(excerpt), ''), nullif(trim(se??o_description), ''), '')
      where coalesce(trim(excerpt), '') = ''
    $sql$;
  else
    execute $sql$
      update public.blog_posts
      set excerpt = coalesce(nullif(trim(excerpt), ''), '')
      where coalesce(trim(excerpt), '') = ''
    $sql$;
  end if;
end $$;

alter table if exists public.blog_posts
  alter column excerpt set default '';

alter table if exists public.blog_posts
  alter column excerpt set not null;
