begin;

create table if not exists public.blog_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  post_title text,
  author_user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  content text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_reason text,
  admin_response text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists blog_post_comments_post_slug_status_idx
  on public.blog_post_comments (post_slug, moderation_status, created_at desc);

create index if not exists blog_post_comments_status_created_idx
  on public.blog_post_comments (moderation_status, created_at desc);

create index if not exists blog_post_comments_email_idx
  on public.blog_post_comments (lower(email));

create trigger set_blog_post_comments_updated_at
before update on public.blog_post_comments
for each row execute procedure public.set_updated_at();

alter table public.blog_post_comments enable row level security;

drop policy if exists "blog_post_comments_public_read_approved" on public.blog_post_comments;
create policy "blog_post_comments_public_read_approved"
on public.blog_post_comments
for select
to anon, authenticated
using (moderation_status = 'approved');

drop policy if exists "blog_post_comments_insert_public" on public.blog_post_comments;
create policy "blog_post_comments_insert_public"
on public.blog_post_comments
for insert
to anon, authenticated
with check (
  char_length(trim(coalesce(first_name, ''))) between 2 and 80
  and char_length(trim(coalesce(last_name, ''))) between 2 and 80
  and char_length(trim(coalesce(email, ''))) between 5 and 320
  and position('@' in email) > 1
  and char_length(trim(coalesce(content, ''))) between 3 and 3000
  and moderation_status = 'pending'
);

drop policy if exists "blog_post_comments_admin_all" on public.blog_post_comments;
create policy "blog_post_comments_admin_all"
on public.blog_post_comments
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "blog_post_comments_service_role_all" on public.blog_post_comments;
create policy "blog_post_comments_service_role_all"
on public.blog_post_comments
for all
to service_role
using (true)
with check (true);

create or replace function public.notify_admins_new_blog_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  body_preview text;
begin
  if new.moderation_status <> 'pending' then
    return new;
  end if;

  body_preview := left(new.first_name || ' ' || new.last_name || ' comentou em /blog/' || new.post_slug, 240);

  for admin_record in
    select p.id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.code = 'admin'
  loop
    perform public.create_user_notification(
      admin_record.id,
      'Novo comentário aguardando aprovação',
      body_preview,
      'blog',
      'normal',
      '/admin/blog?tab=comments',
      array['in-app'],
      jsonb_build_object('blog_comment_id', new.id, 'post_slug', new.post_slug)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trigger_notify_admins_new_blog_comment on public.blog_post_comments;
create trigger trigger_notify_admins_new_blog_comment
after insert on public.blog_post_comments
for each row
execute function public.notify_admins_new_blog_comment();

create or replace function public.submit_blog_comment(
  _post_slug text,
  _post_title text,
  _first_name text,
  _last_name text,
  _email text,
  _content text
)
returns public.blog_post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_post_slug text := trim(coalesce(_post_slug, ''));
  normalized_post_title text := nullif(trim(coalesce(_post_title, '')), '');
  normalized_first_name text := trim(coalesce(_first_name, ''));
  normalized_last_name text := trim(coalesce(_last_name, ''));
  normalized_email text := lower(trim(coalesce(_email, '')));
  normalized_content text := trim(coalesce(_content, ''));
  saved_comment public.blog_post_comments%rowtype;
begin
  if normalized_post_slug = '' then
    raise exception 'O artigo é obrigatório.';
  end if;

  if char_length(normalized_first_name) < 2 or char_length(normalized_first_name) > 80 then
    raise exception 'O nome deve ter entre 2 e 80 caracteres.';
  end if;

  if char_length(normalized_last_name) < 2 or char_length(normalized_last_name) > 80 then
    raise exception 'O sobrenome deve ter entre 2 e 80 caracteres.';
  end if;

  if normalized_email = '' or position('@' in normalized_email) <= 1 then
    raise exception 'Informe um e-mail válido.';
  end if;

  if char_length(normalized_content) < 3 or char_length(normalized_content) > 3000 then
    raise exception 'O comentário deve ter entre 3 e 3000 caracteres.';
  end if;

  insert into public.blog_post_comments (
    post_slug,
    post_title,
    author_user_id,
    first_name,
    last_name,
    email,
    content,
    moderation_status
  )
  values (
    normalized_post_slug,
    normalized_post_title,
    current_user_id,
    normalized_first_name,
    normalized_last_name,
    normalized_email,
    normalized_content,
    'pending'
  )
  returning * into saved_comment;

  return saved_comment;
end;
$$;

create or replace function public.list_admin_blog_comments(
  _status text default 'pending',
  _post_slug text default null,
  _query text default '',
  _limit integer default 200
)
returns table (
  id uuid,
  post_slug text,
  post_title text,
  author_user_id uuid,
  first_name text,
  last_name text,
  email text,
  content text,
  moderation_status text,
  moderation_reason text,
  admin_response text,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := lower(coalesce(nullif(trim(_status), ''), 'pending'));
  normalized_post_slug text := nullif(trim(coalesce(_post_slug, '')), '');
  normalized_query text := '%' || lower(trim(coalesce(_query, ''))) || '%';
  safe_limit integer := least(greatest(coalesce(_limit, 200), 1), 500);
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    c.id,
    c.post_slug,
    c.post_title,
    c.author_user_id,
    c.first_name,
    c.last_name,
    c.email,
    c.content,
    c.moderation_status,
    c.moderation_reason,
    c.admin_response,
    c.approved_at,
    c.approved_by,
    c.created_at,
    c.updated_at
  from public.blog_post_comments c
  where (normalized_status = 'all' or c.moderation_status = normalized_status)
    and (normalized_post_slug is null or c.post_slug = normalized_post_slug)
    and (
      trim(coalesce(_query, '')) = ''
      or lower(c.post_slug) like normalized_query
      or lower(coalesce(c.post_title, '')) like normalized_query
      or lower(c.first_name || ' ' || c.last_name) like normalized_query
      or lower(c.email) like normalized_query
      or lower(c.content) like normalized_query
    )
  order by
    case when c.moderation_status = 'pending' then 0 else 1 end,
    c.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.moderate_blog_comment(
  _comment_id uuid,
  _action text,
  _reason text default null,
  _admin_response text default null
)
returns public.blog_post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_action text := lower(trim(coalesce(_action, '')));
  normalized_reason text := nullif(trim(coalesce(_reason, '')), '');
  normalized_response text := nullif(trim(coalesce(_admin_response, '')), '');
  next_status text;
  saved public.blog_post_comments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_action not in ('approve', 'reject') then
    raise exception 'Ação inválida.';
  end if;

  next_status := case when normalized_action = 'approve' then 'approved' else 'rejected' end;

  update public.blog_post_comments
  set
    moderation_status = next_status,
    moderation_reason = case when next_status = 'rejected' then normalized_reason else null end,
    admin_response = coalesce(normalized_response, admin_response),
    approved_at = case when next_status = 'approved' then timezone('utc', now()) else null end,
    approved_by = case when next_status = 'approved' then current_user_id else null end
  where id = _comment_id
  returning * into saved;

  if saved.id is null then
    raise exception 'Comentário não encontrado.';
  end if;

  return saved;
end;
$$;

create or replace function public.reply_blog_comment(
  _comment_id uuid,
  _response text
)
returns public.blog_post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_response text := nullif(trim(coalesce(_response, '')), '');
  saved public.blog_post_comments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if public.has_role(current_user_id, 'admin') = false then
    raise exception 'Acesso negado.';
  end if;

  if normalized_response is null then
    raise exception 'A resposta do administrador é obrigatória.';
  end if;

  update public.blog_post_comments
  set admin_response = normalized_response
  where id = _comment_id
  returning * into saved;

  if saved.id is null then
    raise exception 'Comentário não encontrado.';
  end if;

  return saved;
end;
$$;

grant select, insert on public.blog_post_comments to anon, authenticated;
grant update, delete on public.blog_post_comments to authenticated;
grant all on public.blog_post_comments to service_role;
grant execute on function public.submit_blog_comment(text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.list_admin_blog_comments(text, text, text, integer) to authenticated, service_role;
grant execute on function public.moderate_blog_comment(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.reply_blog_comment(uuid, text) to authenticated, service_role;

commit;

