create or replace function public.admin_clear_server_cache()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
  perform pg_notify('pgrst', 'reload config');
  return true;
end;
$$;

revoke all on function public.admin_clear_server_cache() from public;
grant execute on function public.admin_clear_server_cache() to service_role;
