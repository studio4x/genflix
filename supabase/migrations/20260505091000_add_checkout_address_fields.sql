begin;

alter table public.profiles
  add column if not exists address text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists postal_code text,
  add column if not exists province text,
  add column if not exists city text;

comment on column public.profiles.address is
  'Logradouro do usuario usado para checkout e dados cadastrais.';
comment on column public.profiles.address_number is
  'Numero do endereco do usuario usado para checkout e dados cadastrais.';
comment on column public.profiles.address_complement is
  'Complemento do endereco do usuario usado para checkout e dados cadastrais.';
comment on column public.profiles.postal_code is
  'CEP do usuario usado para checkout e dados cadastrais.';
comment on column public.profiles.province is
  'Bairro do usuario usado para checkout e dados cadastrais.';
comment on column public.profiles.city is
  'Codigo IBGE da cidade do usuario usado para checkout e dados cadastrais.';

alter table public.commerce_checkout_sessions
  add column if not exists buyer_address text,
  add column if not exists buyer_address_number text,
  add column if not exists buyer_address_complement text,
  add column if not exists buyer_postal_code text,
  add column if not exists buyer_province text,
  add column if not exists buyer_city text;

comment on column public.commerce_checkout_sessions.buyer_address is
  'Logradouro informado no checkout.';
comment on column public.commerce_checkout_sessions.buyer_address_number is
  'Numero do endereco informado no checkout.';
comment on column public.commerce_checkout_sessions.buyer_address_complement is
  'Complemento do endereco informado no checkout.';
comment on column public.commerce_checkout_sessions.buyer_postal_code is
  'CEP informado no checkout.';
comment on column public.commerce_checkout_sessions.buyer_province is
  'Bairro informado no checkout.';
comment on column public.commerce_checkout_sessions.buyer_city is
  'Codigo IBGE da cidade informado no checkout.';

commit;
