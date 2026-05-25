-- ============================================================
-- Migration 008: Allow same vendor/customer name across companies.
--
-- Before: `customers.name` and `vendors.name` had a GLOBAL UNIQUE
-- constraint inherited from migration 001 — which prevented the same
-- party (e.g. "VALEUR FABTEX PRIVATE LIMITED") from existing under
-- more than one company.
--
-- After: uniqueness is scoped per (name, company_id). A party with the
-- same name can now legitimately exist in Robotek, Muskan, Yuval, etc.
--
-- How to apply:
--   Paste this file into Supabase SQL Editor and click Run.
-- ============================================================

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_name_key;
ALTER TABLE public.vendors   DROP CONSTRAINT IF EXISTS vendors_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS customers_name_company_uniq
  ON public.customers (name, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_name_company_uniq
  ON public.vendors (name, company_id);
