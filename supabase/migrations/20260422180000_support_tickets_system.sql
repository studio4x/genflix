begin;

create table if not exists public.site_config (
  id integer primary key default 1 check (id = 1),
  support_sla_config jsonb not null default '{}'::jsonb,
  support_business_hours_config jsonb not null default '{}'::jsonb,
  crisis_protocol_config jsonb not null default '{}'::jsonb,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

drop trigger if exists set_site_config_updated_at on public.site_config;
create trigger set_site_config_updated_at
before update on public.site_config
for each row
execute procedure public.set_updated_at();

insert into public.site_config (
  id,
  support_sla_config,
  support_business_hours_config,
  crisis_protocol_config
)
values (
  1,
  jsonb_build_object(
    'categories',
    jsonb_build_array(
      jsonb_build_object('key', 'payment', 'label', 'Pagamentos', 'first_response_hours', 2, 'position', 1, 'description', 'Primeira resposta em ate 2 horas uteis.'),
      jsonb_build_object('key', 'technical', 'label', 'Problema tecnico', 'first_response_hours', 24, 'position', 2, 'description', 'Primeira resposta em ate 24 horas uteis.'),
      jsonb_build_object('key', 'account', 'label', 'Conta e acesso', 'first_response_hours', 24, 'position', 3, 'description', 'Primeira resposta em ate 24 horas uteis.'),
      jsonb_build_object('key', 'general', 'label', 'Duvida geral', 'first_response_hours', 24, 'position', 4, 'description', 'Primeira resposta em ate 24 horas uteis.')
    ),
    'public_note',
    'Os prazos acima se referem ao tempo da primeira resposta humana da equipe. N?o representam prazo de resolucao final.'
  ),
  jsonb_build_object(
    'timezone', 'America/Sao_Paulo',
    'days_of_week', jsonb_build_array(1, 2, 3, 4, 5),
    'start_hour', 8,
    'end_hour', 18
  ),
  jsonb_build_object(
    'title', 'Casos graves ou sensiveis',
    'description', 'Para situacoes com fraude, seguran?a, abuso ou necessidade urgente de orientacao, abra o chamado com o maximo de contexto e prioridade compativel.',
    'note', 'N?ossa equipe trata a fila de forma humana e responsavel, respeitando a ordem operacional e o SLA da categoria.'
  )
)
on conflict (id) do nothing;

create table if not exists public.support_faqs (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

drop trigger if exists set_support_faqs_updated_at on public.support_faqs;
create trigger set_support_faqs_updated_at
before update on public.support_faqs
for each row
execute procedure public.set_updated_at();

insert into public.support_faqs (category_key, question, answer, sort_order, is_published)
values
  ('payment', 'Como acompanho meu pagamento', 'Acesse sua area do aluno e confira os comprovantes e situacoes mais recentes relacionadas ao pedido. Se houver divergencia, abra um chamado na categoria Pagamentos.', 1, true),
  ('payment', 'Meu acesso n?o foi liberado apos a compra. O que fazer', 'Em geral a libera??o ocorre em poucos instantes. Se o problema persistir, informe e-mail da conta, curso comprado e comprovante para que possamos verificar.', 2, true),
  ('technical', 'A aula n?o carrega ou trava. Como proceder', 'Atualize a p?gina, teste outro navegador e verifique sua conexao. Se continuar, envie o nome do curso, m?dulo e aula para investigarmos.', 3, true),
  ('technical', 'N?o consigo abrir anexos ou materiais.', 'Confirme se o material foi liberado para sua turma e tente novamente em outro navegador. Se precisar, envie um print com a mensagem exibida.', 4, true),
  ('account', 'Como altero meus dados de conta', 'Na area do aluno, abra Minha Conta para atualizar nome, idioma, fuso e WhatsApp. Para ajustes mais sensiveis, abra um chamado.', 5, true),
  ('general', 'Onde encontro orientacoes rapidas sobre a plataforma', 'N?ossa p?gina publica de suporte organiza perguntas frequentes, horario de atendimento e o caminho para abrir um chamado quando necessrio.', 6, true)
on conflict do nothing;

create or replace function public.get_support_sla_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select support_sla_config
      from public.site_config
      where id = 1
    ),
    jsonb_build_object(
      'categories',
      jsonb_build_array(
        jsonb_build_object('key', 'payment', 'label', 'Pagamentos', 'first_response_hours', 2, 'position', 1, 'description', 'Primeira resposta em ate 2 horas uteis.'),
        jsonb_build_object('key', 'technical', 'label', 'Problema tecnico', 'first_response_hours', 24, 'position', 2, 'description', 'Primeira resposta em ate 24 horas uteis.'),
        jsonb_build_object('key', 'account', 'label', 'Conta e acesso', 'first_response_hours', 24, 'position', 3, 'description', 'Primeira resposta em ate 24 horas uteis.'),
        jsonb_build_object('key', 'general', 'label', 'Duvida geral', 'first_response_hours', 24, 'position', 4, 'description', 'Primeira resposta em ate 24 horas uteis.')
      ),
      'public_note',
      'Os prazos acima se referem ao tempo da primeira resposta humana da equipe. N?o representam prazo de resolucao final.'
    )
  );
$$;

create or replace function public.get_support_business_hours_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select support_business_hours_config
      from public.site_config
      where id = 1
    ),
    jsonb_build_object(
      'timezone', 'America/Sao_Paulo',
      'days_of_week', jsonb_build_array(1, 2, 3, 4, 5),
      'start_hour', 8,
      'end_hour', 18
    )
  );
$$;

create or replace function public.get_support_crisis_protocol_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select crisis_protocol_config
      from public.site_config
      where id = 1
    ),
    jsonb_build_object(
      'title', 'Casos graves ou sensiveis',
      'description', 'Para situacoes com fraude, seguran?a, abuso ou necessidade urgente de orientacao, abra o chamado com o maximo de contexto e prioridade compativel.',
      'note', 'N?ossa equipe trata a fila de forma humana e responsavel, respeitando a ordem operacional e o SLA da categoria.'
    )
  );
$$;

create or replace function public.get_support_sla_target_hours(_category text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_category text := lower(trim(coalesce(_category, 'general')));
  category_row jsonb;
  response_hours integer;
begin
  select category_item
  into category_row
  from jsonb_array_elements(coalesce(public.get_support_sla_config()->'categories', '[]'::jsonb)) as category_item
  where lower(coalesce(category_item->>'key', '')) = normalized_category
  order by coalesce((category_item->>'position')::integer, 999)
  limit 1;

  response_hours := coalesce((category_row->>'first_response_hours')::integer, null);

  if response_hours is null then
    return 24;
  end if;

  return greatest(response_hours, 1);
end;
$$;

create or replace function public.is_support_business_minute(_ts timest?mptz)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  config jsonb := public.get_support_business_hours_config();
  timezone_name text := coalesce(config->>'timezone', 'America/Sao_Paulo');
  local_ts timest?mp;
  local_dow integer;
  local_minutes integer;
  start_minutes integer := coalesce((config->>'start_hour')::integer, 8) * 60;
  end_minutes integer := coalesce((config->>'end_hour')::integer, 18) * 60;
begin
  local_ts := _ts at time zone timezone_name;
  local_dow := extract(isodow from local_ts);
  local_minutes := extract(hour from local_ts)::integer * 60 + extract(minute from local_ts)::integer;

  if not exists (
    select 1
    from jsonb_array_elements_text(coalesce(config->'days_of_week', '[1,2,3,4,5]'::jsonb)) as allowed_day(day_value)
    where allowed_day.day_value::integer = local_dow
  ) then
    return false;
  end if;

  return local_minutes >= start_minutes and local_minutes < end_minutes;
end;
$$;

create or replace function public.align_support_business_start(_ts timest?mptz)
returns timest?mptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_ts timest?mptz := date_trunc('minute', coalesce(_ts, timezone('utc', now())));
  guard_counter integer := 0;
begin
  while public.is_support_business_minute(current_ts) = false loop
    current_ts := current_ts + interval '1 minute';
    guard_counter := guard_counter + 1;

    if guard_counter > 20000 then
      exit;
    end if;
  end loop;

  return current_ts;
end;
$$;

create or replace function public.add_support_business_minutes(_start_ts timest?mptz, _minutes integer)
returns timest?mptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_minutes integer := greatest(coalesce(_minutes, 0), 0);
  current_ts timest?mptz := public.align_support_business_start(coalesce(_start_ts, timezone('utc', now())));
  consumed integer := 0;
  guard_counter integer := 0;
begin
  if target_minutes = 0 then
    return current_ts;
  end if;

  while consumed < target_minutes loop
    if public.is_support_business_minute(current_ts) then
      consumed := consumed + 1;
      if consumed = target_minutes then
        return current_ts;
      end if;
    end if;

    current_ts := current_ts + interval '1 minute';
    guard_counter := guard_counter + 1;

    if guard_counter > 100000 then
      exit;
    end if;
  end loop;

  return current_ts;
end;
$$;

create or replace function public.compute_support_sla_status(_first_response_due_at timest?mptz, _first_response_at timest?mptz)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  due_at timest?mptz := _first_response_due_at;
  answered_at timest?mptz := _first_response_at;
begin
  if answered_at is not null then
    return 'answered';
  end if;

  if due_at is null then
    return 'on_time';
  end if;

  if timezone('utc', now()) > due_at then
    return 'overdue';
  end if;

  if timezone('utc', now()) >= due_at - interval '60 minutes' then
    return 'at_risk';
  end if;

  return 'on_time';
end;
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category text not null default 'general' check (category in ('payment', 'technical', 'account', 'general')),
  attachment_url text,
  attachment_name text,
  first_response_due_at timest?mptz,
  first_response_at timest?mptz,
  sla_policy_key text not null default 'general',
  sla_status text not null default 'on_time' check (sla_status in ('on_time', 'at_risk', 'overdue', 'answered')),
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create index if not exists idx_support_tickets_category
  on public.support_tickets (category);

create index if not exists idx_support_tickets_due_status
  on public.support_tickets (status, first_response_due_at);

create index if not exists idx_support_tickets_first_response_due
  on public.support_tickets (first_response_due_at);

create index if not exists idx_support_tickets_user_created
  on public.support_tickets (user_id, created_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  attachment_url text,
  attachment_name text,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists idx_support_messages_ticket_created
  on public.support_messages (ticket_id, created_at asc);

create or replace function public.set_support_ticket_sla_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category_key text := lower(trim(coalesce(new.category, 'general')));
  target_hours integer := public.get_support_sla_target_hours(category_key);
begin
  new.sla_policy_key := category_key;

  if tg_op = 'INSERT'
    or new.category is distinct from old.category
    or new.created_at is distinct from old.created_at then
    new.first_response_due_at := public.add_support_business_minutes(coalesce(new.created_at, timezone('utc', now())), target_hours * 60);
  end if;

  new.sla_status := public.compute_support_sla_status(new.first_response_due_at, new.first_response_at);
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_sla_fields on public.support_tickets;
create trigger trg_support_ticket_sla_fields
before insert or update of category, created_at, first_response_at
on public.support_tickets
for each row
execute procedure public.set_support_ticket_sla_fields();

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row
execute procedure public.set_updated_at();

create or replace function public.set_support_first_admin_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(new.sender_id, 'admin') then
    update public.support_tickets
    set
      first_response_at = coalesce(first_response_at, new.created_at),
      sla_status = public.compute_support_sla_status(first_response_due_at, coalesce(first_response_at, new.created_at)),
      updated_at = timezone('utc', now())
    where id = new.ticket_id;
  else
    update public.support_tickets
    set
      updated_at = timezone('utc', now())
    where id = new.ticket_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_first_admin_response on public.support_messages;
create trigger trg_support_first_admin_response
after insert on public.support_messages
for each row
execute procedure public.set_support_first_admin_response();

create or replace function public.create_support_notification(
  _user_id uuid,
  _title text,
  _body text,
  _action_url text,
  _priority text default 'normal',
  _channels text[] default array['in-app', 'email', 'whatsapp'],
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
  channel_name text;
  normalized_title text := left(trim(coalesce(_title, '')), 200);
  normalized_body text := trim(coalesce(_body, ''));
  normalized_priority text := case
    when lower(coalesce(_priority, 'normal')) in ('low', 'normal', 'high', 'urgent')
      then lower(_priority)
    else 'normal'
  end;
begin
  if normalized_title = '' or normalized_body = '' then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    title,
    body,
    action_url,
    category,
    priority,
    is_actionable,
    metadata
  )
  values (
    _user_id,
    normalized_title,
    normalized_body,
    _action_url,
    'support',
    normalized_priority,
    _action_url is not null,
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into notification_id;

  foreach channel_name in array coalesce(_channels, array['in-app']) loop
    channel_name := lower(trim(channel_name));

    if channel_name in ('push', 'email', 'whatsapp', 'in-app') then
      insert into public.notification_queue (
        notification_id,
        user_id,
        channel,
        title,
        body,
        payload,
        status,
        attempt_count,
        last_attempt_at
      )
      values (
        notification_id,
        _user_id,
        channel_name,
        normalized_title,
        normalized_body,
        jsonb_build_object(
          'action_url', _action_url,
          'category', 'support',
          'priority', normalized_priority,
          'metadata', coalesce(_metadata, '{}'::jsonb)
        ),
        case when channel_name = 'in-app' then 'sent' else 'pending' end,
        case when channel_name = 'in-app' then 1 else 0 end,
        case when channel_name = 'in-app' then timezone('utc', now()) else null end
      );
    end if;
  end loop;

  return notification_id;
end;
$$;

create or replace function public.notify_support_ticket_event(
  _ticket_id uuid,
  _event_type text,
  _message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_event text := lower(trim(coalesce(_event_type, '')));
  ticket_record public.support_tickets%rowtype;
  message_record public.support_messages%rowtype;
  admin_recipient record;
  notification_title text;
  notification_body text;
  notification_priority text;
begin
  if current_user_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  select *
  into ticket_record
  from public.support_tickets
  where id = _ticket_id;

  if ticket_record.id is null then
    raise exception 'Ticket n?o encontrado.';
  end if;

  if current_user_id <> ticket_record.user_id and public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_event not in ('new_ticket', 'new_message', 'ticket_closed') then
    raise exception 'Evento de suporte inv?lido.';
  end if;

  notification_priority := case ticket_record.priority
    when 'urgent' then 'urgent'
    when 'high' then 'high'
    when 'medium' then 'normal'
    else 'low'
  end;

  if _message_id is not null then
    select *
    into message_record
    from public.support_messages
    where id = _message_id;
  end if;

  if normalized_event in ('new_ticket', 'new_message') and public.has_role(current_user_id, 'admin') = false then
    notification_title := case
      when normalized_event = 'new_ticket' then 'N?ovo chamado aberto'
      else 'N?ova resposta em chamado'
    end;
    notification_body := case
      when normalized_event = 'new_ticket' then ticket_record.subject
      else coalesce(nullif(left(trim(coalesce(message_record.message, '')), 160), ''), ticket_record.subject)
    end;

    for admin_recipient in
      select distinct p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id
      where r.code = 'admin'
    loop
      perform public.create_support_notification(
        admin_recipient.id,
        notification_title,
        notification_body,
        '/admin/suporte/' || ticket_record.id::text,
        notification_priority,
        array['in-app', 'email', 'whatsapp'],
        jsonb_build_object(
          'ticket_id', ticket_record.id,
          'event_type', normalized_event,
          'message_id', _message_id,
          'user_id', ticket_record.user_id
        )
      );
    end loop;
    return;
  end if;

  if normalized_event = 'new_message' and public.has_role(current_user_id, 'admin') then
    perform public.create_support_notification(
      ticket_record.user_id,
      'Equipe respondeu seu chamado',
      coalesce(nullif(left(trim(coalesce(message_record.message, '')), 160), ''), ticket_record.subject),
      '/aluno/suporte/' || ticket_record.id::text,
      notification_priority,
      array['in-app', 'email', 'whatsapp'],
      jsonb_build_object(
        'ticket_id', ticket_record.id,
        'event_type', normalized_event,
        'message_id', _message_id
      )
    );
    return;
  end if;

  if normalized_event = 'ticket_closed' and public.has_role(current_user_id, 'admin') then
    perform public.create_support_notification(
      ticket_record.user_id,
      'Seu chamado foi encerrado',
      ticket_record.subject,
      '/aluno/suporte/' || ticket_record.id::text,
      notification_priority,
      array['in-app', 'email', 'whatsapp'],
      jsonb_build_object(
        'ticket_id', ticket_record.id,
        'event_type', normalized_event
      )
    );
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'uploads',
  'uploads',
  true,
  10485760
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

alter table public.site_config enable row level security;
alter table public.support_faqs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "site_config_public_select" on public.site_config;
create policy "site_config_public_select"
on public.site_config
for select
to anon, authenticated
using (true);

drop policy if exists "site_config_admin_update" on public.site_config;
create policy "site_config_admin_update"
on public.site_config
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_faqs_public_select" on public.support_faqs;
create policy "support_faqs_public_select"
on public.support_faqs
for select
to anon, authenticated
using (is_published = true or public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_faqs_admin_all" on public.support_faqs;
create policy "support_faqs_admin_all"
on public.support_faqs
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_tickets_owner_or_admin_select" on public.support_tickets;
create policy "support_tickets_owner_or_admin_select"
on public.support_tickets
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_tickets_owner_insert" on public.support_tickets;
create policy "support_tickets_owner_insert"
on public.support_tickets
for insert
to authenticated
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_tickets_admin_update" on public.support_tickets;
create policy "support_tickets_admin_update"
on public.support_tickets
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_tickets_admin_delete" on public.support_tickets;
create policy "support_tickets_admin_delete"
on public.support_tickets
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "support_messages_accessible_select" on public.support_messages;
create policy "support_messages_accessible_select"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (
        ticket.user_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
      )
  )
);

drop policy if exists "support_messages_accessible_insert" on public.support_messages;
create policy "support_messages_accessible_insert"
on public.support_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (
        ticket.user_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
      )
  )
);

drop policy if exists "uploads_public_select" on storage.objects;
create policy "uploads_public_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'uploads');

drop policy if exists "uploads_authenticated_insert" on storage.objects;
create policy "uploads_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and (
    name like ('support/' || auth.uid()::text || '/%')
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "uploads_authenticated_update" on storage.objects;
create policy "uploads_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'uploads'
  and (
    name like ('support/' || auth.uid()::text || '/%')
    or public.has_role(auth.uid(), 'admin')
  )
)
with check (
  bucket_id = 'uploads'
  and (
    name like ('support/' || auth.uid()::text || '/%')
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "uploads_authenticated_delete" on storage.objects;
create policy "uploads_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'uploads'
  and (
    name like ('support/' || auth.uid()::text || '/%')
    or public.has_role(auth.uid(), 'admin')
  )
);

grant select on public.site_config to anon, authenticated;
grant select on public.support_faqs to anon, authenticated;
grant select, insert, update, delete on public.site_config to authenticated;
grant insert, update, delete on public.support_faqs to authenticated;
grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant execute on function public.get_support_sla_config() to anon, authenticated;
grant execute on function public.get_support_business_hours_config() to anon, authenticated;
grant execute on function public.get_support_crisis_protocol_config() to anon, authenticated;
grant execute on function public.get_support_sla_target_hours(text) to anon, authenticated;
grant execute on function public.is_support_business_minute(timest?mptz) to service_role;
grant execute on function public.align_support_business_start(timest?mptz) to service_role;
grant execute on function public.add_support_business_minutes(timest?mptz, integer) to service_role;
grant execute on function public.compute_support_sla_status(timest?mptz, timest?mptz) to authenticated, service_role;
grant execute on function public.notify_support_ticket_event(uuid, text, uuid) to authenticated, service_role;
grant all on public.site_config to service_role;
grant all on public.support_faqs to service_role;
grant all on public.support_tickets to service_role;
grant all on public.support_messages to service_role;

do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
