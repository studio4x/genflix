begin;

create or replace function public.course_review_needs_moderation(_title text, _content text)
returns boolean
language plpgsql
immutable
as $$
declare
  merged_content text := coalesce(_title, '') || ' ' || coalesce(_content, '');
  link_count integer;
begin
  link_count := array_length(regexp_split_to_array(lower(merged_content), 'https://'), 1) - 1;

  return
    merged_content ~* '(viagra|casino|crypto|aposta|bet|golpe)'
    or coalesce(link_count, 0) > 1
    or (
      char_length(trim(merged_content)) >= 20
      and trim(merged_content) = upper(trim(merged_content))
    )
    or merged_content ~ '(.)\1{4,}';
end;
$$;

create or replace function public.submit_course_review(
  _course_id uuid,
  _rating integer,
  _title text,
  _content text
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  profile_record public.profiles%rowtype;
  course_exists boolean;
  verified_purchase boolean;
  existing_review public.reviews%rowtype;
  saved_review public.reviews%rowtype;
  normalized_title text := trim(coalesce(_title, ''));
  normalized_content text := trim(coalesce(_content, ''));
  next_status text;
  admin_record record;
begin
  if current_user_id is null then
    raise exception 'Faça login para avaliar este curso.';
  end if;

  if _rating < 1 or _rating > 5 then
    raise exception 'A nota deve est?r entre 1 e 5.';
  end if;

  if char_length(normalized_title) < 3 or char_length(normalized_title) > 100 then
    raise exception 'O título deve ter entre 3 e 100 caracteres.';
  end if;

  if char_length(normalized_content) < 3 or char_length(normalized_content) > 3000 then
    raise exception 'O comentário deve ter entre 3 e 3000 caracteres.';
  end if;

  select exists (
    select 1
    from public.courses c
    where c.id = _course_id
      and c.status = 'published'
      and coalesce(c.is_public, false)
  )
  into course_exists;

  if not course_exists then
    raise exception 'Curso indisponível para avaliação.';
  end if;

  select exists (
    select 1
    from public.course_releases cr
    where cr.course_id = _course_id
      and cr.user_id = current_user_id
      and cr.is_active
      and coalesce(cr.release_status, 'active') = 'active'
      and cr.revoked_at is null
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
  )
  into verified_purchase;

  if not verified_purchase then
    raise exception 'Apenas alunos com acesso ativo ao curso podem avaliá-lo.';
  end if;

  select *
    into profile_record
  from public.profiles
  where id = current_user_id
  limit 1;

  next_status := case
    when public.course_review_needs_moderation(normalized_title, normalized_content) then 'pending'
    else 'approved'
  end;

  select *
    into existing_review
  from public.reviews r
  where r.author_id = current_user_id
    and r.target_type = 'course'
    and r.target_resource_id = _course_id
    and r.deleted_at is null
  limit 1;

  if existing_review.id is null then
    insert into public.reviews (
      author_id,
      author_display_name,
      target_type,
      target_resource_id,
      rating,
      title,
      content,
      is_verified_purchase,
      moderation_status,
      is_moderated,
      moderation_reason
    )
    values (
      current_user_id,
      coalesce(nullif(profile_record.full_name, ''), profile_record.email, 'Aluno GenFlix'),
      'course',
      _course_id,
      _rating,
      normalized_title,
      normalized_content,
      verified_purchase,
      next_status,
      next_status = 'approved',
      null
    )
    returning * into saved_review;
  else
    update public.reviews
    set
      author_display_name = coalesce(nullif(profile_record.full_name, ''), profile_record.email, author_display_name, 'Aluno GenFlix'),
      rating = _rating,
      title = normalized_title,
      content = normalized_content,
      is_verified_purchase = verified_purchase,
      moderation_status = next_status,
      is_moderated = next_status = 'approved',
      moderation_reason = null
    where id = existing_review.id
    returning * into saved_review;
  end if;

  if next_status = 'pending' then
    for admin_record in
      select p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      join public.roles r on r.id = ur.role_id
      where r.code = 'admin'
    loop
      perform public.create_user_notification(
        admin_record.id,
        'N?ova avaliação aguardando moderação',
        left(normalized_title || ' — ' || normalized_content, 240),
        'review',
        'normal',
        '/admin/reviews',
        array['in-app'],
        jsonb_build_object('review_id', saved_review.id, 'course_id', _course_id)
      );
    end loop;
  end if;

  return saved_review;
end;
$$;

create or replace function public.list_admin_course_reviews(
  _status text default 'pending',
  _rating integer default null,
  _query text default '',
  _limit integer default 100
)
returns table (
  id uuid,
  author_id uuid,
  author_display_name text,
  author_email text,
  course_id uuid,
  course_title text,
  rating integer,
  title text,
  content text,
  is_verified_purchase boolean,
  moderation_status text,
  moderation_reason text,
  helpful_count integer,
  unhelpful_count integer,
  created_at timest?mptz,
  updated_at timest?mptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := coalesce(nullif(trim(_status), ''), 'pending');
  normalized_query text := '%' || lower(trim(coalesce(_query, ''))) || '%';
  safe_limit integer := least(greatest(coalesce(_limit, 100), 1), 200);
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    rv.id,
    rv.author_id,
    rv.author_display_name,
    author_profile.email as author_email,
    rv.target_resource_id as course_id,
    c.title as course_title,
    rv.rating,
    rv.title::text,
    rv.content,
    rv.is_verified_purchase,
    rv.moderation_status,
    rv.moderation_reason::text,
    rv.helpful_count,
    rv.unhelpful_count,
    rv.created_at,
    rv.updated_at
  from public.reviews rv
  left join public.profiles author_profile on author_profile.id = rv.author_id
  left join public.courses c on c.id = rv.target_resource_id
  where rv.target_type = 'course'
    and rv.deleted_at is null
    and (normalized_status = 'all' or rv.moderation_status = normalized_status)
    and (_rating is null or rv.rating = _rating)
    and (
      trim(coalesce(_query, '')) = ''
      or lower(coalesce(rv.title, '')) like normalized_query
      or lower(coalesce(rv.content, '')) like normalized_query
      or lower(coalesce(rv.author_display_name, '')) like normalized_query
      or lower(coalesce(author_profile.email, '')) like normalized_query
      or lower(coalesce(c.title, '')) like normalized_query
    )
  order by
    case when rv.moderation_status = 'pending' then 0 else 1 end,
    rv.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.moderate_course_review(
  _review_id uuid,
  _action text,
  _reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  review_record public.reviews%rowtype;
  normalized_action text := lower(trim(coalesce(_action, '')));
  next_status text;
  normalized_reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_action not in ('approve', 'reject') then
    raise exception 'Ação de moderação inválida.';
  end if;

  select *
    into review_record
  from public.reviews
  where id = _review_id
    and target_type = 'course'
    and deleted_at is null;

  if review_record.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  next_status := case when normalized_action = 'approve' then 'approved' else 'rejected' end;

  update public.reviews
  set
    moderation_status = next_status,
    is_moderated = true,
    moderation_reason = case when next_status = 'rejected' then normalized_reason else null end
  where id = _review_id;

  insert into public.review_moderation_reports (
    review_id,
    reason,
    description,
    reported_by,
    moderated_by,
    status,
    action,
    resolved_at
  )
  values (
    _review_id,
    case when next_status = 'approved' then 'other' else 'inappropriate' end,
    normalized_reason,
    current_user_id,
    current_user_id,
    'resolved',
    normalized_action,
    timezone('utc', now())
  );

  perform public.create_user_notification(
    review_record.author_id,
    case when next_status = 'approved' then 'Sua avaliação foi aprovada' else 'Sua avaliação foi rejeitada' end,
    case
      when next_status = 'approved' then 'Sua avaliação já está visível na página pública do curso.'
      else coalesce(normalized_reason, 'A avaliação não atende às diretrizes da GenFlix.')
    end,
    'review',
    'normal',
    '/cursos',
    array['in-app'],
    jsonb_build_object('review_id', _review_id, 'status', next_status)
  );
end;
$$;

grant execute on function public.course_review_needs_moderation(text, text) to authenticated, service_role;
grant execute on function public.submit_course_review(uuid, integer, text, text) to authenticated;
grant execute on function public.list_admin_course_reviews(text, integer, text, integer) to authenticated, service_role;
grant execute on function public.moderate_course_review(uuid, text, text) to authenticated, service_role;

commit;
