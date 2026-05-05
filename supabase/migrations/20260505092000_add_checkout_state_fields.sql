begin;

alter table public.profiles
  add column if not exists state text;

comment on column public.profiles.state is
  'UF do usuario usado para checkout e dados cadastrais.';

alter table public.commerce_checkout_sessions
  add column if not exists buyer_state text;

comment on column public.commerce_checkout_sessions.buyer_state is
  'UF informada no checkout.';

commit;
