-- One-time bootstrap for the first admin user.
-- 1) Update the email below.
-- 2) Execute manually in Supabase SQL editor (dev/prod separately).

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
join public.roles r on r.code = 'admin'
where u.email = 'admin@homecarematch.com'
on conflict (user_id, role_id) do nothing;
