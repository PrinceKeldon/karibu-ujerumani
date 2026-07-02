insert into public.admin_roles (user_id, role, permissions)
select id, 'admin', '{"super_admin": true}'
from public.users
where lower(email) = 'exec@frankkoine.com'
on conflict (user_id) do update
set
  role = 'admin',
  permissions = '{"super_admin": true}',
  updated_at = now();
