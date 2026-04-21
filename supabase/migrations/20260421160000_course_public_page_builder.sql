alter table public.courses
  add column if not exists public_page_content jsonb not null default '{}'::jsonb;

comment on column public.courses.public_page_content is
  'Configuracao complementar da pagina publica do curso: textos ricos, beneficios e modo de exibicao do conteudo.';

create or replace function public.get_public_course_outline(_course_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with eligible_course as (
    select c.id
    from public.courses c
    where c.id = _course_id
      and c.status = 'published'
      and coalesce(c.is_public, false)
  ),
  module_base as (
    select
      cm.id,
      cm.title,
      cm.position
    from public.course_modules cm
    join eligible_course ec on ec.id = cm.course_id
  ),
  module_items as (
    select
      mb.id as module_id,
      l.position as item_position,
      l.title as item_name
    from module_base mb
    join public.lessons l on l.module_id = mb.id

    union all

    select
      mb.id as module_id,
      1000000 as item_position,
      coalesce(nullif(trim(a.title), ''), 'Quiz do modulo') as item_name
    from module_base mb
    join public.assessments a
      on a.module_id = mb.id
     and a.assessment_type = 'module'
  ),
  final_assessment_group as (
    select
      case
        when count(*) = 0 then null
        when count(*) = 1 then 'Avaliacao final'
        else 'Avaliacoes finais'
      end as title,
      coalesce(
        jsonb_agg(coalesce(nullif(trim(a.title), ''), 'Avaliacao final') order by a.created_at),
        '[]'::jsonb
      ) as items
    from public.assessments a
    join eligible_course ec on ec.id = a.course_id
    where a.module_id is null
  ),
  assembled_modules as (
    select
      mb.position,
      jsonb_build_object(
        'title', mb.title,
        'items', coalesce(
          (
            select jsonb_agg(mi.item_name order by mi.item_position, mi.item_name)
            from module_items mi
            where mi.module_id = mb.id
          ),
          '[]'::jsonb
        )
      ) as payload
    from module_base mb

    union all

    select
      1000000 as position,
      jsonb_build_object(
        'title', fag.title,
        'items', fag.items
      ) as payload
    from final_assessment_group fag
    where fag.title is not null
      and jsonb_array_length(fag.items) > 0
  )
  select coalesce(jsonb_agg(payload order by position), '[]'::jsonb)
  from assembled_modules;
$$;

grant execute on function public.get_public_course_outline(uuid) to anon, authenticated, service_role;
