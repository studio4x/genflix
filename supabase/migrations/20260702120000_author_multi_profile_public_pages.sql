begin;

create or replace function public.slugify_text(input text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ),
    ''
  );
$$;

alter table public.creator_profiles
  add column if not exists public_slug text,
  add column if not exists public_title text,
  add column if not exists public_short_bio text,
  add column if not exists public_long_bio text,
  add column if not exists public_areas text[] not null default '{}'::text[],
  add column if not exists public_education text,
  add column if not exists public_experience text,
  add column if not exists public_website_url text,
  add column if not exists public_instagram_url text,
  add column if not exists public_linkedin_url text,
  add column if not exists public_youtube_url text,
  add column if not exists public_photo_url text;

update public.creator_profiles cp
set public_slug = coalesce(
  nullif(cp.public_slug, ''),
  public.slugify_text(coalesce(cp.payout_name, p.full_name, p.email, cp.user_id::text))
),
public_title = coalesce(nullif(cp.public_title, ''), cp.payout_name, p.full_name),
public_short_bio = coalesce(nullif(cp.public_short_bio, ''), nullif(cp.public_long_bio, '')),
public_long_bio = coalesce(nullif(cp.public_long_bio, ''), nullif(cp.public_short_bio, '')),
public_photo_url = coalesce(nullif(cp.public_photo_url, ''), p.avatar_url)
from public.profiles p
where p.id = cp.user_id;

update public.creator_profiles cp
set public_slug = public.slugify_text(coalesce(cp.payout_name, p.full_name, p.email, cp.user_id::text))
from public.profiles p
where p.id = cp.user_id
  and cp.public_slug is null;

create unique index if not exists creator_profiles_public_slug_idx
  on public.creator_profiles (public_slug)
  where public_slug is not null and public_slug <> '';

create table if not exists public.course_authors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  commission_percent numeric(5,2) not null default 0 check (commission_percent >= 0 and commission_percent <= 100),
  display_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, author_id)
);

create index if not exists course_authors_course_id_idx
  on public.course_authors (course_id, display_order, created_at);

create index if not exists course_authors_author_id_idx
  on public.course_authors (author_id);

drop trigger if exists set_course_authors_updated_at on public.course_authors;
create trigger set_course_authors_updated_at
before update on public.course_authors
for each row
execute procedure public.set_updated_at();

create or replace function public.ensure_course_author_commission_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_percent numeric(5,2);
  target_course_id uuid;
begin
  target_course_id := case
    when tg_op = 'DELETE' then old.course_id
    else new.course_id
  end;

  select coalesce(sum(commission_percent), 0)
    into total_percent
  from public.course_authors
  where course_id = target_course_id;

  if total_percent > 100 then
    raise exception 'A soma das comissoes dos autores do curso nao pode ultrapassar 100%%.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists course_authors_commission_guard on public.course_authors;
create constraint trigger course_authors_commission_guard
after insert or update or delete on public.course_authors
deferrable initially immediate
for each row
execute function public.ensure_course_author_commission_total();

alter table public.course_authors enable row level security;

drop policy if exists "course_authors_select_authenticated" on public.course_authors;
create policy "course_authors_select_authenticated"
on public.course_authors
for select
to authenticated
using (true);

drop policy if exists "course_authors_admin_write" on public.course_authors;
create policy "course_authors_admin_write"
on public.course_authors
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "course_authors_service_role_all" on public.course_authors;
create policy "course_authors_service_role_all"
on public.course_authors
for all
to service_role
using (true)
with check (true);

alter table public.creator_profiles enable row level security;

drop policy if exists "creator_profiles_public_read" on public.creator_profiles;
create policy "creator_profiles_public_read"
on public.creator_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "creator_profiles_admin_write" on public.creator_profiles;
create policy "creator_profiles_admin_write"
on public.creator_profiles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator_profiles_admin_update" on public.creator_profiles;
create policy "creator_profiles_admin_update"
on public.creator_profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin') or auth.uid() = user_id)
with check (public.has_role(auth.uid(), 'admin') or auth.uid() = user_id);

drop policy if exists "creator_profiles_service_role_all" on public.creator_profiles;
create policy "creator_profiles_service_role_all"
on public.creator_profiles
for all
to service_role
using (true)
with check (true);

alter table public.creator_commissions
  drop constraint if exists creator_commissions_checkout_session_id_key;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'creator_commissions_checkout_session_id_key'
      and conrelid = 'public.creator_commissions'::regclass
  ) then
    alter table public.creator_commissions drop constraint creator_commissions_checkout_session_id_key;
  end if;
end;
$$;

alter table public.creator_commissions
  add constraint creator_commissions_checkout_session_creator_unique unique (checkout_session_id, creator_id);

create or replace function public.get_public_course_detail(_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  description text,
  category text,
  categories text[],
  thumbnail_url text,
  cover_image_url text,
  hero_video_url text,
  logo_url text,
  show_reviews boolean,
  resource_item_ids text[],
  marketing_description text,
  mentor_name text,
  mentor_role text,
  mentor_bio text,
  mentor_initials text,
  price_label text,
  secondary_price_label text,
  price_cents integer,
  currency text,
  public_page_content jsonb,
  display_order integer,
  launch_date text,
  created_at timestamptz,
  authors jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.slug,
    c.title,
    c.description,
    c.category,
    c.categories,
    c.thumbnail_url,
    c.cover_image_url,
    c.hero_video_url,
    c.logo_url,
    c.show_reviews,
    c.resource_item_ids,
    c.marketing_description,
    c.mentor_name,
    c.mentor_role,
    c.mentor_bio,
    c.mentor_initials,
    c.price_label,
    c.secondary_price_label,
    c.price_cents::integer,
    c.currency,
    c.public_page_content::jsonb,
    c.display_order,
    c.launch_date::text,
    c.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'author_id', ca.author_id,
          'display_order', ca.display_order,
          'commission_percent', ca.commission_percent,
          'user_id', cp.user_id,
          'public_slug', coalesce(nullif(cp.public_slug, ''), public.slugify_text(coalesce(cp.public_title, cp.payout_name, p.full_name, p.email, cp.user_id::text))),
          'public_title', coalesce(nullif(cp.public_title, ''), cp.payout_name, p.full_name, p.email),
          'public_short_bio', cp.public_short_bio,
          'public_long_bio', cp.public_long_bio,
          'public_areas', cp.public_areas,
          'public_education', cp.public_education,
          'public_experience', cp.public_experience,
          'public_photo_url', coalesce(cp.public_photo_url, p.avatar_url),
          'public_website_url', cp.public_website_url,
          'public_instagram_url', cp.public_instagram_url,
          'public_linkedin_url', cp.public_linkedin_url,
          'public_youtube_url', cp.public_youtube_url,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        order by ca.display_order asc, ca.created_at asc
      )
      from public.course_authors ca
      join public.creator_profiles cp on cp.user_id = ca.author_id
      join public.profiles p on p.id = ca.author_id
      where ca.course_id = c.id
    ), '[]'::jsonb) as authors
  from public.courses c
  where c.slug = _slug
    and c.status = 'published'
    and c.is_public = true
  limit 1;
$$;

create or replace function public.get_public_author_profile(_slug text)
returns table (
  user_id uuid,
  public_slug text,
  public_title text,
  public_short_bio text,
  public_long_bio text,
  public_areas text[],
  public_education text,
  public_experience text,
  public_photo_url text,
  public_website_url text,
  public_instagram_url text,
  public_linkedin_url text,
  public_youtube_url text,
  payout_name text,
  full_name text,
  avatar_url text,
  courses jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.user_id,
    coalesce(nullif(cp.public_slug, ''), public.slugify_text(coalesce(cp.public_title, cp.payout_name, p.full_name, p.email, cp.user_id::text))) as public_slug,
    coalesce(nullif(cp.public_title, ''), cp.payout_name, p.full_name, p.email) as public_title,
    cp.public_short_bio,
    cp.public_long_bio,
    cp.public_areas,
    cp.public_education,
    cp.public_experience,
    coalesce(cp.public_photo_url, p.avatar_url) as public_photo_url,
    cp.public_website_url,
    cp.public_instagram_url,
    cp.public_linkedin_url,
    cp.public_youtube_url,
    cp.payout_name,
    p.full_name,
    p.avatar_url,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'slug', c.slug,
          'title', c.title,
          'category', c.category,
          'categories', c.categories,
          'thumbnail_url', c.thumbnail_url,
          'cover_image_url', c.cover_image_url,
          'hero_video_url', c.hero_video_url,
          'price_label', c.price_label,
          'secondary_price_label', c.secondary_price_label,
          'price_cents', c.price_cents,
          'currency', c.currency,
          'display_order', c.display_order,
          'launch_date', c.launch_date,
          'commission_percent', ca.commission_percent,
          'display_order_author', ca.display_order
        )
        order by c.display_order asc, c.created_at desc
      )
      from public.course_authors ca
      join public.courses c on c.id = ca.course_id
      where ca.author_id = cp.user_id
        and c.status = 'published'
        and c.is_public = true
    ), '[]'::jsonb) as courses
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.user_id
  where coalesce(nullif(cp.public_slug, ''), public.slugify_text(coalesce(cp.public_title, cp.payout_name, p.full_name, p.email, cp.user_id::text))) = _slug
  limit 1;
$$;

create or replace function public.create_creator_commission_for_checkout(_checkout_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record public.commerce_checkout_sessions%rowtype;
  course_record public.courses%rowtype;
  creator_profile_record public.creator_profiles%rowtype;
  commission_id uuid;
  processed_commission_id uuid;
  author_record record;
  has_course_authors boolean;
  commission_rate numeric(5,2);
  commission_amount integer;
  hold_days integer;
begin
  select *
    into session_record
  from public.commerce_checkout_sessions
  where id = _checkout_session_id
  limit 1;

  if session_record.id is null or session_record.status <> 'paid' then
    return null;
  end if;

  select *
    into course_record
  from public.courses
  where id = session_record.course_id
  limit 1;

  if course_record.id is null then
    return null;
  end if;

  select exists (
    select 1
    from public.course_authors ca
    where ca.course_id = course_record.id
  ) into has_course_authors;

  if has_course_authors then
    for author_record in
      select
        ca.author_id,
        ca.commission_percent,
        coalesce(nullif(cp.payout_name, ''), nullif(cp.public_title, ''), p.full_name, p.email) as label,
        coalesce(cp.payout_hold_days, 30) as hold_days
      from public.course_authors ca
      join public.creator_profiles cp on cp.user_id = ca.author_id
      join public.profiles p on p.id = ca.author_id
      where ca.course_id = course_record.id
      order by ca.display_order asc, ca.created_at asc
    loop
      commission_rate := coalesce(author_record.commission_percent, 0);
      if commission_rate <= 0 then
        continue;
      end if;
      commission_amount := floor(coalesce(course_record.price_cents, 0) * commission_rate / 100.0)::integer;
      insert into public.creator_commissions (
        course_id,
        creator_id,
        checkout_session_id,
        external_payment_id,
        gross_amount_cents,
        commission_rate,
        commission_amount_cents,
        status,
        sale_paid_at,
        eligible_at
      )
      values (
        session_record.course_id,
        author_record.author_id,
        session_record.id,
        session_record.external_payment_id,
        coalesce(course_record.price_cents, 0),
        commission_rate,
        commission_amount,
        'pending',
        coalesce(session_record.released_at, timezone('utc', now())),
        coalesce(session_record.released_at, timezone('utc', now())) + make_interval(days => coalesce(author_record.hold_days, 30))
      )
      on conflict (checkout_session_id, creator_id) do update
      set
        external_payment_id = excluded.external_payment_id,
        gross_amount_cents = excluded.gross_amount_cents,
        commission_rate = excluded.commission_rate,
        commission_amount_cents = excluded.commission_amount_cents,
        status = case
          when public.creator_commissions.status in ('paid', 'scheduled') then public.creator_commissions.status
          else excluded.status
        end,
        sale_paid_at = excluded.sale_paid_at,
        eligible_at = excluded.eligible_at,
        canceled_at = null,
        refunded_at = null
      returning id into processed_commission_id;
      commission_id := coalesce(processed_commission_id, commission_id);
    end loop;
    return commission_id;
  end if;

  if course_record.creator_id is null then
    return null;
  end if;

  select *
    into creator_profile_record
  from public.creator_profiles
  where user_id = course_record.creator_id
  limit 1;

  commission_rate := coalesce(nullif(course_record.creator_commission_percent, 0), creator_profile_record.default_commission_percent, 0);

  if commission_rate <= 0 then
    return null;
  end if;

  hold_days := coalesce(creator_profile_record.payout_hold_days, 30);
  commission_amount := floor(coalesce(course_record.price_cents, 0) * commission_rate / 100.0)::integer;

  insert into public.creator_commissions (
    course_id,
    creator_id,
    checkout_session_id,
    external_payment_id,
    gross_amount_cents,
    commission_rate,
    commission_amount_cents,
    status,
    sale_paid_at,
    eligible_at
  )
  values (
    session_record.course_id,
    course_record.creator_id,
    session_record.id,
    session_record.external_payment_id,
    coalesce(course_record.price_cents, 0),
    commission_rate,
    commission_amount,
    'pending',
    coalesce(session_record.released_at, timezone('utc', now())),
    coalesce(session_record.released_at, timezone('utc', now())) + make_interval(days => hold_days)
  )
  on conflict (checkout_session_id, creator_id) do update
  set
    external_payment_id = excluded.external_payment_id,
    gross_amount_cents = excluded.gross_amount_cents,
    commission_rate = excluded.commission_rate,
    commission_amount_cents = excluded.commission_amount_cents,
    status = case
      when public.creator_commissions.status in ('paid', 'scheduled') then public.creator_commissions.status
      else excluded.status
    end,
    sale_paid_at = excluded.sale_paid_at,
    eligible_at = excluded.eligible_at,
    canceled_at = null,
    refunded_at = null
  returning id into commission_id;

  return commission_id;
end;
$$;

create or replace function public.get_creator_sales_report(_creator_id uuid default null, _course_id uuid default null)
returns table (
  course_id uuid,
  course_title text,
  creator_id uuid,
  launch_date date,
  period_index integer,
  period_starts_at date,
  period_ends_at date,
  sales_count bigint,
  gross_revenue_cents bigint,
  cancellations_count bigint,
  cancellations_amount_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed_courses as (
    select
      c.id,
      c.title,
      c.creator_id,
      coalesce(c.launch_date, c.created_at::date) as launch_date
    from public.courses c
    where c.creator_id is not null
      and (_course_id is null or c.id = _course_id)
      and (
        public.has_role(auth.uid(), 'admin')
        or c.creator_id = coalesce(_creator_id, auth.uid())
        or exists (
          select 1
          from public.course_authors ca
          where ca.course_id = c.id
            and ca.author_id = coalesce(_creator_id, auth.uid())
        )
      )
  ),
  periods as (
    select
      ac.id as course_id,
      ac.title as course_title,
      ac.creator_id,
      ac.launch_date,
      gs.period_index,
      (ac.launch_date + (gs.period_index * interval '6 months'))::date as period_starts_at,
      (ac.launch_date + ((gs.period_index + 1) * interval '6 months') - interval '1 day')::date as period_ends_at
    from allowed_courses ac
    cross join lateral generate_series(
      0,
      greatest(0, floor(((timezone('utc', now())::date - ac.launch_date)::numeric) / 183)::integer)
    ) as gs(period_index)
  ),
  sessions as (
    select
      ccs.course_id,
      ccs.status,
      coalesce(ccs.released_at, ccs.updated_at, ccs.created_at) as event_at,
      coalesce(c.price_cents, 0) as amount_cents
    from public.commerce_checkout_sessions ccs
    join public.courses c on c.id = ccs.course_id
    where c.creator_id is not null
      and ccs.status in ('paid', 'canceled', 'expired', 'failed')
  )
  select
    p.course_id,
    p.course_title,
    p.creator_id,
    p.launch_date,
    p.period_index,
    p.period_starts_at,
    p.period_ends_at,
    count(*) filter (where s.status = 'paid') as sales_count,
    coalesce(sum(s.amount_cents) filter (where s.status = 'paid'), 0)::bigint as gross_revenue_cents,
    count(*) filter (where s.status in ('canceled', 'expired', 'failed')) as cancellations_count,
    coalesce(sum(s.amount_cents) filter (where s.status in ('canceled', 'expired', 'failed')), 0)::bigint as cancellations_amount_cents
  from periods p
  left join sessions s
    on s.course_id = p.course_id
    and s.event_at::date between p.period_starts_at and p.period_ends_at
  group by
    p.course_id,
    p.course_title,
    p.creator_id,
    p.launch_date,
    p.period_index,
    p.period_starts_at,
    p.period_ends_at
  order by p.course_title, p.period_index;
$$;

grant execute on function public.slugify_text(text) to anon, authenticated, service_role;
grant execute on function public.get_public_course_detail(text) to anon, authenticated, service_role;
grant execute on function public.get_public_author_profile(text) to anon, authenticated, service_role;
grant execute on function public.create_creator_commission_for_checkout(uuid) to service_role;
grant execute on function public.get_creator_sales_report(uuid, uuid) to authenticated, service_role;
grant execute on function public.ensure_course_author_commission_total() to authenticated, service_role;

grant select on public.course_authors to authenticated;
grant all on public.course_authors to service_role;

commit;
