begin;

create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  note_text text not null check (length(trim(note_text)) between 1 and 20000),
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now()),
  unique (user_id, lesson_id)
);

create index if not exists lesson_notes_user_id_idx on public.lesson_notes (user_id);
create index if not exists lesson_notes_lesson_id_idx on public.lesson_notes (lesson_id);
create index if not exists lesson_notes_updated_at_idx on public.lesson_notes (updated_at desc);

drop trigger if exists set_lesson_notes_updated_at on public.lesson_notes;
create trigger set_lesson_notes_updated_at
before update on public.lesson_notes
for each row
execute procedure public.set_updated_at();

grant select, insert, update, delete on public.lesson_notes to authenticated;
grant all on public.lesson_notes to service_role;

alter table public.lesson_notes enable row level security;

drop policy if exists "lesson_notes_read_own_or_admin" on public.lesson_notes;
create policy "lesson_notes_read_own_or_admin"
on public.lesson_notes
for select
to authenticated
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_notes_insert_own_or_admin" on public.lesson_notes;
create policy "lesson_notes_insert_own_or_admin"
on public.lesson_notes
for insert
to authenticated
with check (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_notes_update_own_or_admin" on public.lesson_notes;
create policy "lesson_notes_update_own_or_admin"
on public.lesson_notes
for update
to authenticated
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
)
with check (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_notes_delete_own_or_admin" on public.lesson_notes;
create policy "lesson_notes_delete_own_or_admin"
on public.lesson_notes
for delete
to authenticated
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "lesson_notes_service_role_all" on public.lesson_notes;
create policy "lesson_notes_service_role_all"
on public.lesson_notes
for all
to service_role
using (true)
with check (true);

commit;
