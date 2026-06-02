begin;

insert into public.roles (code, name)
values
  ('criador', 'Criador'),
  ('professor', 'Criador legado')
on conflict (code) do update set name = excluded.name;

alter table public.courses
  add column if not exists creator_id uuid references public.profiles (id) on delete set null,
  add column if not exists creator_commission_percent numeric(5,2) not null default 0 check (creator_commission_percent >= 0 and creator_commission_percent <= 100);

alter table public.commerce_checkout_sessions
  drop constraint if exists commerce_checkout_sessions_status_check;

alter table public.commerce_checkout_sessions
  add constraint commerce_checkout_sessions_status_check
  check (status in ('created', 'active', 'paid', 'canceled', 'expired', 'failed', 'refunded', 'chargeback'));

create index if not exists courses_creator_id_idx
  on public.courses (creator_id);

create table if not exists public.creator_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  payout_name text,
  document text,
  pix_key_type text check (pix_key_type is null or pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_key text,
  default_commission_percent numeric(5,2) not null default 0 check (default_commission_percent >= 0 and default_commission_percent <= 100),
  payout_hold_days integer not null default 30 check (payout_hold_days >= 0 and payout_hold_days <= 90),
  is_payout_enabled boolean not null default false,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create table if not exists public.creator_commissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  checkout_session_id uuid references public.commerce_checkout_sessions (id) on delete set null,
  external_payment_id text,
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount_cents integer not null default 0 check (commission_amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'eligible', 'scheduled', 'paid', 'canceled', 'refunded', 'failed')),
  sale_paid_at timest?mptz not null default timezone('utc', now()),
  eligible_at timest?mptz not null default (timezone('utc', now()) + interval '30 days'),
  canceled_at timest?mptz,
  refunded_at timest?mptz,
  paid_at timest?mptz,
  notes text,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now()),
  unique (checkout_session_id)
);

create index if not exists creator_commissions_creator_id_idx
  on public.creator_commissions (creator_id);

create index if not exists creator_commissions_course_id_idx
  on public.creator_commissions (course_id);

create index if not exists creator_commissions_status_eligible_idx
  on public.creator_commissions (status, eligible_at);

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'processing', 'paid', 'failed', 'canceled')),
  pix_key_type text,
  pix_key text,
  payout_name text,
  scheduled_for date,
  paid_at timest?mptz,
  created_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create index if not exists creator_payouts_creator_id_idx
  on public.creator_payouts (creator_id);

create table if not exists public.creator_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.creator_payouts (id) on delete cascade,
  commission_id uuid not null references public.creator_commissions (id) on delete restrict,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timest?mptz not null default timezone('utc', now()),
  unique (commission_id)
);

create index if not exists creator_payout_items_payout_id_idx
  on public.creator_payout_items (payout_id);

drop trigger if exists set_creator_profiles_updated_at on public.creator_profiles;
create trigger set_creator_profiles_updated_at
before update on public.creator_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_creator_commissions_updated_at on public.creator_commissions;
create trigger set_creator_commissions_updated_at
before update on public.creator_commissions
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_creator_payouts_updated_at on public.creator_payouts;
create trigger set_creator_payouts_updated_at
before update on public.creator_payouts
for each row
execute procedure public.set_updated_at();

create or replace function public.is_creator_for_course(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = _course_id
      and c.creator_id = _user_id
  );
$$;

create or replace function public.create_creator_commission_for_checkout(_checkout_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.commerce_checkout_sessions%rowtype;
  course_record public.courses%rowtype;
  creator_profile_record public.creator_profiles%rowtype;
  commission_rate numeric(5,2);
  commission_amount integer;
  hold_days integer;
  commission_id uuid;
begin
  select *
    into session_record
  from public.commerce_checkout_sessions
  where id = _checkout_session_id
  limit 1;

  if session_record.id is null or session_record.status <> 'paid' then
    return null;
  end if;

  select *
    into course_record
  from public.courses
  where id = session_record.course_id
  limit 1;

  if course_record.id is null or course_record.creator_id is null then
    return null;
  end if;

  select *
    into creator_profile_record
  from public.creator_profiles
  where user_id = course_record.creator_id
  limit 1;

  commission_rate := coalesce(nullif(course_record.creator_commission_percent, 0), creator_profile_record.default_commission_percent, 0);

  if commission_rate <= 0 then
    return null;
  end if;

  hold_days := coalesce(creator_profile_record.payout_hold_days, 30);
  commission_amount := floor(coalesce(course_record.price_cents, 0) * commission_rate / 100.0)::integer;

  insert into public.creator_commissions (
    course_id,
    creator_id,
    checkout_session_id,
    external_payment_id,
    gross_amount_cents,
    commission_rate,
    commission_amount_cents,
    status,
    sale_paid_at,
    eligible_at
  )
  values (
    session_record.course_id,
    course_record.creator_id,
    session_record.id,
    session_record.external_payment_id,
    coalesce(course_record.price_cents, 0),
    commission_rate,
    commission_amount,
    'pending',
    coalesce(session_record.released_at, timezone('utc', now())),
    coalesce(session_record.released_at, timezone('utc', now())) + make_interval(days => hold_days)
  )
  on conflict (checkout_session_id) do update
  set
    external_payment_id = excluded.external_payment_id,
    gross_amount_cents = excluded.gross_amount_cents,
    commission_rate = excluded.commission_rate,
    commission_amount_cents = excluded.commission_amount_cents,
    status = case
      when public.creator_commissions.status in ('paid', 'scheduled') then public.creator_commissions.status
      else excluded.status
    end,
    sale_paid_at = excluded.sale_paid_at,
    eligible_at = excluded.eligible_at,
    canceled_at = null,
    refunded_at = null
  returning id into commission_id;

  return commission_id;
end;
$$;

create or replace function public.cancel_creator_commission_for_checkout(_checkout_session_id uuid, _reason text default 'checkout_canceled')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.creator_commissions
  set
    status = case
      when status = 'paid' then 'refunded'
      else 'canceled'
    end,
    canceled_at = timezone('utc', now()),
    refunded_at = case when status = 'paid' then timezone('utc', now()) else refunded_at end,
    notes = coalesce(notes || E'\n', '') || _reason
  where checkout_session_id = _checkout_session_id
    and status not in ('canceled', 'refunded');
end;
$$;

create or replace function public.get_creator_sales_report(_creator_id uuid default null, _course_id uuid default null)
returns table (
  course_id uuid,
  course_title text,
  creator_id uuid,
  launch_date date,
  period_index integer,
  period_starts_at date,
  period_ends_at date,
  sales_count bigint,
  gross_revenue_cents bigint,
  cancellations_count bigint,
  cancellations_amount_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed_courses as (
    select
      c.id,
      c.title,
      c.creator_id,
      coalesce(c.launch_date, c.created_at::date) as launch_date
    from public.courses c
    where c.creator_id is not null
      and (_course_id is null or c.id = _course_id)
      and (
        public.has_role(auth.uid(), 'admin')
        or c.creator_id = coalesce(_creator_id, auth.uid())
      )
  ),
  periods as (
    select
      ac.id as course_id,
      ac.title as course_title,
      ac.creator_id,
      ac.launch_date,
      gs.period_index,
      (ac.launch_date + (gs.period_index * interval '6 months'))::date as period_starts_at,
      (ac.launch_date + ((gs.period_index + 1) * interval '6 months') - interval '1 day')::date as period_ends_at
    from allowed_courses ac
    cross join lateral generate_series(
      0,
      greatest(0, floor(((timezone('utc', now())::date - ac.launch_date)::numeric) / 183)::integer)
    ) as gs(period_index)
  ),
  sessions as (
    select
      ccs.course_id,
      ccs.status,
      coalesce(ccs.released_at, ccs.updated_at, ccs.created_at) as event_at,
      coalesce(c.price_cents, 0) as amount_cents
    from public.commerce_checkout_sessions ccs
    join public.courses c on c.id = ccs.course_id
    where c.creator_id is not null
      and ccs.status in ('paid', 'canceled', 'expired', 'failed')
  )
  select
    p.course_id,
    p.course_title,
    p.creator_id,
    p.launch_date,
    p.period_index,
    p.period_starts_at,
    p.period_ends_at,
    count(*) filter (where s.status = 'paid') as sales_count,
    coalesce(sum(s.amount_cents) filter (where s.status = 'paid'), 0)::bigint as gross_revenue_cents,
    count(*) filter (where s.status in ('canceled', 'expired', 'failed')) as cancellations_count,
    coalesce(sum(s.amount_cents) filter (where s.status in ('canceled', 'expired', 'failed')), 0)::bigint as cancellations_amount_cents
  from periods p
  left join sessions s
    on s.course_id = p.course_id
    and s.event_at::date between p.period_starts_at and p.period_ends_at
  group by
    p.course_id,
    p.course_title,
    p.creator_id,
    p.launch_date,
    p.period_index,
    p.period_starts_at,
    p.period_ends_at
  order by p.course_title, p.period_index;
$$;

grant select, insert, update on public.creator_profiles to authenticated;
grant select on public.creator_commissions to authenticated;
grant select on public.creator_payouts to authenticated;
grant select on public.creator_payout_items to authenticated;
grant execute on function public.is_creator_for_course(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_creator_commission_for_checkout(uuid) to service_role;
grant execute on function public.cancel_creator_commission_for_checkout(uuid, text) to service_role;
grant execute on function public.get_creator_sales_report(uuid, uuid) to authenticated, service_role;

grant all on public.creator_profiles to service_role;
grant all on public.creator_commissions to service_role;
grant all on public.creator_payouts to service_role;
grant all on public.creator_payout_items to service_role;

alter table public.creator_profiles enable row level security;
alter table public.creator_commissions enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.creator_payout_items enable row level security;

drop policy if exists "creator_profiles_owner_select" on public.creator_profiles;
create policy "creator_profiles_owner_select"
on public.creator_profiles
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_profiles_owner_insert" on public.creator_profiles;
create policy "creator_profiles_owner_insert"
on public.creator_profiles
for insert
to authenticated
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_profiles_owner_update" on public.creator_profiles;
create policy "creator_profiles_owner_update"
on public.creator_profiles
for update
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_profiles_service_role_all" on public.creator_profiles;
create policy "creator_profiles_service_role_all"
on public.creator_profiles
for all
to service_role
using (true)
with check (true);

drop policy if exists "creator_commissions_owner_select" on public.creator_commissions;
create policy "creator_commissions_owner_select"
on public.creator_commissions
for select
to authenticated
using (auth.uid() = creator_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_commissions_service_role_all" on public.creator_commissions;
create policy "creator_commissions_service_role_all"
on public.creator_commissions
for all
to service_role
using (true)
with check (true);

drop policy if exists "creator_payouts_owner_select" on public.creator_payouts;
create policy "creator_payouts_owner_select"
on public.creator_payouts
for select
to authenticated
using (auth.uid() = creator_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_payouts_service_role_all" on public.creator_payouts;
create policy "creator_payouts_service_role_all"
on public.creator_payouts
for all
to service_role
using (true)
with check (true);

drop policy if exists "creator_payout_items_owner_select" on public.creator_payout_items;
create policy "creator_payout_items_owner_select"
on public.creator_payout_items
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.creator_payouts cp
    where cp.id = creator_payout_items.payout_id
      and cp.creator_id = auth.uid()
  )
);

drop policy if exists "creator_payout_items_service_role_all" on public.creator_payout_items;
create policy "creator_payout_items_service_role_all"
on public.creator_payout_items
for all
to service_role
using (true)
with check (true);

commit;
