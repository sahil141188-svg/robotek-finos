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
