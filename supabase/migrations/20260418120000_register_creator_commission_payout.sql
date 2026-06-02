begin;

create or replace function public.register_creator_commission_payout(
  _creator_id uuid,
  _commission_ids uuid[],
  _paid_at timest?mptz default timezone('utc', now()),
  _created_by uuid default null,
  _notes text default null
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
    and cc.status in ('pending', 'eligible')
    and cc.eligible_at <= _paid_at;

  if commission_count <> expected_count then
    raise exception 'Seleção inválida: use apenas comissões elegíveis, pendentes e do mesmo criador.';
  end if;

  select *
    into creator_profile_record
  from public.creator_profiles
  where user_id = _creator_id;

  insert into public.creator_payouts (
    creator_id,
    amount_cents,
    status,
    pix_key_type,
    pix_key,
    payout_name,
    scheduled_for,
    paid_at,
    created_by,
    notes
  )
  values (
    _creator_id,
    amount_total,
    'paid',
    creator_profile_record.pix_key_type,
    creator_profile_record.pix_key,
    creator_profile_record.payout_name,
    _paid_at::date,
    _paid_at,
    _created_by,
    _notes
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

grant execute on function public.register_creator_commission_payout(uuid, uuid[], timest?mptz, uuid, text) to service_role;

commit;
