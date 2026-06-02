-- ============================================================
-- Migration 013: Item value signal for the AI Sales Coordinator
--
-- Adds a ROUGH per-unit value (from the O2D "Est Amount" export) so targets
-- can be PRIORITISED by value, not just quantity. A high-value / low-qty item
-- (e.g. TWS earbuds ~Rs 53/unit) should outrank a cheap high-volume item
-- (e.g. Rapid ~Rs 3.5/unit).
--
-- IMPORTANT: unit_value is a ROUGH reference figure, NOT real revenue. It is
-- used only to rank/select which items to push first. The actual targets stay
-- in quantity (monthly_target_qty).
--
-- How to apply: paste into Supabase SQL Editor -> Run.
-- ============================================================

ALTER TABLE public.sales_products
  ADD COLUMN IF NOT EXISTS unit_value numeric;   -- rough Rs/unit (reference only)

-- value_weight (qty x unit_value) is derived in code, not stored.
