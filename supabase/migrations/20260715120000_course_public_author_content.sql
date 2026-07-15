begin;

-- Preserve the current public author presentation once, before the course page
-- becomes independent from course_authors. Future edits are stored in the
-- public_page_content.authorContent field and no longer read author profiles.
with legacy_author_content as (
  select
    c.id as course_id,
    string_agg(
      '<p><strong>' ||
      replace(replace(replace(replace(coalesce(nullif(ca.manual_public_title, ''), nullif(cp.public_title, ''), p.full_name, p.email, 'Autor'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;') ||
      '</strong>' ||
      case
        when nullif(coalesce(ca.manual_public_long_bio, cp.public_long_bio, cp.public_short_bio), '') is null then ''
        else '<br>' || replace(replace(replace(replace(coalesce(ca.manual_public_long_bio, cp.public_long_bio, cp.public_short_bio), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
      end ||
      '</p>',
      '' order by ca.display_order asc, ca.created_at asc
    ) as author_content
  from public.courses c
  join public.course_authors ca on ca.course_id = c.id
  left join public.creator_profiles cp on cp.user_id = ca.author_id
  left join public.profiles p on p.id = ca.author_id
  where jsonb_typeof(coalesce(c.public_page_content, '{}'::jsonb)) = 'object'
    and not (coalesce(c.public_page_content, '{}'::jsonb) ? 'authorContent')
  group by c.id
)
update public.courses c
set public_page_content = coalesce(c.public_page_content, '{}'::jsonb) || jsonb_build_object(
  'authorContent', coalesce(lac.author_content, '')
)
from legacy_author_content lac
where c.id = lac.course_id;

commit;
