alter table public.lesson_footer_actions
  add column if not exists open_target text;

update public.lesson_footer_actions
set open_target = case
  when coalesce(open_in_new_tab, true) then 'new-tab'
  else 'same-tab'
end
where open_target is null or open_target = '';

alter table public.lesson_footer_actions
  alter column open_target set default 'new-tab';

alter table public.lesson_footer_actions
  alter column open_target set not null;

do $$
begin
  alter table public.lesson_footer_actions
    add constraint lesson_footer_actions_open_target_check
    check (open_target in ('same-tab', 'new-tab', 'new-window'));
exception
  when duplicate_object then null;
end $$;
