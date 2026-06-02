begin;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text,
  target_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('professional', 'company', 'product', 'course', 'seller')),
  target_resource_id uuid,
  rating integer not null check (rating >= 1 and rating <= 5),
  title varchar(100) not null,
  content text not null check (char_length(content) <= 3000),
  is_verified_purchase boolean not null default false,
  is_moderated boolean not null default false,
  moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_reason varchar(300),
  helpful_count integer not null default 0 check (helpful_count >= 0),
  unhelpful_count integer not null default 0 check (unhelpful_count >= 0),
  deleted_at timest?mptz,
  created_at timest?mptz not null default timezone('utc', now()),
  updated_at timest?mptz not null default timezone('utc', now())
);

create unique index if not exists reviews_author_target_active_idx
  on public.reviews (author_id, target_type, target_resource_id)
  where deleted_at is null;

create index if not exists reviews_course_public_idx
  on public.reviews (target_type, target_resource_id, moderation_status, created_at desc)
  where deleted_at is null;

create table if not exists public.review_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'fake', 'dupe', 'other')),
  description text,
  reported_by uuid references public.profiles (id) on delete set null,
  moderated_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  action text check (action is null or action in ('approve', 'reject', 'edit')),
  created_at timest?mptz not null default timezone('utc', now()),
  resolved_at timest?mptz
);

create table if not exists public.review_helpful_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_helpful boolean not null,
  created_at timest?mptz not null default timezone('utc', now()),
  unique (review_id, user_id)
);

create table if not exists public.review_stats (
  id uuid primary key default gen_random_uuid(),
  target_id uuid,
  target_type text not null,
  total_reviews integer not null default 0 check (total_reviews >= 0),
  avg_rating numeric(3,2) not null default 0 check (avg_rating >= 0 and avg_rating <= 5),
  rating_distribution jsonb not null default '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
  updated_at timest?mptz not null default timezone('utc', now()),
  unique (target_type, target_id)
);

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row
execute procedure public.set_updated_at();

create or replace function public.refresh_review_stats(_target_type text, _target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  average_rating numeric(3,2);
  distribution jsonb;
begin
  if _target_type is null or _target_id is null then
    return;
  end if;

  select
    count(*)::integer,
    coalesce(round(avg(rating)::numeric, 2), 0)::numeric(3,2),
    jsonb_build_object(
      '1', count(*) filter (where rating = 1),
      '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3),
      '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5)
    )
    into total_count, average_rating, distribution
  from public.reviews
  where target_type = _target_type
    and target_resource_id = _target_id
    and moderation_status = 'approved'
    and deleted_at is null;

  insert into public.review_stats (
    target_type,
    target_id,
    total_reviews,
    avg_rating,
    rating_distribution,
    updated_at
  )
  values (
    _target_type,
    _target_id,
    total_count,
    average_rating,
    distribution,
    timezone('utc', now())
  )
  on conflict (target_type, target_id) do update
  set
    total_reviews = excluded.total_reviews,
    avg_rating = excluded.avg_rating,
    rating_distribution = excluded.rating_distribution,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.handle_reviews_stats_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_review_stats(old.target_type, old.target_resource_id);
    return old;
  end if;

  perform public.refresh_review_stats(new.target_type, new.target_resource_id);

  if tg_op = 'UPDATE' and (
    old.target_type is distinct from new.target_type
    or old.target_resource_id is distinct from new.target_resource_id
  ) then
    perform public.refresh_review_stats(old.target_type, old.target_resource_id);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_review_stats_after_reviews_change on public.reviews;
create trigger refresh_review_stats_after_reviews_change
after insert or update or delete on public.reviews
for each row
execute procedure public.handle_reviews_stats_refresh();

create or replace function public.sync_review_helpful_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_review_id uuid;
begin
  affected_review_id := coalesce(new.review_id, old.review_id);

  update public.reviews r
  set
    helpful_count = (
      select count(*)::integer
      from public.review_helpful_votes v
      where v.review_id = affected_review_id
        and v.is_helpful
    ),
    unhelpful_count = (
      select count(*)::integer
      from public.review_helpful_votes v
      where v.review_id = affected_review_id
        and not v.is_helpful
    )
  where r.id = affected_review_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_review_helpful_counts_after_vote on public.review_helpful_votes;
create trigger sync_review_helpful_counts_after_vote
after insert or update or delete on public.review_helpful_votes
for each row
execute procedure public.sync_review_helpful_counts();

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

  select *
    into profile_record
  from public.profiles
  where id = current_user_id
  limit 1;

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
      moderation_status
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
      'approved'
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
      moderation_status = 'approved',
      moderation_reason = null
    where id = existing_review.id
    returning * into saved_review;
  end if;

  return saved_review;
end;
$$;

create or replace function public.vote_review_helpful(_review_id uuid, _is_helpful boolean)
returns public.review_helpful_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_vote public.review_helpful_votes%rowtype;
begin
  if current_user_id is null then
    raise exception 'Faça login para votar em uma avaliação.';
  end if;

  if not exists (
    select 1
    from public.reviews r
    where r.id = _review_id
      and r.moderation_status = 'approved'
      and r.deleted_at is null
  ) then
    raise exception 'Avaliação indisponível.';
  end if;

  insert into public.review_helpful_votes (review_id, user_id, is_helpful)
  values (_review_id, current_user_id, _is_helpful)
  on conflict (review_id, user_id) do update
  set is_helpful = excluded.is_helpful
  returning * into saved_vote;

  return saved_vote;
end;
$$;

grant select on public.reviews to anon, authenticated;
grant insert, update on public.reviews to authenticated;
grant select, insert on public.review_moderation_reports to authenticated;
grant select, insert, update, delete on public.review_helpful_votes to authenticated;
grant select on public.review_stats to anon, authenticated;
grant execute on function public.refresh_review_stats(text, uuid) to service_role;
grant execute on function public.submit_course_review(uuid, integer, text, text) to authenticated;
grant execute on function public.vote_review_helpful(uuid, boolean) to authenticated;
grant all on public.reviews to service_role;
grant all on public.review_moderation_reports to service_role;
grant all on public.review_helpful_votes to service_role;
grant all on public.review_stats to service_role;

alter table public.reviews enable row level security;
alter table public.review_moderation_reports enable row level security;
alter table public.review_helpful_votes enable row level security;
alter table public.review_stats enable row level security;

drop policy if exists "reviews_public_approved_select" on public.reviews;
create policy "reviews_public_approved_select"
on public.reviews
for select
to anon, authenticated
using (
  moderation_status = 'approved'
  and deleted_at is null
);

drop policy if exists "reviews_owner_admin_select" on public.reviews;
create policy "reviews_owner_admin_select"
on public.reviews
for select
to authenticated
using (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "reviews_owner_insert" on public.reviews;
create policy "reviews_owner_insert"
on public.reviews
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "reviews_owner_update" on public.reviews;
create policy "reviews_owner_update"
on public.reviews
for update
to authenticated
using (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "reviews_service_role_all" on public.reviews;
create policy "reviews_service_role_all"
on public.reviews
for all
to service_role
using (true)
with check (true);

drop policy if exists "review_moderation_reports_owner_insert" on public.review_moderation_reports;
create policy "review_moderation_reports_owner_insert"
on public.review_moderation_reports
for insert
to authenticated
with check (reported_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "review_moderation_reports_admin_select" on public.review_moderation_reports;
create policy "review_moderation_reports_admin_select"
on public.review_moderation_reports
for select
to authenticated
using (reported_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "review_moderation_reports_service_role_all" on public.review_moderation_reports;
create policy "review_moderation_reports_service_role_all"
on public.review_moderation_reports
for all
to service_role
using (true)
with check (true);

drop policy if exists "review_helpful_votes_owner_select" on public.review_helpful_votes;
create policy "review_helpful_votes_owner_select"
on public.review_helpful_votes
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "review_helpful_votes_owner_insert" on public.review_helpful_votes;
create policy "review_helpful_votes_owner_insert"
on public.review_helpful_votes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "review_helpful_votes_owner_update" on public.review_helpful_votes;
create policy "review_helpful_votes_owner_update"
on public.review_helpful_votes
for update
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "review_helpful_votes_owner_delete" on public.review_helpful_votes;
create policy "review_helpful_votes_owner_delete"
on public.review_helpful_votes
for delete
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "review_helpful_votes_service_role_all" on public.review_helpful_votes;
create policy "review_helpful_votes_service_role_all"
on public.review_helpful_votes
for all
to service_role
using (true)
with check (true);

drop policy if exists "review_stats_public_select" on public.review_stats;
create policy "review_stats_public_select"
on public.review_stats
for select
to anon, authenticated
using (true);

drop policy if exists "review_stats_service_role_all" on public.review_stats;
create policy "review_stats_service_role_all"
on public.review_stats
for all
to service_role
using (true)
with check (true);

commit;
