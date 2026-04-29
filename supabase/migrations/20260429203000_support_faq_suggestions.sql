begin;

create table if not exists public.support_faq_suggestions (
  id uuid primary key default gen_random_uuid(),
  category_key text not null check (category_key in ('payment', 'technical', 'account', 'general')),
  search_query text not null,
  suggested_question text not null,
  details text null,
  user_id uuid null default auth.uid() references public.profiles (id) on delete set null,
  session_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_support_faq_suggestions_category_created
  on public.support_faq_suggestions (category_key, created_at desc);

create index if not exists idx_support_faq_suggestions_search_query
  on public.support_faq_suggestions (search_query);

alter table public.support_faq_suggestions enable row level security;

drop policy if exists "support_faq_suggestions_public_insert" on public.support_faq_suggestions;
create policy "support_faq_suggestions_public_insert"
on public.support_faq_suggestions
for insert
to anon, authenticated
with check (
  char_length(trim(search_query)) > 0
  and char_length(trim(suggested_question)) > 0
  and category_key in ('payment', 'technical', 'account', 'general')
);

drop policy if exists "support_faq_suggestions_admin_select" on public.support_faq_suggestions;
create policy "support_faq_suggestions_admin_select"
on public.support_faq_suggestions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

grant insert on public.support_faq_suggestions to anon, authenticated;
grant select on public.support_faq_suggestions to authenticated;
grant all on public.support_faq_suggestions to service_role;

commit;
