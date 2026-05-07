with target as (
  select id, value
  from public.site_content_entries
  where page_key = 'global'
    and entry_key = 'global.footer.columns'
    and is_enabled = true
  for update
),
updated as (
  update public.site_content_entries e
  set value = (
    select coalesce(
      jsonb_agg(
        case
          when column_item->>'id' = 'contato' then
            jsonb_set(
              column_item,
              '{metadata,items}',
              case
                when exists (
                  select 1
                  from jsonb_array_elements(coalesce(column_item->'metadata'->'items', '[]'::jsonb)) item
                  where item->>'href' = '/ensine-na-genflix'
                )
                then coalesce(column_item->'metadata'->'items', '[]'::jsonb)
                else coalesce(column_item->'metadata'->'items', '[]'::jsonb) || jsonb_build_array(
                  jsonb_build_object(
                    'id', 'item-ensine-na-genflix',
                    'label', 'Ensine na GenFlix',
                    'href', '/ensine-na-genflix',
                    'metadata', jsonb_build_object('isInternal', true)
                  )
                )
              end,
              true
            )
          else column_item
        end
        order by ordinality
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(t.value) with ordinality as arr(column_item, ordinality)
  )
  from target t
  where e.id = t.id
    and exists (
      select 1
      from jsonb_array_elements(t.value) as column_item
      where column_item->>'id' = 'contato'
    )
    and not exists (
      select 1
      from jsonb_array_elements(t.value) as column_item,
           jsonb_array_elements(coalesce(column_item->'metadata'->'items', '[]'::jsonb)) as item
      where column_item->>'id' = 'contato'
        and item->>'href' = '/ensine-na-genflix'
    )
  returning e.id, t.value as previous_value, e.value as next_value
),
insert_version as (
  insert into public.site_content_versions (
    entry_id,
    page_key,
    entry_key,
    entry_type,
    previous_value,
    next_value,
    changed_by,
    change_reason
  )
  select
    id,
    'global',
    'global.footer.columns',
    'list',
    previous_value,
    next_value,
    null,
    'migration'
  from updated
  returning 1
)
select count(*) as updated_rows
from insert_version;
