-- ============================================================
-- Migration 010: Per-customer, per-item targets (AI Sales Coordinator)
--
-- Lets the sales team focus EACH customer on the right items:
-- for every (customer, item) the customer regularly buys, we store a
-- monthly target derived from that customer's own history + 10%.
-- `is_focus` marks the items that make up ~80% of that customer's volume
-- (the ones worth actively pushing); the rest are occasional buys.
--
-- Month-specific target = monthly_target_qty * seasonalFactor(month)
-- (seasonal index lives in lib/sales/seasonal-index.json).
--
-- How to apply: paste into Supabase SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_customer_item_targets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        uuid NOT NULL REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  product_id         uuid NOT NULL REFERENCES public.sales_products(id)  ON DELETE CASCADE,
  monthly_target_qty numeric NOT NULL,        -- avg monthly for this customer*item, +10%
  avg_monthly_qty    numeric,                 -- raw historical baseline (pre-uplift)
  months_active      integer NOT NULL DEFAULT 0, -- in how many months they bought it (confidence)
  total_qty          numeric NOT NULL DEFAULT 0, -- lifetime qty of this item by this customer
  last_qty           numeric,                 -- their most recent order qty of this item
  last_ordered_at    timestamptz,             -- when they last bought this item
  is_focus           boolean NOT NULL DEFAULT false, -- part of this customer's ~80% core
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS sci_targets_customer_idx ON public.sales_customer_item_targets (customer_id);
CREATE INDEX IF NOT EXISTS sci_targets_product_idx  ON public.sales_customer_item_targets (product_id);
CREATE INDEX IF NOT EXISTS sci_targets_focus_idx    ON public.sales_customer_item_targets (is_focus);

ALTER TABLE public.sales_customer_item_targets ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY sci_targets_read ON public.sales_customer_item_targets FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
