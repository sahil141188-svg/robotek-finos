-- ============================================================
-- Robotek FinOS — Sales OS: Tags / segments
-- Migration: 015_crm_tags
-- ============================================================
-- Free-form tags for segmenting leads and accounts (e.g. "South India",
-- "High value", "Reseller", "Exhibition-2026").

alter table public.crm_leads
  add column if not exists tags text[] not null default '{}';

alter table public.crm_accounts
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_crm_leads_tags    on public.crm_leads    using gin (tags);
create index if not exists idx_crm_accounts_tags on public.crm_accounts using gin (tags);
