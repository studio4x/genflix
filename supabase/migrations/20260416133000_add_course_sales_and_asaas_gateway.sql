begin;

alter table public.courses
  add column if not exists slug text,
  add column if not exists launch_date date,
  add column if not exists price_cents integer not null default 0 check (price_cents >= 0),
  add column if not exists currency text not null default 'BRL',
  add column if not exists is_public boolean not null default true;

create unique index if not exists courses_slug_unique_idx
  on public.courses (lower(slug))
  where slug is not null;

comment on column public.courses.slug is
  'Slug pblico do curso para uso em catalogo, checkout e rotas publicas.';

comment on column public.courses.launch_date is
  'Data de lancamento usada em relatorios e comunicacoes comerciais.';

comment on column public.courses.price_cents is
  'Valor de venda do curso em centavos.';

comment on column public.courses.currency is
  'Moeda comercial do curso. Mantido para futuras expansoes.';

comment on column public.courses.is_public is
  'Define se o curso aparece no catalogo pblico.';

create table if not exists public.payment_gateway_settings (
  id integer primary key check (id = 1),
  gateway_code text not null default 'asaas' check (gateway_code = 'asaas'),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  is_active boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

insert into public.payment_gateway_settings (id, gateway_code, environment, is_active)
values (1, 'asaas', 'sandbox', true)
on conflict (id) do update
set
  gateway_code = excluded.gateway_code,
  environment = excluded.environment,
  is_active = excluded.is_active;

create table if not exists public.commerce_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_document text,
  gateway_code text not null default 'asaas' check (gateway_code = 'asaas'),
  gateway_environment text not null default 'sandbox' check (gateway_environment in ('sandbox', 'production')),
  external_reference text not null unique,
  external_checkout_id text,
  checkout_url text,
  external_customer_id text,
  external_payment_id text,
  status text not null default 'created' check (status in ('created', 'active', 'paid', 'canceled', 'expired', 'failed')),
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  released_at timest?mptz,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

alter table public.commerce_checkout_sessions
  add column if not exists course_id uuid references public.courses (id) on delete cascade,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists buyer_name text,
  add column if not exists buyer_email text,
  add column if not exists buyer_document text,
  add column if not exists gateway_code text not null default 'asaas',
  add column if not exists gateway_environment text not null default 'sandbox',
  add column if not exists external_reference text,
  add column if not exists external_checkout_id text,
  add column if not exists checkout_url text,
  add column if not exists external_customer_id text,
  add column if not exists external_payment_id text,
  add column if not exists status text not null default 'created',
  add column if not exists raw_request jsonb not null default '{}'::jsonb,
  add column if not exists raw_response jsonb not null default '{}'::jsonb,
  add column if not exists released_at timest?mptz,
  add column if not exists created_at timest?mptz not null default timezone('utc', now()),
  add column if not exists updated_at timest?mptz not null default timezone('utc', now());

create index if not exists commerce_checkout_sessions_course_id_idx
  on public.commerce_checkout_sessions (course_id);

create index if not exists commerce_checkout_sessions_user_id_idx
  on public.commerce_checkout_sessions (user_id);

create unique index if not exists commerce_checkout_sessions_external_reference_unique_idx
  on public.commerce_checkout_sessions (external_reference)
  where external_reference is not null;

create index if not exists commerce_checkout_sessions_external_checkout_id_idx
  on public.commerce_checkout_sessions (external_checkout_id);

create table if not exists public.commerce_events (
  id uuid primary key default gen_random_uuid(),
  gateway_code text not null default 'asaas' check (gateway_code = 'asaas'),
  gateway_environment text not null default 'sandbox' check (gateway_environment in ('sandbox', 'production')),
  external_event_id text not null unique,
  event_type text not null,
  course_id uuid references public.courses (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  checkout_session_id uuid references public.commerce_checkout_sessions (id) on delete set null,
  external_checkout_id text,
  external_payment_id text,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  received_at timest?mptz not null default timezone('utc', now())
);

alter table public.commerce_events
  add column if not exists gateway_code text not null default 'asaas',
  add column if not exists gateway_environment text not null default 'sandbox',
  add column if not exists external_event_id text,
  add column if not exists event_type text,
  add column if not exists course_id uuid references public.courses (id) on delete set null,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists checkout_session_id uuid references public.commerce_checkout_sessions (id) on delete set null,
  add column if not exists external_checkout_id text,
  add column if not exists external_payment_id text,
  add column if not exists status text not null default 'received',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists received_at timest?mptz not null default timezone('utc', now());

create index if not exists commerce_events_checkout_session_id_idx
  on public.commerce_events (checkout_session_id);

create unique index if not exists commerce_events_external_event_id_unique_idx
  on public.commerce_events (external_event_id)
  where external_event_id is not null;

create index if not exists commerce_events_external_checkout_id_idx
  on public.commerce_events (external_checkout_id);

create index if not exists commerce_events_external_payment_id_idx
  on public.commerce_events (external_payment_id);

drop trigger if exists set_payment_gateway_settings_updated_at on public.payment_gateway_settings;
create trigger set_payment_gateway_settings_updated_at
before update on public.payment_gateway_settings
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_commerce_checkout_sessions_updated_at on public.commerce_checkout_sessions;
create trigger set_commerce_checkout_sessions_updated_at
before update on public.commerce_checkout_sessions
for each row
execute procedure public.set_updated_at();

grant select, insert, update, delete on public.payment_gateway_settings to authenticated;
grant select, insert, update, delete on public.commerce_checkout_sessions to authenticated;
grant select, insert, update, delete on public.commerce_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.payment_gateway_settings to service_role;
grant all on public.commerce_checkout_sessions to service_role;
grant all on public.commerce_events to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.payment_gateway_settings enable row level security;
alter table public.commerce_checkout_sessions enable row level security;
alter table public.commerce_events enable row level security;

drop policy if exists "payment_gateway_settings_admin_all" on public.payment_gateway_settings;
create policy "payment_gateway_settings_admin_all"
on public.payment_gateway_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "payment_gateway_settings_service_role_all" on public.payment_gateway_settings;
create policy "payment_gateway_settings_service_role_all"
on public.payment_gateway_settings
for all
to service_role
using (true)
with check (true);

drop policy if exists "commerce_checkout_sessions_admin_all" on public.commerce_checkout_sessions;
create policy "commerce_checkout_sessions_admin_all"
on public.commerce_checkout_sessions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "commerce_checkout_sessions_service_role_all" on public.commerce_checkout_sessions;
create policy "commerce_checkout_sessions_service_role_all"
on public.commerce_checkout_sessions
for all
to service_role
using (true)
with check (true);

drop policy if exists "commerce_events_admin_all" on public.commerce_events;
create policy "commerce_events_admin_all"
on public.commerce_events
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "commerce_events_service_role_all" on public.commerce_events;
create policy "commerce_events_service_role_all"
on public.commerce_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "courses_public_catalog_select" on public.courses;
create policy "courses_public_catalog_select"
on public.courses
for select
to anon
using (
  status = 'published'
  and is_public = true
);

commit;
