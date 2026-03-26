begin;

alter table public.courses
  add column if not exists display_order integer;

with ranked_courses as (
  select
    id,
    row_number() over (order by created_at desc, id asc) as next_display_order
  from public.courses
)
update public.courses c
set display_order = ranked_courses.next_display_order
from ranked_courses
where c.id = ranked_courses.id
  and (c.display_order is null or c.display_order <= 0);

alter table public.courses
  alter column display_order set not null;

create index if not exists courses_display_order_idx
  on public.courses (display_order, created_at desc);

commit;
