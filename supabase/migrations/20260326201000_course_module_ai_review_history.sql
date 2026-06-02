begin;

create table if not exists public.course_module_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid not null references public.course_modules (id) on delete cascade,
  summary text not null,
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  ready_to_publish boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  corrected_module jsonb,
  created_at timest?mptz not null default timezone('utc', now()),
  created_by uuid references auth.users (id) on delete set null,
  applied_at timest?mptz,
  applied_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_course_module_ai_reviews_module_created_at
  on public.course_module_ai_reviews (module_id, created_at desc);

create index if not exists idx_course_module_ai_reviews_course_created_at
  on public.course_module_ai_reviews (course_id, created_at desc);

grant select, insert, update on public.course_module_ai_reviews to authenticated;
grant all on public.course_module_ai_reviews to service_role;

alter table public.course_module_ai_reviews enable row level security;

drop policy if exists "course_module_ai_reviews_admin_read_all" on public.course_module_ai_reviews;
create policy "course_module_ai_reviews_admin_read_all"
on public.course_module_ai_reviews
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_module_ai_reviews_admin_insert" on public.course_module_ai_reviews;
create policy "course_module_ai_reviews_admin_insert"
on public.course_module_ai_reviews
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_module_ai_reviews_admin_update" on public.course_module_ai_reviews;
create policy "course_module_ai_reviews_admin_update"
on public.course_module_ai_reviews
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_module_ai_reviews_service_role_all" on public.course_module_ai_reviews;
create policy "course_module_ai_reviews_service_role_all"
on public.course_module_ai_reviews
for all
to service_role
using (true)
with check (true);

commit;
