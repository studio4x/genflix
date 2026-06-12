begin;

alter table public.courses
  add column if not exists categories text[] not null default '{}'::text[];

update public.courses
set categories = case
  when coalesce(array_length(categories, 1), 0) > 0 then categories
  when nullif(trim(category), '') is not null then array[trim(category)]
  else '{}'::text[]
end;

create index if not exists courses_categories_idx
  on public.courses using gin (categories);

create or replace function public.sync_course_categories_legacy()
returns trigger
language plpgsql
as $$
declare
  cleaned_categories text[] := '{}'::text[];
  item text;
begin
  if new.categories is not null then
    foreach item in array new.categories loop
      item := btrim(item);
      if item <> '' and not item = any(cleaned_categories) then
        cleaned_categories := array_append(cleaned_categories, item);
      end if;
    end loop;
  end if;

  if coalesce(array_length(cleaned_categories, 1), 0) > 0 then
    new.categories := cleaned_categories;
    new.category := cleaned_categories[1];
  elsif new.category is not null and btrim(new.category) <> '' then
    new.category := btrim(new.category);
    new.categories := array[new.category];
  else
    new.category := null;
    new.categories := '{}'::text[];
  end if;

  return new;
end;
$$;

drop trigger if exists sync_course_categories_legacy_trigger on public.courses;
create trigger sync_course_categories_legacy_trigger
before insert or update on public.courses
for each row
execute procedure public.sync_course_categories_legacy();

comment on column public.courses.categories is
  'Lista de categorias vinculadas ao curso. A primeira categoria define o valor legado de category.';

commit;
