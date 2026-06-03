-- ============================================================
-- Robotek FinOS — NBD — REMAINING migrations 012–016
-- Run this AFTER 011 (which is already applied: crm_accounts/contacts/
-- leads/deals/activities exist). Touches only the 012–016 objects, so your
-- live 011 tables are untouched. Safe to run multiple times.
-- ============================================================

-- Clean up any partial 012–016 objects (all new/empty) so re-create is clean
drop table if exists public.crm_quote_items     cascade;
drop table if exists public.crm_quotes          cascade;
drop table if exists public.crm_products        cascade;
drop table if exists public.crm_email_templates cascade;
drop table if exists public.crm_drip_messages   cascade;
drop type  if exists crm_quote_status      cascade;
drop type  if exists crm_drip_msg_status   cascade;
drop type  if exists crm_drip_status       cascade;
drop type  if exists crm_lead_type         cascade;

-- ── 012_crm_drip.sql ──
-- ============================================================
-- Robotek FinOS — Sales OS: Lead types + Drip campaigns
-- Migration: 012_crm_drip
-- ------------------------------------------------------------
-- Two lead types get different warm-up drip sequences. When a lead is
-- QUALIFIED, 4-5 WhatsApp messages are scheduled on future dates so the
-- team keeps the lead warm WITHOUT over-calling (which gets them blocked).
-- A daily cron (/api/cron/crm-drip) sends the messages that are due.
-- ============================================================

-- ── ENUMS ───────────────────────────────────────────────────

create type crm_lead_type as enum ('corporate', 'channel_partner');

create type crm_drip_status as enum ('none', 'active', 'done', 'stopped');

create type crm_drip_msg_status as enum ('pending', 'sent', 'skipped', 'failed', 'cancelled');

-- ── EXTEND crm_leads ────────────────────────────────────────

alter table public.crm_leads
  add column if not exists lead_type       crm_lead_type   not null default 'channel_partner',
  add column if not exists drip_status      crm_drip_status not null default 'none',
  add column if not exists drip_started_at  timestamptz;

create index if not exists idx_crm_leads_drip_status on public.crm_leads (drip_status);

-- ── CRM_DRIP_MESSAGES ───────────────────────────────────────
-- One row per scheduled message in a lead's drip sequence. The body is
-- rendered (placeholders filled) at enrollment time so the cron just sends it.

create table public.crm_drip_messages (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.crm_leads(id) on delete cascade,
  sequence       crm_lead_type not null,
  step_no        integer not null,                 -- 1-based position in the sequence
  channel        text not null default 'whatsapp',
  scheduled_for  date not null,
  body           text not null,
  status         crm_drip_msg_status not null default 'pending',
  sent_at        timestamptz,
  error          text,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_crm_drip_lead   on public.crm_drip_messages (lead_id);
create index idx_crm_drip_due    on public.crm_drip_messages (status, scheduled_for);

alter table public.crm_drip_messages enable row level security;

create policy "crm_drip_select" on public.crm_drip_messages
  for select to authenticated using (true);
create policy "crm_drip_insert" on public.crm_drip_messages
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_drip_update" on public.crm_drip_messages
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

grant select, insert, update on public.crm_drip_messages to authenticated;

-- ── 013_crm_quotes.sql ──
-- ============================================================
-- Robotek FinOS — Sales OS: Products catalog + Quotations (CPQ)
-- Migration: 013_crm_quotes
-- ============================================================

create type crm_quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- ── CRM_PRODUCTS ────────────────────────────────────────────

create table public.crm_products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text,
  category    text,
  hsn         text,                                   -- HSN code for GST
  unit        text not null default 'pcs',
  unit_price  numeric(15, 2) not null default 0,
  gst_rate    numeric(5, 2) not null default 18,      -- %
  is_active   boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_products_active on public.crm_products (is_active);
create index idx_crm_products_name   on public.crm_products (name);

alter table public.crm_products enable row level security;
create policy "crm_products_select" on public.crm_products for select to authenticated using (true);
create policy "crm_products_insert" on public.crm_products for insert to authenticated with check (public.can_write_crm());
create policy "crm_products_update" on public.crm_products for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── CRM_QUOTES ──────────────────────────────────────────────

create table public.crm_quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_number  text not null,
  account_id    uuid references public.crm_accounts(id) on delete set null,
  deal_id       uuid references public.crm_deals(id) on delete set null,
  status        crm_quote_status not null default 'draft',
  subtotal      numeric(15, 2) not null default 0,
  tax_total     numeric(15, 2) not null default 0,
  total         numeric(15, 2) not null default 0,
  valid_until   date,
  notes         text,
  terms         text,
  owner_id      uuid references public.users(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_crm_quotes_account on public.crm_quotes (account_id);
create index idx_crm_quotes_status  on public.crm_quotes (status);

alter table public.crm_quotes enable row level security;
create policy "crm_quotes_select" on public.crm_quotes for select to authenticated using (true);
create policy "crm_quotes_insert" on public.crm_quotes for insert to authenticated with check (public.can_write_crm());
create policy "crm_quotes_update" on public.crm_quotes for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── CRM_QUOTE_ITEMS ─────────────────────────────────────────

create table public.crm_quote_items (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references public.crm_quotes(id) on delete cascade,
  product_id    uuid references public.crm_products(id) on delete set null,
  description   text not null,
  qty           numeric(15, 2) not null default 1,
  unit_price    numeric(15, 2) not null default 0,
  gst_rate      numeric(5, 2) not null default 18,
  line_subtotal numeric(15, 2) not null default 0,
  line_tax      numeric(15, 2) not null default 0,
  line_total    numeric(15, 2) not null default 0,
  sort_order    integer not null default 0
);

create index idx_crm_quote_items_quote on public.crm_quote_items (quote_id);

alter table public.crm_quote_items enable row level security;
create policy "crm_quote_items_select" on public.crm_quote_items for select to authenticated using (true);
create policy "crm_quote_items_insert" on public.crm_quote_items for insert to authenticated with check (public.can_write_crm());
create policy "crm_quote_items_update" on public.crm_quote_items for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── TRIGGERS + GRANTS ───────────────────────────────────────

create trigger crm_products_updated_at before update on public.crm_products
  for each row execute function public.handle_updated_at();
create trigger crm_quotes_updated_at before update on public.crm_quotes
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_products    to authenticated;
grant select, insert, update on public.crm_quotes      to authenticated;
grant select, insert, update on public.crm_quote_items to authenticated;

-- ── 014_crm_email.sql ──
-- ============================================================
-- Robotek FinOS — Sales OS: Email templates (email channel)
-- Migration: 014_crm_email
-- ============================================================

create table public.crm_email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  body        text not null,              -- supports {{name}} / {{company}}
  category    text,
  is_active   boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_email_templates_active on public.crm_email_templates (is_active);

alter table public.crm_email_templates enable row level security;
create policy "crm_email_templates_select" on public.crm_email_templates for select to authenticated using (true);
create policy "crm_email_templates_insert" on public.crm_email_templates for insert to authenticated with check (public.can_write_crm());
create policy "crm_email_templates_update" on public.crm_email_templates for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

create trigger crm_email_templates_updated_at before update on public.crm_email_templates
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_email_templates to authenticated;

-- ── 015_crm_tags.sql ──
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

-- ── 016_crm_lead_fields.sql ──
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


-- Refresh API schema cache
NOTIFY pgrst, 'reload schema';
