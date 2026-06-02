begin;

create table if not exists public.support_faq_events (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid null references public.support_faqs (id) on delete set null,
  event_type text not null check (event_type in ('view', 'helpful', 'not_helpful', 'search_no_result')),
  query text null,
  user_id uuid null default auth.uid() references public.profiles (id) on delete set null,
  session_id text null,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists idx_support_faq_events_type_created
  on public.support_faq_events (event_type, created_at desc);

create index if not exists idx_support_faq_events_faq_id
  on public.support_faq_events (faq_id);

alter table public.support_faq_events enable row level security;

drop policy if exists "support_faq_events_public_insert" on public.support_faq_events;
create policy "support_faq_events_public_insert"
on public.support_faq_events
for insert
to anon, authenticated
with check (
  event_type in ('view', 'helpful', 'not_helpful', 'search_no_result')
);

drop policy if exists "support_faq_events_admin_select" on public.support_faq_events;
create policy "support_faq_events_admin_select"
on public.support_faq_events
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

grant insert on public.support_faq_events to anon, authenticated;
grant select on public.support_faq_events to authenticated;
grant all on public.support_faq_events to service_role;

commit;
