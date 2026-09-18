begin;

-- Adicionar campo modal_subtitle na biblioteca de botões globais
alter table public.global_button_definitions
  add column if not exists modal_subtitle text;

-- Adicionar campo modal_subtitle no posicionamento de botões no rodapé
alter table public.lesson_footer_actions
  add column if not exists modal_subtitle text;

commit;
