-- ============================================================
-- Robotek FinOS — NBD: extend crm_leads to match the real
-- enquiry-capture / FSR / sales-funnel sheets.
-- Migration: 016_crm_lead_fields
-- ============================================================

alter table public.crm_leads
  add column if not exists enquiry_no            text,      -- F#### / FSR-#### / enquiry number (their key)
  add column if not exists enquiry_type          text,      -- Retailer / Wholesaler / Distributor / Dealer / SS
  add column if not exists filled_by             text,      -- capture clerk (Alka / Payal / Sadhna)
  add column if not exists sc_name               text,      -- sales coordinator name
  add column if not exists assigned_name         text,      -- raw sales-person name from the sheet
  add column if not exists product_interest      text,      -- focused products / enquiry for products
  add column if not exists existing_brand        text,      -- existing products/brand selling
  add column if not exists monthly_turnover      text,      -- current monthly turnover (kept as text: "40-50K")
  add column if not exists investment_amount     text,      -- investment amount (kept as text: "50K")
  add column if not exists priority              text,      -- COLD / MEDIUM / HOT
  add column if not exists external_status       text,      -- raw Stages/Status from the sheet (Qualified, Transfer to SS…)
  add column if not exists lead_time_days        integer,   -- lead time for next call (days)
  add column if not exists first_billing_date    date,
  add column if not exists first_billing_amount  numeric(15, 2),
  add column if not exists dream_customer        boolean not null default false,
  add column if not exists whatsapp_link         text,
  add column if not exists visit_date            date;      -- FSR date of visit

create index if not exists idx_crm_leads_enquiry_no on public.crm_leads (enquiry_no);
