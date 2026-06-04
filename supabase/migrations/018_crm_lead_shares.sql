-- ============================================================
-- Robotek FinOS — NBD: forward / transfer a lead's details
-- Migration: 018_crm_lead_shares
-- ============================================================
-- An SC can forward a lead (name, phone, query, conversation) to an FSR /
-- Sales Expert, or TRANSFER it to a Super Stockist (existing customer) — e.g.
-- when an enquiry comes from an area where we already have an SS. The
-- recipient then connects with the lead by phone. We log every share for trail.

create type crm_share_type as enum ('fsr', 'sales_expert', 'ss', 'other');

create table public.crm_lead_shares (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.crm_leads(id) on delete cascade,
  share_type    crm_share_type not null,
  to_user_id    uuid references public.users(id) on delete set null,        -- FSR / Sales Expert
  to_account_id uuid references public.crm_accounts(id) on delete set null, -- Super Stockist account
  to_name       text,            -- snapshot of recipient name
  channel       text not null default 'whatsapp',
  message       text,            -- the details + query that were shared
  shared_by     uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_crm_lead_shares_lead on public.crm_lead_shares (lead_id);

alter table public.crm_lead_shares enable row level security;
create policy "crm_lead_shares_select" on public.crm_lead_shares for select to authenticated using (true);
create policy "crm_lead_shares_insert" on public.crm_lead_shares for insert to authenticated with check (public.can_write_crm());

grant select, insert on public.crm_lead_shares to authenticated;
