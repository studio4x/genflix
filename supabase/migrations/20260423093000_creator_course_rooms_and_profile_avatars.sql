begin;

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_public_select" on storage.objects;
create policy "profile_avatars_public_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists "profile_avatars_authenticated_insert" on storage.objects;
create policy "profile_avatars_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name like ('avatars/' || auth.uid()::text || '/%')
);

drop policy if exists "profile_avatars_authenticated_update" on storage.objects;
create policy "profile_avatars_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name like ('avatars/' || auth.uid()::text || '/%')
)
with check (
  bucket_id = 'profile-avatars'
  and name like ('avatars/' || auth.uid()::text || '/%')
);

drop policy if exists "profile_avatars_authenticated_delete" on storage.objects;
create policy "profile_avatars_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name like ('avatars/' || auth.uid()::text || '/%')
);

create or replace function public.can_monitor_course_room(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations conv
    join public.courses course_record
      on course_record.id = (conv.metadata ->> 'course_id')::uuid
    where conv.id = _conversation_id
      and coalesce(conv.metadata ->> 'kind', '') = 'course_room'
      and course_record.creator_id = _user_id
  );
$$;

drop function if exists public.list_user_conversations(integer);
create function public.list_user_conversations(_limit integer default 50)
returns table (
  conversation_id uuid,
  conversation_type text,
  title text,
  metadata jsonb,
  last_message_at timest?mptz,
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
  current_user_is_admin boolean := public.has_role(current_user_id, 'admin');
begin
  if current_user_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  return query
  with accessible_conversations as (
    select
      cp.conversation_id,
      cp.unread_count,
      0 as access_priority
    from public.conversation_participants cp
    where cp.user_id = current_user_id

    union

    select
      c.id as conversation_id,
      0 as unread_count,
      1 as access_priority
    from public.conversations c
    where current_user_is_admin
      and c.conversation_type = 'group'
      and not c.is_archived
      and coalesce(c.metadata ->> 'kind', '') = 'course_room'
      and c.metadata  'course_id'
      and exists (
        select 1
        from public.course_releases cr
        where cr.course_id = (c.metadata ->> 'course_id')::uuid
          and cr.is_active = true
          and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
          and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      )

    union

    select
      c.id as conversation_id,
      0 as unread_count,
      1 as access_priority
    from public.conversations c
    join public.courses course_record
      on course_record.id = (c.metadata ->> 'course_id')::uuid
    where c.conversation_type = 'group'
      and not c.is_archived
      and coalesce(c.metadata ->> 'kind', '') = 'course_room'
      and c.metadata  'course_id'
      and course_record.creator_id = current_user_id
      and exists (
        select 1
        from public.course_releases cr
        where cr.course_id = course_record.id
          and cr.is_active = true
          and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
          and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      )
  ),
  deduplicated_access as (
    select
      ac.conversation_id,
      max(ac.unread_count) as unread_count,
      min(ac.access_priority) as access_priority
    from accessible_conversations ac
    group by ac.conversation_id
  )
  select
    c.id,
    c.conversation_type,
    c.title::text,
    c.metadata,
    c.last_message_at,
    c.last_message_preview,
    c.message_count,
    da.unread_count,
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
  from deduplicated_access da
  join public.conversations c on c.id = da.conversation_id
  where not c.is_archived
  order by da.access_priority asc, c.last_message_at desc nulls last, c.created_at desc
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
  created_at timest?mptz,
  updated_at timest?mptz
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
    raise exception 'Usurio n?o autenticado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false
    and public.has_role(current_user_id, 'admin') = false
    and public.can_monitor_course_room(_conversation_id, current_user_id) = false then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    coalesce(nullif(p.full_name, ''), p.email, 'Usurio GenFlix') as sender_name,
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
    raise exception 'Usurio n?o autenticado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false
    and public.has_role(current_user_id, 'admin') = false
    and public.can_monitor_course_room(_conversation_id, current_user_id) = false then
    raise exception 'Acesso negado.';
  end if;

  if public.is_conversation_participant(_conversation_id, current_user_id) = false then
    return 0;
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

grant execute on function public.can_monitor_course_room(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_user_conversations(integer) to authenticated, service_role;
grant execute on function public.list_conversation_messages(uuid, integer) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

commit;
