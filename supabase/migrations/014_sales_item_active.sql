-- ============================================================
-- Migration 014: active / discontinued flag on sales items
--
-- The stock sheet "Stock List" tab has a Status (Yes/No) column. Status = No
-- means the SKU is discontinued (often with a replacement). We keep the row
-- (so its historical qty still counts toward its CATEGORY totals) but mark it
-- inactive so it's removed from the item/customer push targets.
--
-- How to apply: paste into Supabase SQL Editor -> Run.
-- ============================================================

ALTER TABLE public.sales_products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
