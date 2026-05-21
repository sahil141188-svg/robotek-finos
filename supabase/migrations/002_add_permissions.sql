-- ============================================================
-- Robotek FinOS — Migration 002: Granular User Permissions
-- ============================================================
-- Adds a `permissions` JSONB column to public.users so each user
-- gets fine-grained module access controlled via the Admin Panel.
-- Note: PostgreSQL does not support removing enum values once created,
-- so `coo` stays in the user_role enum but is not exposed in the UI.
-- ============================================================

alter table public.users
  add column if not exists permissions jsonb not null default '{
    "view_dashboard":    true,
    "import_data":       false,
    "view_compliance":   false,
    "manage_tasks":      false,
    "view_payables":     false,
    "view_receivables":  false,
    "view_review":       false,
    "view_alerts":       true,
    "admin_users":       false
  }'::jsonb;

-- Set sensible defaults for existing rows based on their role
update public.users set permissions = '{
  "view_dashboard":    true,
  "import_data":       true,
  "view_compliance":   true,
  "manage_tasks":      true,
  "view_payables":     true,
  "view_receivables":  true,
  "view_review":       true,
  "view_alerts":       true,
  "admin_users":       true
}'::jsonb where role = 'ceo';

update public.users set permissions = '{
  "view_dashboard":    true,
  "import_data":       true,
  "view_compliance":   true,
  "manage_tasks":      true,
  "view_payables":     true,
  "view_receivables":  true,
  "view_review":       true,
  "view_alerts":       true,
  "admin_users":       false
}'::jsonb where role = 'cfo';

update public.users set permissions = '{
  "view_dashboard":    true,
  "import_data":       true,
  "view_compliance":   true,
  "manage_tasks":      true,
  "view_payables":     true,
  "view_receivables":  true,
  "view_review":       false,
  "view_alerts":       true,
  "admin_users":       false
}'::jsonb where role = 'accounts';

update public.users set permissions = '{
  "view_dashboard":    true,
  "import_data":       false,
  "view_compliance":   true,
  "manage_tasks":      true,
  "view_payables":     false,
  "view_receivables":  false,
  "view_review":       false,
  "view_alerts":       true,
  "admin_users":       false
}'::jsonb where role = 'ca';

-- Also update the handle_new_user trigger to set default permissions by role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_role user_role;
  v_permissions jsonb;
begin
  v_role := coalesce(
    (new.raw_app_meta_data->>'role')::user_role,
    'accounts'::user_role
  );

  -- Set default permissions based on role
  case v_role
    when 'ceo' then
      v_permissions := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":true}'::jsonb;
    when 'cfo' then
      v_permissions := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":false}'::jsonb;
    when 'accounts' then
      v_permissions := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
    when 'ca' then
      v_permissions := '{"view_dashboard":true,"import_data":false,"view_compliance":true,"manage_tasks":true,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
    else
      v_permissions := '{"view_dashboard":true,"import_data":false,"view_compliance":false,"manage_tasks":false,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
  end case;

  insert into public.users (id, email, full_name, role, permissions)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_permissions
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
