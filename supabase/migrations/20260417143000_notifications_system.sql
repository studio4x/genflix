begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title varchar(200) not null,
  body text not null,
  action_url text,
  category text not null default 'system',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  is_actionable boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  read_at timest?mptz,
  read_by_channels jsonb not null default '[]'::jsonb,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  quiet_hours_timezone text not null default 'America/Sao_Paulo',
  email_digest text not null default 'immediate' check (email_digest in ('immediate', 'daily', 'weekly', 'never')),
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute procedure public.set_updated_at();

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'whatsapp', 'in-app')),
  title varchar(200) not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'retry', 'sent', 'delivered', 'failed', 'bounced', 'ignored')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timest?mptz,
  next_retry_at timest?mptz not null default timezone('utc', now()),
  final_error text,
  provider_message_id text,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create index if not exists notification_queue_status_retry_idx
  on public.notification_queue (status, next_retry_at, created_at);

create index if not exists notification_queue_user_channel_idx
  on public.notification_queue (user_id, channel, created_at desc);

drop trigger if exists set_notification_queue_updated_at on public.notification_queue;
create trigger set_notification_queue_updated_at
before update on public.notification_queue
for each row
execute procedure public.set_updated_at();

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.notification_queue (id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'whatsapp', 'in-app')),
  attempt_number integer not null default 1,
  status text not null check (status in ('success', 'failure', 'ignored')),
  error_message text,
  response_status_code integer,
  retry_attempt integer,
  delivered_at timest?mptz,
  created_at timest?mptz not null default timezone('utc', now())
);

create index if not exists notification_delivery_logs_queue_idx
  on public.notification_delivery_logs (queue_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_queue enable row level security;
alter table public.notification_delivery_logs enable row level security;

drop policy if exists "notifications_owner_select" on public.notifications;
create policy "notifications_owner_select"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update"
on public.notifications
for update
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "notifications_service_role_all" on public.notifications;
create policy "notifications_service_role_all"
on public.notifications
for all
to service_role
using (true)
with check (true);

drop policy if exists "notification_preferences_owner_select" on public.notification_preferences;
create policy "notification_preferences_owner_select"
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_preferences_owner_insert" on public.notification_preferences;
create policy "notification_preferences_owner_insert"
on public.notification_preferences
for insert
to authenticated
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_preferences_owner_update" on public.notification_preferences;
create policy "notification_preferences_owner_update"
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_preferences_service_role_all" on public.notification_preferences;
create policy "notification_preferences_service_role_all"
on public.notification_preferences
for all
to service_role
using (true)
with check (true);

drop policy if exists "notification_queue_admin_select" on public.notification_queue;
create policy "notification_queue_admin_select"
on public.notification_queue
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_queue_service_role_all" on public.notification_queue;
create policy "notification_queue_service_role_all"
on public.notification_queue
for all
to service_role
using (true)
with check (true);

drop policy if exists "notification_delivery_logs_admin_select" on public.notification_delivery_logs;
create policy "notification_delivery_logs_admin_select"
on public.notification_delivery_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notification_delivery_logs_service_role_all" on public.notification_delivery_logs;
create policy "notification_delivery_logs_service_role_all"
on public.notification_delivery_logs
for all
to service_role
using (true)
with check (true);

grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_queue to authenticated;
grant select on public.notification_delivery_logs to authenticated;
grant all on public.notifications to service_role;
grant all on public.notification_preferences to service_role;
grant all on public.notification_queue to service_role;
grant all on public.notification_delivery_logs to service_role;

create or replace function public.create_user_notification(
  _user_id uuid,
  _title text,
  _body text,
  _category text default 'system',
  _priority text default 'normal',
  _action_url text default null,
  _channels text[] default array['in-app'],
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_title text := trim(coalesce(_title, ''));
  normalized_body text := trim(coalesce(_body, ''));
  normalized_category text := nullif(trim(coalesce(_category, 'system')), '');
  normalized_priority text := coalesce(nullif(trim(_priority), ''), 'normal');
  notification_record public.notifications%rowtype;
  channel_name text;
  normalized_channels text[] := coalesce(_channels, array['in-app']);
begin
  if current_user_id is null and current_setting('role', true) <> 'service_role' then
    raise exception 'Usuário não autenticado.';
  end if;

  if current_setting('role', true) <> 'service_role'
    and current_user_id is distinct from _user_id
    and public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_title = '' or char_length(normalized_title) > 200 then
    raise exception 'O título da notificação deve ter entre 1 e 200 caracteres.';
  end if;

  if normalized_body = '' then
    raise exception 'A mensagem da notificação é obrigatória.';
  end if;

  if normalized_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Prioridade inválida.';
  end if;

  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Usuário de destino não encontrado.';
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
    coalesce(normalized_category, 'system'),
    normalized_priority,
    _action_url is not null,
    coalesce(_metadata, '{}'::jsonb)
  )
  returning * into notification_record;

  foreach channel_name in array normalized_channels loop
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
        notification_record.id,
        _user_id,
        channel_name,
        normalized_title,
        normalized_body,
        jsonb_build_object(
          'action_url', _action_url,
          'category', coalesce(normalized_category, 'system'),
          'priority', normalized_priority,
          'metadata', coalesce(_metadata, '{}'::jsonb)
        ),
        case when channel_name = 'in-app' then 'sent' else 'pending' end,
        case when channel_name = 'in-app' then 1 else 0 end,
        case when channel_name = 'in-app' then timezone('utc', now()) else null end
      );
    end if;
  end loop;

  return notification_record.id;
end;
$$;

create or replace function public.admin_send_broadcast_notification(
  _title text,
  _body text,
  _category text default 'system',
  _priority text default 'normal',
  _action_url text default null,
  _role_codes text[] default null,
  _channels text[] default array['in-app']
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  recipient_record record;
  recipient_count integer := 0;
  queued_count integer := 0;
  notification_id uuid;
  normalized_roles text[] := coalesce(_role_codes, array[]::text[]);
  normalized_channels text[] := coalesce(_channels, array['in-app']);
begin
  if current_user_id is null or public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  for recipient_record in
    select distinct p.id
    from public.profiles p
    where cardinality(normalized_roles) = 0
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p.id
          and r.code = any(normalized_roles)
      )
  loop
    notification_id := public.create_user_notification(
      recipient_record.id,
      _title,
      _body,
      _category,
      _priority,
      _action_url,
      normalized_channels,
      jsonb_build_object('broadcast', true, 'sent_by', current_user_id)
    );

    recipient_count := recipient_count + 1;
    queued_count := queued_count + cardinality(normalized_channels);
  end loop;

  return jsonb_build_object(
    'recipient_count', recipient_count,
    'queued_count', queued_count
  );
end;
$$;

create or replace function public.mark_notification_read(_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_notification public.notifications%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.notifications n
  set
    read_at = coalesce(read_at, timezone('utc', now())),
    read_by_channels = case
      when read_by_channels  'in-app' then read_by_channels
      else read_by_channels || '["in-app"]'::jsonb
    end
  where n.id = _notification_id
    and (n.user_id = current_user_id or public.has_role(current_user_id, 'admin'))
  returning * into saved_notification;

  if saved_notification.id is null then
    raise exception 'N?otificação não encontrada.';
  end if;

  return saved_notification;
end;
$$;

create or replace function public.mark_all_notifications_read()
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

  update public.notifications
  set
    read_at = coalesce(read_at, timezone('utc', now())),
    read_by_channels = case
      when read_by_channels  'in-app' then read_by_channels
      else read_by_channels || '["in-app"]'::jsonb
    end
  where user_id = current_user_id
    and read_at is null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.create_user_notification(uuid, text, text, text, text, text, text[], jsonb) to authenticated, service_role;
grant execute on function public.admin_send_broadcast_notification(text, text, text, text, text, text[], text[]) to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
