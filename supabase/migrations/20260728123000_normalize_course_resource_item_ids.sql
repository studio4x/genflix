with normalized_resource_entries as (
  select
    entry.id,
    jsonb_agg(
      case
        when jsonb_typeof(item.value) = 'object' then jsonb_set(
          item.value,
          '{id}',
          to_jsonb(
            coalesce(
              nullif(btrim(item.value ->> 'id'), ''),
              nullif(btrim(coalesce(item.value ->> 'label', item.value ->> 'title', '')), ''),
              format('resource-%s', item.ordinality)
            )
          ),
          true
        )
        else item.value
      end
      order by item.ordinality
    ) as normalized_value
  from public.site_content_entries entry
  cross join lateral jsonb_array_elements(entry.value) with ordinality as item(value, ordinality)
  where entry.page_key = 'resources'
    and entry.entry_key = 'resources.items'
    and jsonb_typeof(entry.value) = 'array'
  group by entry.id
)
update public.site_content_entries as entry
set value = normalized.normalized_value
from normalized_resource_entries as normalized
where entry.id = normalized.id
  and entry.value is distinct from normalized.normalized_value;

with normalized_course_resources as (
  select
    course.id,
    coalesce(
      array(
        select resource_id
        from (
          select btrim(item.resource_id) as resource_id, min(item.ordinality) as first_ordinality
          from unnest(coalesce(course.resource_item_ids, '{}'::text[])) with ordinality as item(resource_id, ordinality)
          where btrim(item.resource_id) <> ''
          group by btrim(item.resource_id)
        ) as deduplicated
        order by first_ordinality
      ),
      '{}'::text[]
    ) as normalized_resource_item_ids
  from public.courses as course
)
update public.courses as course
set resource_item_ids = normalized.normalized_resource_item_ids
from normalized_course_resources as normalized
where course.id = normalized.id
  and course.resource_item_ids is distinct from normalized.normalized_resource_item_ids;
