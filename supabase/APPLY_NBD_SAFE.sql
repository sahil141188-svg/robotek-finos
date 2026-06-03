-- ============================================================
-- Robotek FinOS — NBD / Sales OS — SAFE APPLY (idempotent)
-- Paste this WHOLE file into Supabase → SQL Editor → Run.
--
-- It first cleans up any partial/previous NBD objects (these tables are new
-- and empty, so this is non-destructive), then re-creates everything cleanly.
-- Safe to run multiple times.
-- ============================================================

-- ── Clean slate for NBD objects (order respects dependencies) ──
alter table if exists public.users drop column if exists crm_department;
alter table if exists public.users drop column if exists crm_team_role;

drop table if exists public.crm_quote_items     cascade;
drop table if exists public.crm_quotes          cascade;
drop table if exists public.crm_products        cascade;
drop table if exists public.crm_email_templates cascade;
drop table if exists public.crm_drip_messages   cascade;
drop table if exists public.crm_activities      cascade;
drop table if exists public.crm_deals           cascade;
drop table if exists public.crm_contacts        cascade;
drop table if exists public.crm_leads           cascade;
drop table if exists public.crm_accounts        cascade;

drop function if exists public.can_write_crm()        cascade;
drop function if exists public.crm_handle_deal_won()  cascade;

drop type if exists crm_quote_status     cascade;
drop type if exists crm_drip_msg_status  cascade;
drop type if exists crm_drip_status      cascade;
drop type if exists crm_lead_type        cascade;
drop type if exists crm_activity_type    cascade;
drop type if exists crm_deal_stage       cascade;
drop type if exists crm_lead_status      cascade;
drop type if exists crm_account_status   cascade;
drop type if exists crm_account_type     cascade;
drop type if exists crm_team_role        cascade;
drop type if exists crm_department       cascade;

-- ── Now the clean create (migrations 011–015) ──

-- ============================================================
-- Robotek FinOS — NBD / Sales OS — ALL migrations (011–015)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run once on a DB that already has migrations 001–010.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 011_crm.sql
-- ─────────────────────────────────────────────────────────
-- ============================================================
-- Robotek FinOS — CRM Module (CRR + NBD departments)
-- Migration: 011_crm
-- ------------------------------------------------------------
-- Two sales departments share one pipeline model:
--   NBD  (New Business Development): Lead Gen -> SC -> Sales Expert -> FSR
--   CRR  (Customer Retention & Reorder): SC -> CRM Manager -> Sales Expert
-- When an NBD deal is WON, its account is handed off to CRR.
-- ============================================================

-- ── ENUM TYPES ──────────────────────────────────────────────

-- Which department owns a record
create type crm_department as enum ('crr', 'nbd');

-- Sales-team roles, layered ON TOP of the finance user_role.
-- A finance-only user simply has crm_team_role = null.
create type crm_team_role as enum (
  'lead_gen',          -- NBD: sources & qualifies new leads
  'sales_coordinator', -- SC: CRR = takes orders only; NBD = owns lead journey (meeting→negotiation→conversion, follow-ups)
  'sales_expert',      -- senior OSR: escalation backup for SC + field marketing for Super Stockists (new dealers/distributors, new territories)
  'crm',               -- Account Manager (job title "CRM"): docs, updates, reporting, payment reminders — "manages everything"
  'fsr',               -- NBD: field sales rep (on-ground visits)
  'sales_head'         -- department head / sales admin
);

-- Distribution hierarchy: Super Stockist → Distributor → Dealer → Retailer
create type crm_account_type as enum (
  'super_stockist', 'distributor', 'dealer', 'retailer', 'oem', 'other'
);

create type crm_account_status as enum (
  'prospect', 'active', 'dormant', 'lost'
);

create type crm_lead_status as enum (
  'new', 'contacted', 'qualified', 'unqualified', 'converted'
);

create type crm_deal_stage as enum (
  'new', 'qualified', 'quoted', 'negotiation', 'won', 'lost'
);

create type crm_activity_type as enum (
  'call', 'whatsapp', 'meeting', 'visit', 'email', 'task', 'note'
);

-- ── EXTEND USERS WITH SALES-TEAM FIELDS ─────────────────────
-- Nullable: finance-only staff (cfo/ca/etc.) leave these blank.

alter table public.users
  add column if not exists crm_department crm_department,
  add column if not exists crm_team_role  crm_team_role;

-- ── HELPER: is the current user allowed to write CRM data? ───
-- Management (ceo/cfo/coo) OR anyone with a sales-team role.
create or replace function public.can_write_crm()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and (
        u.role in ('ceo', 'cfo', 'coo')
        or u.crm_team_role is not null
      )
  );
$$;

-- ── CRM_ACCOUNTS ────────────────────────────────────────────
-- A customer company: dealer / distributor / retailer.

create table public.crm_accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          crm_account_type   not null default 'dealer',
  department    crm_department     not null default 'nbd',
  status        crm_account_status not null default 'prospect',
  owner_id      uuid references public.users(id) on delete set null,
  gstin         text,
  phone         text,
  email         text,
  city          text,
  state         text,
  address       text,
  notes         text,
  -- handoff bookkeeping: set when an NBD account is moved to CRR
  handed_off_at timestamptz,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_crm_accounts_dept   on public.crm_accounts (department);
create index idx_crm_accounts_owner  on public.crm_accounts (owner_id);
create index idx_crm_accounts_status on public.crm_accounts (status);
create index idx_crm_accounts_name   on public.crm_accounts (name);

alter table public.crm_accounts enable row level security;

create policy "crm_accounts_select" on public.crm_accounts
  for select to authenticated using (true);
create policy "crm_accounts_insert" on public.crm_accounts
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_accounts_update" on public.crm_accounts
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

-- ── CRM_CONTACTS ────────────────────────────────────────────
-- People at an account.

create table public.crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.crm_accounts(id) on delete cascade,
  name        text not null,
  designation text,
  phone       text,
  email       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_contacts_account on public.crm_contacts (account_id);

alter table public.crm_contacts enable row level security;

create policy "crm_contacts_select" on public.crm_contacts
  for select to authenticated using (true);
create policy "crm_contacts_insert" on public.crm_contacts
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_contacts_update" on public.crm_contacts
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

-- ── CRM_LEADS (NBD intake) ──────────────────────────────────
-- Raw inbound enquiries before they become a qualified deal/account.

create table public.crm_leads (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,            -- person or business name
  company             text,
  status              crm_lead_status not null default 'new',
  source              text,                     -- whatsapp, call, exhibition, referral, website...
  phone               text,
  email               text,
  city                text,
  state               text,
  est_value           numeric(15, 2) not null default 0,
  assigned_to         uuid references public.users(id) on delete set null,
  notes               text,
  -- set when lead is converted into an account
  converted_account_id uuid references public.crm_accounts(id) on delete set null,
  converted_at        timestamptz,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_crm_leads_status   on public.crm_leads (status);
create index idx_crm_leads_assigned on public.crm_leads (assigned_to);

alter table public.crm_leads enable row level security;

create policy "crm_leads_select" on public.crm_leads
  for select to authenticated using (true);
create policy "crm_leads_insert" on public.crm_leads
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_leads_update" on public.crm_leads
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

-- ── CRM_DEALS (pipeline, both departments) ──────────────────

create table public.crm_deals (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  account_id      uuid references public.crm_accounts(id) on delete set null,
  department      crm_department not null default 'nbd',
  stage           crm_deal_stage not null default 'new',
  value           numeric(15, 2) not null default 0,
  probability     integer not null default 10 check (probability between 0 and 100),
  owner_id        uuid references public.users(id) on delete set null,
  expected_close  date,
  lost_reason     text,
  won_at          timestamptz,
  lost_at         timestamptz,
  source          text,
  notes           text,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_crm_deals_stage   on public.crm_deals (stage);
create index idx_crm_deals_dept     on public.crm_deals (department);
create index idx_crm_deals_owner    on public.crm_deals (owner_id);
create index idx_crm_deals_account  on public.crm_deals (account_id);

alter table public.crm_deals enable row level security;

create policy "crm_deals_select" on public.crm_deals
  for select to authenticated using (true);
create policy "crm_deals_insert" on public.crm_deals
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_deals_update" on public.crm_deals
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

-- ── CRM_ACTIVITIES (calls / follow-ups / visits / notes) ────
-- Polymorphic-ish: may link to an account, lead, and/or deal.

create table public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  type        crm_activity_type not null default 'call',
  subject     text not null,
  body        text,
  due_at      timestamptz,
  done        boolean not null default false,
  done_at     timestamptz,
  owner_id    uuid references public.users(id) on delete set null,
  account_id  uuid references public.crm_accounts(id) on delete cascade,
  lead_id     uuid references public.crm_leads(id) on delete cascade,
  deal_id     uuid references public.crm_deals(id) on delete cascade,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_activities_owner   on public.crm_activities (owner_id);
create index idx_crm_activities_account on public.crm_activities (account_id);
create index idx_crm_activities_deal    on public.crm_activities (deal_id);
create index idx_crm_activities_due     on public.crm_activities (due_at);
create index idx_crm_activities_done    on public.crm_activities (done);

alter table public.crm_activities enable row level security;

create policy "crm_activities_select" on public.crm_activities
  for select to authenticated using (true);
create policy "crm_activities_insert" on public.crm_activities
  for insert to authenticated with check (public.can_write_crm());
create policy "crm_activities_update" on public.crm_activities
  for update to authenticated using (public.can_write_crm())
  with check (public.can_write_crm());

-- ── NBD → CRR HANDOFF ───────────────────────────────────────
-- When a deal is marked WON, move its account into the CRR department
-- (retention/reorder team takes over). Idempotent: only acts on the
-- transition INTO 'won' and only for accounts not already in CRR.

create or replace function public.crm_handle_deal_won()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.stage = 'won' and (old.stage is distinct from 'won') then
    new.won_at := coalesce(new.won_at, now());

    if new.account_id is not null then
      update public.crm_accounts
      set department    = 'crr',
          status        = 'active',
          handed_off_at = coalesce(handed_off_at, now())
      where id = new.account_id
        and department <> 'crr';
    end if;
  end if;

  if new.stage = 'lost' and (old.stage is distinct from 'lost') then
    new.lost_at := coalesce(new.lost_at, now());
  end if;

  return new;
end;
$$;

create trigger crm_deals_won_handoff
  before update on public.crm_deals
  for each row execute function public.crm_handle_deal_won();

-- ── UPDATED_AT TRIGGERS ─────────────────────────────────────
-- Reuses public.handle_updated_at() defined in migration 001.

create trigger crm_accounts_updated_at
  before update on public.crm_accounts
  for each row execute function public.handle_updated_at();

create trigger crm_contacts_updated_at
  before update on public.crm_contacts
  for each row execute function public.handle_updated_at();

create trigger crm_leads_updated_at
  before update on public.crm_leads
  for each row execute function public.handle_updated_at();

create trigger crm_deals_updated_at
  before update on public.crm_deals
  for each row execute function public.handle_updated_at();

create trigger crm_activities_updated_at
  before update on public.crm_activities
  for each row execute function public.handle_updated_at();

-- ── GRANTS (RLS still governs row visibility) ───────────────

grant select, insert, update on public.crm_accounts   to authenticated;
grant select, insert, update on public.crm_contacts    to authenticated;
grant select, insert, update on public.crm_leads       to authenticated;
grant select, insert, update on public.crm_deals       to authenticated;
grant select, insert, update on public.crm_activities  to authenticated;

-- ─────────────────────────────────────────────────────────
-- 012_crm_drip.sql
-- ─────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────
-- 013_crm_quotes.sql
-- ─────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────
-- 014_crm_email.sql
-- ─────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────
-- 015_crm_tags.sql
-- ─────────────────────────────────────────────────────────
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


-- ── Refresh the API schema cache so the new tables are visible immediately ──
NOTIFY pgrst, 'reload schema';
