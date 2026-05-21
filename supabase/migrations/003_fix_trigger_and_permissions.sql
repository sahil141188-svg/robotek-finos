-- ============================================================
-- Migration 003: Fix handle_new_user trigger + add permissions
-- ============================================================
-- The handle_new_user trigger must use SECURITY DEFINER so it
-- runs with postgres privileges (not the calling auth role which
-- lacks INSERT on public.users).
-- ============================================================

-- ── Step 1: Add permissions column ──────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
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

-- ── Step 2: Backfill permissions for existing users ──────────
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":true}'::jsonb WHERE role = 'ceo';
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'cfo';
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'accounts';
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":false,"view_compliance":true,"manage_tasks":true,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'ca';

-- ── Step 3: Replace trigger with SECURITY DEFINER version ────
-- This is required: the trigger fires as supabase_auth_admin which
-- has no INSERT rights on public.users. SECURITY DEFINER makes it
-- run as the function owner (postgres/superuser) who can bypass RLS.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                -- required for auth trigger to write public.users
SET search_path = public        -- prevent search_path hijacking
AS $$
DECLARE
  v_role  text;
  v_perms jsonb;
BEGIN
  v_role := COALESCE(new.raw_app_meta_data->>'role', 'accounts');

  CASE v_role
    WHEN 'ceo' THEN
      v_perms := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":true}'::jsonb;
    WHEN 'cfo' THEN
      v_perms := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":false}'::jsonb;
    WHEN 'accounts' THEN
      v_perms := '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
    WHEN 'ca' THEN
      v_perms := '{"view_dashboard":true,"import_data":false,"view_compliance":true,"manage_tasks":true,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
    ELSE
      v_perms := '{"view_dashboard":true,"import_data":false,"view_compliance":false,"manage_tasks":false,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb;
  END CASE;

  INSERT INTO public.users (id, email, full_name, role, permissions)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role::user_role,
    v_perms
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Re-attach the trigger (DROP + CREATE to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
