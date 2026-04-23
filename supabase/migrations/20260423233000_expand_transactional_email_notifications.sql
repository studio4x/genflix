begin;

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
    raise exception 'Faca login para avaliar este curso.';
  end if;

  if _rating < 1 or _rating > 5 then
    raise exception 'A nota deve estar entre 1 e 5.';
  end if;

  if char_length(normalized_title) < 3 or char_length(normalized_title) > 100 then
    raise exception 'O titulo deve ter entre 3 e 100 caracteres.';
  end if;

  if char_length(normalized_content) < 3 or char_length(normalized_content) > 3000 then
    raise exception 'O comentario deve ter entre 3 e 3000 caracteres.';
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
    raise exception 'Curso indisponivel para avaliacao.';
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
    raise exception 'Apenas alunos com acesso ativo ao curso podem avalia-lo.';
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
        'Nova avaliacao aguardando moderacao',
        left(normalized_title || ' - ' || normalized_content, 240),
        'review',
        'normal',
        '/admin/reviews',
        array['in-app', 'email'],
        jsonb_build_object('review_id', saved_review.id, 'course_id', _course_id)
      );
    end loop;
  end if;

  return saved_review;
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
    raise exception 'Usuario nao autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_action not in ('approve', 'reject') then
    raise exception 'Acao de moderacao invalida.';
  end if;

  select *
    into review_record
  from public.reviews
  where id = _review_id
    and target_type = 'course'
    and deleted_at is null;

  if review_record.id is null then
    raise exception 'Avaliacao nao encontrada.';
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
    case when next_status = 'approved' then 'Sua avaliacao foi aprovada' else 'Sua avaliacao foi rejeitada' end,
    case
      when next_status = 'approved' then 'Sua avaliacao ja esta visivel na pagina publica do curso.'
      else coalesce(normalized_reason, 'A avaliacao nao atende as diretrizes da GenFlix.')
    end,
    'review',
    'normal',
    '/cursos',
    array['in-app', 'email'],
    jsonb_build_object('review_id', _review_id, 'status', next_status)
  );
end;
$$;

grant execute on function public.submit_course_review(uuid, integer, text, text) to authenticated;
grant execute on function public.moderate_course_review(uuid, text, text) to authenticated, service_role;

commit;

