begin;

create table if not exists public.creator_payout_settings (
  id smallint primary key default 1 check (id = 1),
  mode text not null default 'automatic' check (mode in ('manual', 'automatic')),
  interval_days integer not null default 30 check (interval_days >= 1 and interval_days <= 90),
  minimum_amount_cents integer not null default 0 check (minimum_amount_cents >= 0),
  is_enabled boolean not null default true,
  last_run_at timest?mptz,
  next_run_at timest?mptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

insert into public.creator_payout_settings (id, mode, interval_days, minimum_amount_cents, is_enabled, next_run_at)
values (1, 'automatic', 30, 0, true, timezone('utc', now()))
on conflict (id) do nothing;

alter table public.creator_payouts
  add column if not exists course_id uuid references public.courses (id) on delete set null,
  add column if not exists payout_method text not null default 'external' check (payout_method in ('external', 'asaas')),
  add column if not exists gateway_code text,
  add column if not exists external_transfer_id text,
  add column if not exists external_reference text,
  add column if not exists external_status text,
  add column if not exists processing_started_at timest?mptz,
  add column if not exists failed_at timest?mptz,
  add column if not exists failure_reason text,
  add column if not exists raw_request jsonb,
  add column if not exists raw_response jsonb;

create index if not exists creator_payouts_course_id_idx
  on public.creator_payouts (course_id);

create unique index if not exists creator_payouts_external_reference_key
  on public.creator_payouts (external_reference)
  where external_reference is not null;

create index if not exists creator_payouts_method_status_idx
  on public.creator_payouts (payout_method, status, scheduled_for);

alter table public.creator_commissions
  drop constraint if exists creator_commissions_commission_amount_cents_check;

alter table public.creator_payout_items
  drop constraint if exists creator_payout_items_amount_cents_check;

alter table public.creator_commissions
  add column if not exists adjustment_for_commission_id uuid references public.creator_commissions (id) on delete set null,
  add column if not exists adjustment_reason text;

create index if not exists creator_commissions_adjustment_for_idx
  on public.creator_commissions (adjustment_for_commission_id);

drop trigger if exists set_creator_payout_settings_updated_at on public.creator_payout_settings;
create trigger set_creator_payout_settings_updated_at
before update on public.creator_payout_settings
for each row
execute procedure public.set_updated_at();

create or replace function public.cancel_creator_commission_for_checkout(_checkout_session_id uuid, _reason text default 'checkout_canceled')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  commission_record public.creator_commissions%rowtype;
  adjustment_exists boolean;
begin
  select *
    into commission_record
  from public.creator_commissions
  where checkout_session_id = _checkout_session_id
  limit 1;

  if commission_record.id is null then
    return;
  end if;

  if commission_record.status = 'paid' then
    update public.creator_commissions
    set
      status = 'refunded',
      canceled_at = timezone('utc', now()),
      refunded_at = timezone('utc', now()),
      notes = coalesce(notes || E'\n', '') || _reason
    where id = commission_record.id;

    select exists (
      select 1
      from public.creator_commissions
      where adjustment_for_commission_id = commission_record.id
    ) into adjustment_exists;

    if not adjustment_exists and commission_record.commission_amount_cents > 0 then
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
        eligible_at,
        adjustment_for_commission_id,
        adjustment_reason,
        notes
      )
      values (
        commission_record.course_id,
        commission_record.creator_id,
        null,
        commission_record.external_payment_id,
        0,
        0,
        -commission_record.commission_amount_cents,
        'eligible',
        timezone('utc', now()),
        timezone('utc', now()),
        commission_record.id,
        _reason,
        'Ajuste negativo gerado por estorno de venda já repassada.'
      );
    end if;

    return;
  end if;

  update public.creator_commissions
  set
    status = 'canceled',
    canceled_at = timezone('utc', now()),
    notes = coalesce(notes || E'\n', '') || _reason
  where id = commission_record.id
    and status not in ('canceled', 'refunded');
end;
$$;

create or replace function public.register_creator_commission_payout(
  _creator_id uuid,
  _commission_ids uuid[],
  _paid_at timest?mptz default timezone('utc', now()),
  _created_by uuid default null,
  _notes text default null,
  _course_id uuid default null,
  _payout_method text default 'external',
  _gateway_code text default null,
  _external_transfer_id text default null,
  _external_reference text default null,
  _external_status text default null,
  _raw_request jsonb default null,
  _raw_response jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_id uuid;
  commission_count integer;
  expected_count integer;
  amount_total integer;
  creator_profile_record public.creator_profiles%rowtype;
begin
  select count(distinct item)::integer
    into expected_count
  from unnest(coalesce(_commission_ids, array[]::uuid[])) as item
  where item is not null;

  if coalesce(expected_count, 0) = 0 then
    raise exception 'Nenhuma comissão foi selecionada para repasse.';
  end if;

  if exists (
    select 1
    from public.creator_payout_items cpi
    where cpi.commission_id = any(_commission_ids)
  ) then
    raise exception 'Uma ou mais comissões selecionadas já fazem parte de outro repasse.';
  end if;

  select
    count(*)::integer,
    coalesce(sum(cc.commission_amount_cents), 0)::integer
    into commission_count, amount_total
  from public.creator_commissions cc
  where cc.id = any(_commission_ids)
    and cc.creator_id = _creator_id
    and (_course_id is null or cc.course_id = _course_id)
    and cc.status in ('pending', 'eligible')
    and cc.eligible_at <= _paid_at;

  if commission_count <> expected_count then
    raise exception 'Seleção inválida: use apenas comissões elegíveis, pendentes e do mesmo criador.';
  end if;

  if amount_total <= 0 then
    raise exception 'O total líquido do repasse precisa ser maior que zero.';
  end if;

  select *
    into creator_profile_record
  from public.creator_profiles
  where user_id = _creator_id;

  insert into public.creator_payouts (
    creator_id,
    course_id,
    amount_cents,
    status,
    payout_method,
    gateway_code,
    external_transfer_id,
    external_reference,
    external_status,
    pix_key_type,
    pix_key,
    payout_name,
    scheduled_for,
    paid_at,
    created_by,
    notes,
    raw_request,
    raw_response
  )
  values (
    _creator_id,
    _course_id,
    amount_total,
    'paid',
    coalesce(_payout_method, 'external'),
    _gateway_code,
    _external_transfer_id,
    _external_reference,
    _external_status,
    creator_profile_record.pix_key_type,
    creator_profile_record.pix_key,
    creator_profile_record.payout_name,
    _paid_at::date,
    _paid_at,
    _created_by,
    _notes,
    _raw_request,
    _raw_response
  )
  returning id into payout_id;

  insert into public.creator_payout_items (
    payout_id,
    commission_id,
    amount_cents
  )
  select
    payout_id,
    cc.id,
    cc.commission_amount_cents
  from public.creator_commissions cc
  where cc.id = any(_commission_ids)
    and cc.creator_id = _creator_id;

  update public.creator_commissions cc
  set
    status = 'paid',
    paid_at = _paid_at,
    notes = nullif(trim(coalesce(_notes, '')), ''),
    updated_at = timezone('utc', now())
  where cc.id = any(_commission_ids)
    and cc.creator_id = _creator_id;

  return payout_id;
end;
$$;

grant select, insert, update on public.creator_payout_settings to authenticated;
grant all on public.creator_payout_settings to service_role;
grant execute on function public.register_creator_commission_payout(uuid, uuid[], timest?mptz, uuid, text, uuid, text, text, text, text, text, jsonb, jsonb) to service_role;

alter table public.creator_payout_settings enable row level security;

drop policy if exists "creator_payout_settings_admin_select" on public.creator_payout_settings;
create policy "creator_payout_settings_admin_select"
on public.creator_payout_settings
for select
to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'criador'));

drop policy if exists "creator_payout_settings_admin_write" on public.creator_payout_settings;
create policy "creator_payout_settings_admin_write"
on public.creator_payout_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_payout_settings_service_role_all" on public.creator_payout_settings;
create policy "creator_payout_settings_service_role_all"
on public.creator_payout_settings
for all
to service_role
using (true)
with check (true);

commit;
