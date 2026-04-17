begin;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'direct' check (conversation_type in ('direct', 'support', 'group')),
  title varchar(160),
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  message_count integer not null default 0 check (message_count >= 0),
  is_archived boolean not null default false,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc nulls last, created_at desc);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute procedure public.set_updated_at();

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'participant' check (role in ('participant', 'admin', 'observer')),
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id);

create index if not exists conversation_participants_conversation_idx
  on public.conversation_participants (conversation_id, user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  content text not null check (char_length(content) <= 5000),
  message_type text not null default 'text' check (message_type in ('text', 'file', 'system', 'notification')),
  edited_at timestamptz,
  edited_by uuid references public.profiles (id) on delete set null,
  edited_reason varchar(300),
  attachments jsonb not null default '[]'::jsonb,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row
execute procedure public.set_updated_at();

create table if not exists public.message_read_status (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id)
);

create index if not exists message_read_status_user_idx
  on public.message_read_status (user_id, read_at desc);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type varchar(32) not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id, reaction_type)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  reported_by uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'abuse', 'other')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create or replace function public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = _conversation_id
      and cp.user_id = _user_id
  );
$$;

create or replace function public.search_message_recipients(_query text default '', _limit integer default 20)
returns table (
  id uuid,
  email text,
  full_name text,
  role_codes text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_query text := '%' || lower(trim(coalesce(_query, ''))) || '%';
  safe_limit integer := least(greatest(coalesce(_limit, 20), 1), 50);
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    coalesce(array_agg(distinct r.code) filter (where r.code is not null), array[]::text[]) as role_codes
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  where p.id <> current_user_id
    and (
      trim(coalesce(_query, '')) = ''
      or lower(coalesce(p.full_name, '')) like normalized_query
      or lower(coalesce(p.email, '')) like normalized_query
    )
  group by p.id, p.email, p.full_name
  order by coalesce(nullif(p.full_name, ''), p.email)
  limit safe_limit;
end;
$$;

create or replace function public.create_direct_conversation(_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if _recipient_id is null or _recipient_id = current_user_id then
    raise exception 'Selecione outro usuário para iniciar a conversa.';
  end if;

  if not exists (select 1 from public.profiles where id = _recipient_id) then
    raise exception 'Usuário de destino não encontrado.';
  end if;

  select cp1.conversation_id
    into existing_conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp2.conversation_id = cp1.conversation_id
   and cp2.user_id = _recipient_id
  join public.conversations c
    on c.id = cp1.conversation_id
   and c.conversation_type = 'direct'
  where cp1.user_id = current_user_id
    and (
      select count(*)
      from public.conversation_participants cp
      where cp.conversation_id = cp1.conversation_id
    ) = 2
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations (conversation_type, created_by)
  values ('direct', current_user_id)
  returning id into new_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role, last_read_at)
  values
    (new_conversation_id, current_user_id, 'participant', timezone('utc', now())),
    (new_conversation_id, _recipient_id, 'participant', null);

  return new_conversation_id;
end;
$$;

create or replace function public.list_user_conversations(_limit integer default 50)
returns table (
  conversation_id uuid,
  conversation_type text,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  message_count integer,
  unread_count integer,
  participants jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(_limit, 50), 1), 100);
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  return query
  select
    c.id,
    c.conversation_type,
    c.title::text,
    c.last_message_at,
    c.last_message_preview,
    c.message_count,
    my_participant.unread_count,
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', participant.user_id,
          'full_name', participant_profile.full_name,
          'email', participant_profile.email,
          'role', participant.role,
          'is_current_user', participant.user_id = current_user_id
        )
        order by participant.created_at
      )
      from public.conversation_participants participant
      join public.profiles participant_profile on participant_profile.id = participant.user_id
      where participant.conversation_id = c.id
    ) as participants
  from public.conversation_participants my_participant
  join public.conversations c on c.id = my_participant.conversation_id
  where my_participant.user_id = current_user_id
    and not c.is_archived
  order by c.last_message_at desc nulls last, c.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.list_conversation_messages(_conversation_id uuid, _limit integer default 80)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  sender_email text,
  content text,
  message_type text,
  attachments jsonb,
  is_deleted boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(_limit, 80), 1), 120);
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false
    and public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    coalesce(nullif(p.full_name, ''), p.email, 'Usuário GenFlix') as sender_name,
    p.email as sender_email,
    m.content,
    m.message_type,
    m.attachments,
    m.is_deleted,
    m.created_at,
    m.updated_at
  from public.messages m
  left join public.profiles p on p.id = m.sender_id
  where m.conversation_id = _conversation_id
  order by m.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.mark_conversation_read(_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  affected_count integer;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false
    and public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  insert into public.message_read_status (message_id, user_id, read_at)
  select m.id, current_user_id, timezone('utc', now())
  from public.messages m
  where m.conversation_id = _conversation_id
    and m.sender_id is distinct from current_user_id
  on conflict (message_id, user_id) do update
  set read_at = excluded.read_at;

  update public.conversation_participants
  set
    last_read_at = timezone('utc', now()),
    unread_count = 0
  where conversation_id = _conversation_id
    and user_id = current_user_id;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create or replace function public.send_conversation_message(
  _conversation_id uuid,
  _content text,
  _attachments jsonb default '[]'::jsonb
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_content text := trim(coalesce(_content, ''));
  saved_message public.messages%rowtype;
  recipient_record record;
  sender_name text;
  action_url text;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false then
    raise exception 'Você não participa desta conversa.';
  end if;

  if normalized_content = '' and jsonb_array_length(coalesce(_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Digite uma mensagem antes de enviar.';
  end if;

  if char_length(normalized_content) > 5000 then
    raise exception 'A mensagem deve ter no máximo 5000 caracteres.';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    content,
    attachments
  )
  values (
    _conversation_id,
    current_user_id,
    normalized_content,
    coalesce(_attachments, '[]'::jsonb)
  )
  returning * into saved_message;

  update public.conversations
  set
    last_message_at = saved_message.created_at,
    last_message_preview = left(coalesce(nullif(normalized_content, ''), 'Arquivo enviado'), 120),
    message_count = message_count + 1
  where id = _conversation_id;

  update public.conversation_participants
  set unread_count = unread_count + 1
  where conversation_id = _conversation_id
    and user_id is distinct from current_user_id;

  update public.conversation_participants
  set last_read_at = timezone('utc', now())
  where conversation_id = _conversation_id
    and user_id = current_user_id;

  select coalesce(nullif(full_name, ''), email, 'Usuário GenFlix')
    into sender_name
  from public.profiles
  where id = current_user_id;

  for recipient_record in
    select user_id
    from public.conversation_participants
    where conversation_id = _conversation_id
      and user_id is distinct from current_user_id
  loop
    action_url := '/mensagens?conversation=' || _conversation_id::text;

    perform public.create_user_notification(
      recipient_record.user_id,
      'Nova mensagem de ' || coalesce(sender_name, 'GenFlix'),
      left(coalesce(nullif(normalized_content, ''), 'Você recebeu um arquivo.'), 240),
      'message',
      'normal',
      action_url,
      array['in-app'],
      jsonb_build_object(
        'conversation_id', _conversation_id,
        'message_id', saved_message.id,
        'sender_id', current_user_id
      )
    );
  end loop;

  return saved_message;
end;
$$;

create or replace function public.report_message(
  _message_id uuid,
  _reason text,
  _description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation_id uuid;
  saved_report_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select conversation_id
    into target_conversation_id
  from public.messages
  where id = _message_id;

  if target_conversation_id is null then
    raise exception 'Mensagem não encontrada.';
  end if;

  if public.is_conversation_participant(target_conversation_id, current_user_id) = false
    and public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  insert into public.message_reports (message_id, reported_by, reason, description)
  values (_message_id, current_user_id, _reason, _description)
  returning id into saved_report_id;

  return saved_report_id;
end;
$$;

grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant select on public.messages to authenticated;
grant select, insert on public.message_read_status to authenticated;
grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert on public.message_reports to authenticated;
grant all on public.conversations to service_role;
grant all on public.conversation_participants to service_role;
grant all on public.messages to service_role;
grant all on public.message_read_status to service_role;
grant all on public.message_reactions to service_role;
grant all on public.message_reports to service_role;

grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated, service_role;
grant execute on function public.search_message_recipients(text, integer) to authenticated, service_role;
grant execute on function public.create_direct_conversation(uuid) to authenticated, service_role;
grant execute on function public.list_user_conversations(integer) to authenticated, service_role;
grant execute on function public.list_conversation_messages(uuid, integer) to authenticated, service_role;
grant execute on function public.send_conversation_message(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.report_message(uuid, text, text) to authenticated, service_role;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_read_status enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reports enable row level security;

drop policy if exists "conversations_participant_select" on public.conversations;
create policy "conversations_participant_select"
on public.conversations
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_conversation_participant(id, auth.uid())
);

drop policy if exists "conversations_service_role_all" on public.conversations;
create policy "conversations_service_role_all"
on public.conversations
for all
to service_role
using (true)
with check (true);

drop policy if exists "conversation_participants_participant_select" on public.conversation_participants;
create policy "conversation_participants_participant_select"
on public.conversation_participants
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_conversation_participant(conversation_id, auth.uid())
);

drop policy if exists "conversation_participants_service_role_all" on public.conversation_participants;
create policy "conversation_participants_service_role_all"
on public.conversation_participants
for all
to service_role
using (true)
with check (true);

drop policy if exists "messages_participant_select" on public.messages;
create policy "messages_participant_select"
on public.messages
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.is_conversation_participant(conversation_id, auth.uid())
);

drop policy if exists "messages_owner_update" on public.messages;
create policy "messages_owner_update"
on public.messages
for update
to authenticated
using (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "messages_service_role_all" on public.messages;
create policy "messages_service_role_all"
on public.messages
for all
to service_role
using (true)
with check (true);

drop policy if exists "message_read_status_participant_select" on public.message_read_status;
create policy "message_read_status_participant_select"
on public.message_read_status
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.messages m
    where m.id = message_id
      and public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

drop policy if exists "message_read_status_owner_insert" on public.message_read_status;
create policy "message_read_status_owner_insert"
on public.message_read_status
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "message_read_status_service_role_all" on public.message_read_status;
create policy "message_read_status_service_role_all"
on public.message_read_status
for all
to service_role
using (true)
with check (true);

drop policy if exists "message_reactions_participant_select" on public.message_reactions;
create policy "message_reactions_participant_select"
on public.message_reactions
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.messages m
    where m.id = message_id
      and public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

drop policy if exists "message_reactions_owner_insert" on public.message_reactions;
create policy "message_reactions_owner_insert"
on public.message_reactions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "message_reactions_owner_delete" on public.message_reactions;
create policy "message_reactions_owner_delete"
on public.message_reactions
for delete
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "message_reactions_service_role_all" on public.message_reactions;
create policy "message_reactions_service_role_all"
on public.message_reactions
for all
to service_role
using (true)
with check (true);

drop policy if exists "message_reports_admin_select" on public.message_reports;
create policy "message_reports_admin_select"
on public.message_reports
for select
to authenticated
using (reported_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "message_reports_participant_insert" on public.message_reports;
create policy "message_reports_participant_insert"
on public.message_reports
for insert
to authenticated
with check (reported_by = auth.uid());

drop policy if exists "message_reports_service_role_all" on public.message_reports;
create policy "message_reports_service_role_all"
on public.message_reports
for all
to service_role
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
