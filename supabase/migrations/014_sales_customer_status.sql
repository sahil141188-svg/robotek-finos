-- ============================================================
-- Migration 014: Customer status for the AI Sales Coordinator
--
-- Lets us mark dealers as 'discontinued' so they drop out of Churn Radar,
-- active counts and the push lists (they're not churned — we stopped dealing
-- with them on purpose).
--
-- How to apply: paste into Supabase SQL Editor → Run.
-- ============================================================

ALTER TABLE public.sales_customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';  -- 'active' | 'discontinued'

CREATE INDEX IF NOT EXISTS sales_customers_status_idx ON public.sales_customers (status);
