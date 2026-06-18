-- ============================================================
-- Robotek FinOS — Meta Leads: add ad tracking fields to crm_leads
-- Migration: 023_crm_meta_leads
-- ============================================================

alter table public.crm_leads
  add column if not exists ad_name  text,   -- Meta ad name / campaign name
  add column if not exists ad_id    text,   -- Meta ad_id or form_id from webhook payload
  add column if not exists ad_set   text;   -- Meta ad set name (optional)

create index if not exists idx_crm_leads_source on public.crm_leads (source);
