begin;

insert into public.course_authors (
  course_id,
  author_id,
  commission_percent,
  display_order
)
select
  c.id,
  c.creator_id,
  coalesce(nullif(c.creator_commission_percent, 0), cp.default_commission_percent, 0),
  1
from public.courses c
left join public.creator_profiles cp
  on cp.user_id = c.creator_id
where c.creator_id is not null
  and not exists (
    select 1
    from public.course_authors ca
    where ca.course_id = c.id
  )
on conflict (course_id, author_id) do update
set
  commission_percent = excluded.commission_percent,
  display_order = excluded.display_order;

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
            'author_id', ca.author_id,
            'display_order', ca.display_order,
            'commission_percent', ca.commission_percent,
            'user_id', ca.author_id,
            'public_slug', coalesce(nullif(cp.public_slug, ''), public.slugify_text(coalesce(cp.public_title, cp.payout_name, p.full_name, p.email, ca.author_id::text))),
            'public_title', coalesce(nullif(cp.public_title, ''), cp.payout_name, p.full_name, p.email, 'Autor'),
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
        left join public.creator_profiles cp on cp.user_id = ca.author_id
        left join public.profiles p on p.id = ca.author_id
        where ca.course_id = c.id
      ),
      case
        when c.creator_id is null then null
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
            'public_areas', ccp.public_areas,
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
      end,
      '[]'::jsonb
    ) as authors
  from public.courses c
  left join public.creator_profiles ccp on ccp.user_id = c.creator_id
  left join public.profiles cpr on cpr.id = c.creator_id
  where c.slug = _slug
    and c.status = 'published'
    and c.is_public = true
  limit 1;
$$;

commit;
