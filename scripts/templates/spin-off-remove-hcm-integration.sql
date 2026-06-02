begin;

do $$
begin
  perform public.unschedule_hcm_outbox_dispatch();
exception
  when undefined_function then
    null;
  when others then
    raise notice 'N?o foi possvel cancelar o cron de integracao durante o cleanup do spin-off: %', sqlerrm;
end
$$;

drop trigger if exists trg_enqueue_integration_from_lesson_progress on public.lesson_progress;
drop trigger if exists trg_enqueue_integration_from_assessment_attempts on public.assessment_attempts;
drop trigger if exists trg_enqueue_integration_from_course_progress on public.course_progress;

drop function if exists public.trg_enqueue_integration_from_lesson_progress() cascade;
drop function if exists public.trg_enqueue_integration_from_assessment_attempts() cascade;
drop function if exists public.trg_enqueue_integration_from_course_progress() cascade;
drop function if exists public.enqueue_integration_event(text, text, uuid, uuid, jsonb) cascade;
drop function if exists public.get_course_integration_snapshot(uuid, uuid) cascade;
drop function if exists public.schedule_hcm_outbox_dispatch(text) cascade;
drop function if exists public.unschedule_hcm_outbox_dispatch() cascade;

drop trigger if exists set_external_user_identities_updated_at on public.external_user_identities;
drop trigger if exists set_external_course_mappings_updated_at on public.external_course_mappings;
drop trigger if exists set_integration_runtime_settings_updated_at on public.integration_runtime_settings;

drop table if exists public.integration_event_outbox cascade;
drop table if exists public.integration_access_nonces cascade;
drop table if exists public.integration_logs cascade;
drop table if exists public.integration_runtime_settings cascade;
drop table if exists public.external_course_mappings cascade;
drop table if exists public.external_user_identities cascade;

commit;
