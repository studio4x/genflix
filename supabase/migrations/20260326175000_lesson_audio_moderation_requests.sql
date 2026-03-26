begin;

create table if not exists public.lesson_audio_moderation_requests (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  requested_message text,
  technical_error text,
  admin_response text,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index if not exists lesson_audio_moderation_requests_lesson_created_idx
  on public.lesson_audio_moderation_requests (lesson_id, created_at desc);

create index if not exists lesson_audio_moderation_requests_status_created_idx
  on public.lesson_audio_moderation_requests (status, created_at desc);

create unique index if not exists lesson_audio_moderation_requests_pending_unique
  on public.lesson_audio_moderation_requests (lesson_id, user_id)
  where status = 'pending';

grant select, insert on public.lesson_audio_moderation_requests to authenticated;
grant update on public.lesson_audio_moderation_requests to authenticated;
grant all on public.lesson_audio_moderation_requests to service_role;

alter table public.lesson_audio_moderation_requests enable row level security;

drop policy if exists "lesson_audio_requests_student_select_own" on public.lesson_audio_moderation_requests;
create policy "lesson_audio_requests_student_select_own"
on public.lesson_audio_moderation_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "lesson_audio_requests_student_insert_own" on public.lesson_audio_moderation_requests;
create policy "lesson_audio_requests_student_insert_own"
on public.lesson_audio_moderation_requests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "lesson_audio_requests_admin_all" on public.lesson_audio_moderation_requests;
create policy "lesson_audio_requests_admin_all"
on public.lesson_audio_moderation_requests
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "lesson_audio_requests_service_role_all" on public.lesson_audio_moderation_requests;
create policy "lesson_audio_requests_service_role_all"
on public.lesson_audio_moderation_requests
for all
to service_role
using (true)
with check (true);

commit;
