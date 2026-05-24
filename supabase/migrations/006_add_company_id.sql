-- ============================================================
-- Migration 006: Multi-Company Data Isolation
-- Adds company_id FK to all core data tables so each
-- subsidiary's records are kept separate from the others.
--
-- Prerequisites (run FIRST if not done already):
--   1. supabase/create_companies_table.sql
--   2. supabase/migrations/005_bank_accounts_and_statements.sql
--
-- How to apply:
--   Paste this file into Supabase SQL Editor and click Run.
-- ============================================================

-- ── Step 1: Add company_id column to all core tables ────────────────────────
-- Using ADD COLUMN IF NOT EXISTS so re-running this is safe.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.compliance_items
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.file_imports
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE RESTRICT;

-- ── Step 2: Backfill existing rows with the primary company ─────────────────
-- Assigns all pre-existing data to the company with the lowest sort_order
-- (Robotek India Pvt Ltd, sort_order = 1).
DO $$
DECLARE
  primary_id uuid;
BEGIN
  SELECT id INTO primary_id
  FROM   public.companies
  ORDER  BY sort_order ASC, created_at ASC
  LIMIT  1;

  IF primary_id IS NULL THEN
    RAISE WARNING 'Migration 006: No companies found — skipping backfill. '
                  'Run create_companies_table.sql first, then re-run this file.';
    RETURN;
  END IF;

  UPDATE public.bank_accounts    SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.transactions     SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.compliance_items SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.tasks            SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.file_imports     SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.vendors          SET company_id = primary_id WHERE company_id IS NULL;
  UPDATE public.customers        SET company_id = primary_id WHERE company_id IS NULL;

  RAISE NOTICE 'Migration 006: Backfill complete — company_id = %', primary_id;
END $$;

-- ── Step 3: Enforce NOT NULL after backfill ──────────────────────────────────
ALTER TABLE public.bank_accounts    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.transactions     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.compliance_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.tasks            ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.file_imports     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.vendors          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.customers        ALTER COLUMN company_id SET NOT NULL;

-- ── Step 4: Performance indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company
  ON public.bank_accounts    (company_id);

CREATE INDEX IF NOT EXISTS idx_transactions_company
  ON public.transactions     (company_id);

CREATE INDEX IF NOT EXISTS idx_compliance_company
  ON public.compliance_items (company_id);

CREATE INDEX IF NOT EXISTS idx_tasks_company
  ON public.tasks            (company_id);

CREATE INDEX IF NOT EXISTS idx_file_imports_company
  ON public.file_imports     (company_id);

CREATE INDEX IF NOT EXISTS idx_vendors_company
  ON public.vendors          (company_id);

CREATE INDEX IF NOT EXISTS idx_customers_company
  ON public.customers        (company_id);

-- ── Step 5: Ensure SELECT is granted on companies ────────────────────────────
GRANT SELECT ON public.companies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.companies TO authenticated;
