-- ============================================================
-- Migration 004: Fix infinite recursion in users RLS policies
-- ============================================================
-- The users_select_own policy contained a sub-select FROM public.users
-- inside itself, causing PostgreSQL error 42P17 (infinite recursion).
-- Fix: create a SECURITY DEFINER helper that reads the calling user's
-- role without triggering the policy, then rewrite every policy that
-- referenced public.users inline.
-- ============================================================

-- ── Step 1: SECURITY DEFINER helper ─────────────────────────
-- Runs as the function owner (postgres) so it bypasses RLS on
-- public.users. STABLE tells Postgres it can be inlined/cached.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid())
$$;

-- ── Step 2: Rewrite users policies ──────────────────────────
DROP POLICY IF EXISTS "users_select_own"   ON public.users;
DROP POLICY IF EXISTS "users_insert_ceo"   ON public.users;
DROP POLICY IF EXISTS "users_update_own"   ON public.users;

-- All authenticated users can read their own row;
-- CEO and CFO can read every row (for the admin panel list).
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR public.get_my_role() IN ('ceo', 'cfo')
  );

-- Users can update their own profile only.
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Only the CEO may INSERT new rows (the invite flow also uses the
-- service-role key in server actions, so this guards the anon path).
CREATE POLICY "users_insert_ceo" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ceo');

-- ── Step 3: Rewrite other tables that queried public.users ───
-- vendors
DROP POLICY IF EXISTS "vendors_insert_update" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update"         ON public.vendors;

CREATE POLICY "vendors_insert" ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('accounts', 'cfo', 'ceo'));

CREATE POLICY "vendors_update" ON public.vendors
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.get_my_role() IN ('accounts', 'cfo', 'ceo'));

-- customers
DROP POLICY IF EXISTS "customers_insert_update" ON public.customers;
DROP POLICY IF EXISTS "customers_update"         ON public.customers;

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('accounts', 'cfo', 'ceo'));

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (public.get_my_role() IN ('accounts', 'cfo', 'ceo'));
