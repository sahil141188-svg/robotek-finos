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
  'sales_coordinator', -- SC: schedules, supports, coordinates (both depts)
  'sales_expert',      -- closes the deal (both depts)
  'crm',               -- CRR: Customer Sales Rep Executive (job title "CRM")
  'fsr',               -- NBD: field sales rep (on-ground visits)
  'sales_head'         -- department head / sales admin
);

create type crm_account_type as enum (
  'dealer', 'distributor', 'retailer', 'oem', 'other'
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
