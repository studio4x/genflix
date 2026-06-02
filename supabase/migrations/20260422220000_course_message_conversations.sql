begin;

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
  current_user_is_admin boolean := public.has_role(current_user_id, 'admin');
begin
  if current_user_id is null then
    raise exception 'Usurio n?o autenticado.';
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
    and (
      current_user_is_admin
      or not exists (
        select 1
        from public.user_roles admin_ur
        join public.roles admin_role on admin_role.id = admin_ur.role_id
        where admin_ur.user_id = p.id
          and admin_role.code = 'admin'
      )
    )
  group by p.id, p.email, p.full_name
  order by coalesce(nullif(p.full_name, ''), p.email)
  limit safe_limit;
end;
$$;

create or replace function public.ensure_pair_direct_conversation(_user_a uuid, _user_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_conversation_id uuid;
begin
  if _user_a is null or _user_b is null or _user_a = _user_b then
    return null;
  end if;

  if not exists (select 1 from public.profiles where id = _user_a) then
    return null;
  end if;

  if not exists (select 1 from public.profiles where id = _user_b) then
    return null;
  end if;

  select cp1.conversation_id
    into existing_conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp2.conversation_id = cp1.conversation_id
   and cp2.user_id = _user_b
  join public.conversations c
    on c.id = cp1.conversation_id
   and c.conversation_type = 'direct'
  where cp1.user_id = _user_a
    and (
      select count(*)
      from public.conversation_participants cp
      where cp.conversation_id = cp1.conversation_id
    ) = 2
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (conversation_type, created_by)
    values ('direct', _user_a)
    returning id into existing_conversation_id;

    insert into public.conversation_participants (conversation_id, user_id, role, last_read_at)
    values
      (existing_conversation_id, _user_a, 'participant', timezone('utc', now())),
      (existing_conversation_id, _user_b, 'participant', null);
  else
    update public.conversations
    set
      is_archived = false,
      archived_at = null
    where id = existing_conversation_id;
  end if;

  return existing_conversation_id;
end;
$$;

create or replace function public.ensure_creator_direct_conversation(_student_id uuid, _creator_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
begin
  conversation_id := public.ensure_pair_direct_conversation(_student_id, _creator_id);

  if conversation_id is null then
    return null;
  end if;

  update public.conversations
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'kind', 'creator_channel',
    'creator_id', _creator_id
  )
  where id = conversation_id;

  return conversation_id;
end;
$$;

create or replace function public.list_course_message_user_ids(_course_id uuid)
returns table (
  user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with direct_releases as (
    select cr.user_id
    from public.course_releases cr
    where cr.course_id = _course_id
      and cr.release_type = 'user'
      and cr.user_id is not null
      and cr.is_active = true
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
  ),
  group_releases as (
    select agm.user_id
    from public.course_releases cr
    join public.access_group_members agm on agm.group_id = cr.group_id
    where cr.course_id = _course_id
      and cr.release_type = 'group'
      and cr.group_id is not null
      and cr.is_active = true
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
  )
  select distinct released.user_id
  from (
    select user_id from direct_releases
    union all
    select user_id from group_releases
  ) as released
  where released.user_id is not null;
$$;

create or replace function public.ensure_course_room_conversation(_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_conversation_id uuid;
  course_title text;
begin
  select c.title
    into course_title
  from public.courses c
  where c.id = _course_id
  limit 1;

  if course_title is null then
    return null;
  end if;

  select c.id
    into existing_conversation_id
  from public.conversations c
  where c.conversation_type = 'group'
    and coalesce(c.metadata ->> 'kind', '') = 'course_room'
    and c.metadata ->> 'course_id' = _course_id::text
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (
      conversation_type,
      title,
      metadata
    )
    values (
      'group',
      course_title,
      jsonb_build_object(
        'kind', 'course_room',
        'course_id', _course_id,
        'course_title', course_title
      )
    )
    returning id into existing_conversation_id;
  else
    update public.conversations
    set
      title = course_title,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'kind', 'course_room',
        'course_id', _course_id,
        'course_title', course_title
      ),
      is_archived = false,
      archived_at = null
    where id = existing_conversation_id;
  end if;

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
  course_creator_id uuid;
  released_user_id uuid;
begin
  if _course_id is null then
    return;
  end if;

  select c.creator_id
    into course_creator_id
  from public.courses c
  where c.id = _course_id
  limit 1;

  room_conversation_id := public.ensure_course_room_conversation(_course_id);

  if room_conversation_id is not null then
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
  end if;

  if course_creator_id is not null then
    for released_user_id in
      select released.user_id
      from public.list_course_message_user_ids(_course_id) released
    loop
      if released_user_id is distinct from course_creator_id then
        perform public.ensure_creator_direct_conversation(released_user_id, course_creator_id);
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.sync_course_message_access_for_group(_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
begin
  if _group_id is null then
    return;
  end if;

  for target_course_id in
    select distinct cr.course_id
    from public.course_releases cr
    where cr.release_type = 'group'
      and cr.group_id = _group_id
  loop
    perform public.sync_course_message_access(target_course_id);
  end loop;
end;
$$;

create or replace function public.handle_course_release_message_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_course_message_access(old.course_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then
    perform public.sync_course_message_access(old.course_id);
  end if;

  perform public.sync_course_message_access(new.course_id);
  return new;
end;
$$;

create or replace function public.handle_access_group_members_message_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_course_message_access_for_group(old.group_id);
    return old;
  end if;

  perform public.sync_course_message_access_for_group(new.group_id);
  return new;
end;
$$;

create or replace function public.handle_course_message_metadata_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.sync_course_message_access(new.id);
    return new;
  end if;

  if new.title is distinct from old.title
    or new.creator_id is distinct from old.creator_id then
    perform public.sync_course_message_access(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_course_release_messages on public.course_releases;
create trigger sync_course_release_messages
after insert or update or delete on public.course_releases
for each row
execute procedure public.handle_course_release_message_sync();

drop trigger if exists sync_access_group_member_messages on public.access_group_members;
create trigger sync_access_group_member_messages
after insert or update or delete on public.access_group_members
for each row
execute procedure public.handle_access_group_members_message_sync();

drop trigger if exists sync_course_message_metadata on public.courses;
create trigger sync_course_message_metadata
after insert or update of title, creator_id on public.courses
for each row
execute procedure public.handle_course_message_metadata_sync();

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
begin
  if current_user_id is null then
    raise exception 'Usurio n?o autenticado.';
  end if;

  return query
  select
    c.id,
    c.conversation_type,
    c.title::text,
    c.metadata,
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

grant execute on function public.ensure_pair_direct_conversation(uuid, uuid) to service_role;
grant execute on function public.ensure_creator_direct_conversation(uuid, uuid) to service_role;
grant execute on function public.list_course_message_user_ids(uuid) to service_role;
grant execute on function public.ensure_course_room_conversation(uuid) to service_role;
grant execute on function public.sync_course_message_access(uuid) to service_role;
grant execute on function public.sync_course_message_access_for_group(uuid) to service_role;
grant execute on function public.list_user_conversations(integer) to authenticated, service_role;
grant execute on function public.search_message_recipients(text, integer) to authenticated, service_role;

do $$
declare
  target_course_id uuid;
begin
  for target_course_id in
    select c.id
    from public.courses c
    where c.creator_id is not null
       or exists (
         select 1
         from public.course_releases cr
         where cr.course_id = c.id
       )
  loop
    perform public.sync_course_message_access(target_course_id);
  end loop;
end $$;

commit;
