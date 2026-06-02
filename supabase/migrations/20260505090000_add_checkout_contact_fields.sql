begin;

alter table public.profiles
  add column if not exists cpf text;

comment on column public.profiles.cpf is
  'CPF do usurio usado para checkout e dados cadastrais.';

alter table public.commerce_checkout_sessions
  add column if not exists buyer_phone text;

comment on column public.commerce_checkout_sessions.buyer_phone is
  'Telefone celular informado no checkout.';

commit;
