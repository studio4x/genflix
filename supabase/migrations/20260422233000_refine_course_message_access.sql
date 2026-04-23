begin;

create or replace function public.create_course_creator_conversation(_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_course public.courses%rowtype;
  existing_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
    into target_course
  from public.courses c
  where c.id = _course_id
  limit 1;

  if target_course.id is null or target_course.creator_id is null then
    raise exception 'Criador do curso nao encontrado.';
  end if;

  if current_user_id = target_course.creator_id then
    raise exception 'Este canal e destinado ao contato de alunos com o criador.';
  end if;

  if public.has_role(current_user_id, 'admin') = false
    and public.is_course_released(current_user_id, _course_id) = false then
    raise exception 'Voce precisa ter acesso ativo ao curso para falar com o criador.';
  end if;

  select c.id
    into existing_conversation_id
  from public.conversations c
  join public.conversation_participants cp_current
    on cp_current.conversation_id = c.id
   and cp_current.user_id = current_user_id
  join public.conversation_participants cp_creator
    on cp_creator.conversation_id = c.id
   and cp_creator.user_id = target_course.creator_id
  where c.conversation_type = 'direct'
    and coalesce(c.metadata ->> 'kind', '') = 'creator_channel'
    and c.metadata ->> 'course_id' = _course_id::text
    and (
      select count(*)
      from public.conversation_participants cp_total
      where cp_total.conversation_id = c.id
    ) = 2
  limit 1;

  if existing_conversation_id is not null then
    update public.conversations
    set
      title = 'Criador do curso - ' || target_course.title,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'kind', 'creator_channel',
        'course_id', _course_id,
        'course_title', target_course.title,
        'creator_id', target_course.creator_id
      ),
      is_archived = false,
      archived_at = null
    where id = existing_conversation_id;

    return existing_conversation_id;
  end if;

  insert into public.conversations (
    conversation_type,
    title,
    created_by,
    metadata
  )
  values (
    'direct',
    'Criador do curso - ' || target_course.title,
    current_user_id,
    jsonb_build_object(
      'kind', 'creator_channel',
      'course_id', _course_id,
      'course_title', target_course.title,
      'creator_id', target_course.creator_id
    )
  )
  returning id into existing_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role, last_read_at)
  values
    (existing_conversation_id, current_user_id, 'participant', timezone('utc', now())),
    (existing_conversation_id, target_course.creator_id, 'participant', null);

  return existing_conversation_id;
end;
$$;

create or replace function public.sync_course_message_access(_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_conversation_id uuid;
begin
  if _course_id is null then
    return;
  end if;

  room_conversation_id := public.ensure_course_room_conversation(_course_id);

  if room_conversation_id is null then
    return;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role, last_read_at)
  select
    room_conversation_id,
    released.user_id,
    'participant',
    null
  from public.list_course_message_user_ids(_course_id) released
  on conflict (conversation_id, user_id) do nothing;

  delete from public.conversation_participants cp
  where cp.conversation_id = room_conversation_id
    and not exists (
      select 1
      from public.list_course_message_user_ids(_course_id) released
      where released.user_id = cp.user_id
    );
end;
$$;

drop function if exists public.list_user_conversations(integer);
create function public.list_user_conversations(_limit integer default 50)
returns table (
  conversation_id uuid,
  conversation_type text,
  title text,
  metadata jsonb,
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
  current_user_is_admin boolean := public.has_role(current_user_id, 'admin');
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
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
      and c.metadata ? 'course_id'
      and exists (
        select 1
        from public.course_releases cr
        where cr.course_id = (c.metadata ->> 'course_id')::uuid
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

grant execute on function public.create_course_creator_conversation(uuid) to authenticated, service_role;
grant execute on function public.list_user_conversations(integer) to authenticated, service_role;

commit;
