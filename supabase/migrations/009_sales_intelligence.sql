-- ============================================================
-- Migration 009: Sales Intelligence (AI Sales Coordinator)
--
-- New module that turns Robotek's order history (today living in
-- Google Sheets, punched via the Vercel order app) into a database
-- the "AI SC" can reason over:
--   • Churn Radar      — who is overdue vs their normal reorder gap
--   • Target-Gap       — breakeven items: month-to-date qty vs target
--   • Launch / Restock — what to push and to whom
--
-- These tables are namespaced `sales_*` so they NEVER collide with the
-- existing finance/AR `customers` table (which is company-scoped and
-- used by the accounting modules). Robotek sales is a single-company
-- view, so no company_id here.
--
-- How to apply:
--   Paste this whole file into Supabase SQL Editor → Run.
-- ============================================================

-- ---------- CUSTOMERS (the "Firm Name" in the order sheet) ----------
CREATE TABLE IF NOT EXISTS public.sales_customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,          -- e.g. "Khatu Ji", "Ashish Ji Bilaspur"
  phone           text,                          -- WhatsApp number (filled later)
  segment         text,                          -- 'high' | 'mid' | 'low' (derived from volume)
  first_order_at  timestamptz,                   -- maintained by importer
  last_order_at   timestamptz,                   -- maintained by importer — powers Churn Radar
  total_orders    integer NOT NULL DEFAULT 0,    -- maintained by importer
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- PRODUCTS (the "Item Name" — battery/accessory models) ----------
CREATE TABLE IF NOT EXISTS public.sales_products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,       -- e.g. "DC 101", "Rapid", "ANS Galaxy-V8"
  category           text,
  is_breakeven       boolean NOT NULL DEFAULT false, -- true = a "must hit monthly target" item (#6)
  monthly_target_qty numeric,                    -- minimum monthly qty to cover costs (#6)
  total_qty_sold     numeric NOT NULL DEFAULT 0, -- maintained by importer (lifetime)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- ORDERS (one per grouping key: Order Number / Unique Number) ----------
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no     text NOT NULL,                    -- grouping key from the sheet
  customer_id  uuid NOT NULL REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  ordered_at   timestamptz NOT NULL,
  source       text NOT NULL DEFAULT 'sheet',    -- which sheet/source it came from (provenance)
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- order numbers can repeat across different source sheets, so scope uniqueness by source
  UNIQUE (source, order_no)
);

-- ---------- ORDER ITEMS (one row per item line in the sheet) ----------
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.sales_products(id) ON DELETE CASCADE,
  qty             numeric NOT NULL,
  stock_at_order  numeric,                       -- "Available Qty in FG Store" at order time (sheet col G)
  remarks         text,
  raw_item_name   text,                          -- original sheet text, for traceability
  -- deterministic hash of the source line → lets the importer re-run safely (idempotent)
  line_hash       text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- INDEXES (for the AI SC queries) ----------
CREATE INDEX IF NOT EXISTS sales_orders_customer_idx     ON public.sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS sales_orders_ordered_at_idx   ON public.sales_orders (ordered_at);
CREATE INDEX IF NOT EXISTS sales_order_items_order_idx   ON public.sales_order_items (order_id);
CREATE INDEX IF NOT EXISTS sales_order_items_product_idx ON public.sales_order_items (product_id);
CREATE INDEX IF NOT EXISTS sales_customers_last_order_idx ON public.sales_customers (last_order_at);

-- ---------- ROW LEVEL SECURITY ----------
-- Internal tool: any authenticated FinOS user (ceo/cfo/coo/accounts/ca) can read.
-- Writes happen through the service-role importer, which bypasses RLS.
ALTER TABLE public.sales_customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- read for all signed-in users
  CREATE POLICY sales_customers_read   ON public.sales_customers   FOR SELECT TO authenticated USING (true);
  CREATE POLICY sales_products_read    ON public.sales_products    FOR SELECT TO authenticated USING (true);
  CREATE POLICY sales_orders_read      ON public.sales_orders      FOR SELECT TO authenticated USING (true);
  CREATE POLICY sales_order_items_read ON public.sales_order_items FOR SELECT TO authenticated USING (true);

  -- allow authenticated users to update light fields from the dashboard
  -- (e.g. set phone, segment, mark breakeven items / targets, "contacted" notes)
  CREATE POLICY sales_customers_write ON public.sales_customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY sales_products_write  ON public.sales_products  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN
  NULL; -- policies already exist, re-run safe
END $$;
