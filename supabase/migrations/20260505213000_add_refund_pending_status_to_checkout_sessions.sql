begin;

alter table public.commerce_checkout_sessions
  drop constraint if exists commerce_checkout_sessions_status_check;

alter table public.commerce_checkout_sessions
  add constraint commerce_checkout_sessions_status_check
  check (status in ('created', 'active', 'paid', 'canceled', 'expired', 'failed', 'refund_pending', 'refunded', 'chargeback'));

commit;
