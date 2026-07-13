begin;

alter table public.course_authors
  alter column author_id drop not null;

alter table public.course_authors
  add column if not exists manual_public_slug text,
  add column if not exists manual_public_title text,
  add column if not exists manual_public_short_bio text,
  add column if not exists manual_public_long_bio text,
  add column if not exists manual_public_areas text[],
  add column if not exists manual_public_education text,
  add column if not exists manual_public_experience text,
  add column if not exists manual_public_photo_url text,
  add column if not exists manual_public_website_url text,
  add column if not exists manual_public_instagram_url text,
  add column if not exists manual_public_linkedin_url text,
  add column if not exists manual_public_youtube_url text;

alter table public.course_authors
  drop constraint if exists course_authors_author_or_manual_check;

alter table public.course_authors
  add constraint course_authors_author_or_manual_check
  check (
    author_id is not null
    or nullif(trim(manual_public_title), '') is not null
  );

create index if not exists course_authors_manual_slug_idx
  on public.course_authors (manual_public_slug)
  where author_id is null and manual_public_slug is not null and manual_public_slug <> '';

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
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'author_id', coalesce(ca.author_id, ca.id),
            'manual_author_id', case when ca.author_id is null then ca.id else null end,
            'display_order', ca.display_order,
            'commission_percent', ca.commission_percent,
            'user_id', ca.author_id,
            'public_slug', coalesce(
              nullif(ca.manual_public_slug, ''),
              nullif(cp.public_slug, ''),
              public.slugify_text(coalesce(ca.manual_public_title, cp.public_title, cp.payout_name, p.full_name, p.email, ca.id::text))
            ),
            'public_title', coalesce(nullif(ca.manual_public_title, ''), nullif(cp.public_title, ''), cp.payout_name, p.full_name, p.email, 'Autor'),
            'public_short_bio', coalesce(ca.manual_public_short_bio, cp.public_short_bio),
            'public_long_bio', coalesce(ca.manual_public_long_bio, cp.public_long_bio),
            'public_areas', case when ca.author_id is null then coalesce(ca.manual_public_areas, '{}'::text[]) else coalesce(cp.public_areas, '{}'::text[]) end,
            'public_education', coalesce(ca.manual_public_education, cp.public_education),
            'public_experience', coalesce(ca.manual_public_experience, cp.public_experience),
            'public_photo_url', coalesce(ca.manual_public_photo_url, cp.public_photo_url, p.avatar_url),
            'public_website_url', coalesce(ca.manual_public_website_url, cp.public_website_url),
            'public_instagram_url', coalesce(ca.manual_public_instagram_url, cp.public_instagram_url),
            'public_linkedin_url', coalesce(ca.manual_public_linkedin_url, cp.public_linkedin_url),
            'public_youtube_url', coalesce(ca.manual_public_youtube_url, cp.public_youtube_url),
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
          )
          order by ca.display_order asc, ca.created_at asc
        )
        from public.course_authors ca
        left join public.creator_profiles cp on cp.user_id = ca.author_id
        left join public.profiles p on p.id = ca.author_id
        where ca.course_id = c.id
      ),
      case
        when c.creator_id is null then '[]'::jsonb
        else jsonb_build_array(
          jsonb_build_object(
            'author_id', c.creator_id,
            'display_order', 1,
            'commission_percent', c.creator_commission_percent,
            'user_id', c.creator_id,
            'public_slug', coalesce(nullif(ccp.public_slug, ''), public.slugify_text(coalesce(ccp.public_title, ccp.payout_name, cpr.full_name, cpr.email, c.creator_id::text))),
            'public_title', coalesce(nullif(ccp.public_title, ''), ccp.payout_name, cpr.full_name, cpr.email, 'Autor'),
            'public_short_bio', ccp.public_short_bio,
            'public_long_bio', ccp.public_long_bio,
            'public_areas', coalesce(ccp.public_areas, '{}'::text[]),
            'public_education', ccp.public_education,
            'public_experience', ccp.public_experience,
            'public_photo_url', coalesce(ccp.public_photo_url, cpr.avatar_url),
            'public_website_url', ccp.public_website_url,
            'public_instagram_url', ccp.public_instagram_url,
            'public_linkedin_url', ccp.public_linkedin_url,
            'public_youtube_url', ccp.public_youtube_url,
            'full_name', cpr.full_name,
            'avatar_url', cpr.avatar_url
          )
        )
      end
    ) as authors
  from public.courses c
  left join public.creator_profiles ccp on ccp.user_id = c.creator_id
  left join public.profiles cpr on cpr.id = c.creator_id
  where c.slug = _slug
    and c.status = 'published'
    and c.is_public = true
  limit 1;
$$;

grant execute on function public.get_public_course_detail(text) to anon, authenticated, service_role;

commit;
