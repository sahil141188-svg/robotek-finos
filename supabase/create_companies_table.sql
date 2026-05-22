-- ============================================================
-- Robotek FinOS — Companies table
-- Run this ONCE in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/<your-project>/sql
-- ============================================================

create table if not exists public.companies (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  short_name    text        not null,
  type          text        not null default '',
  city          text        not null default '',
  gstin         text        not null default '',
  color_class   text        not null default 'bg-brand-red',
  status        text        not null default 'active'
                            check (status in ('active', 'dormant')),
  monthly_revenue  bigint   not null default 0,
  ap_outstanding   bigint   not null default 0,
  ar_outstanding   bigint   not null default 0,
  cash_balance     bigint   not null default 0,
  net_pl_monthly   bigint   not null default 0,
  compliance_score integer  not null default 0
                            check (compliance_score >= 0 and compliance_score <= 100),
  employee_count   integer  not null default 0,
  sort_order       integer  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.companies enable row level security;

-- All authenticated users can view companies (needed for the switcher)
create policy "companies_select_authenticated"
  on public.companies for select
  to authenticated
  using (true);

-- Only CEO can insert / update / delete
create policy "companies_mutate_ceo_only"
  on public.companies for all
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and   users.role = 'ceo'
    )
  );

-- ── Seed: current 6 companies ────────────────────────────────────────────────
insert into public.companies
  (name, short_name, type, city, gstin, color_class, status,
   monthly_revenue, ap_outstanding, ar_outstanding, cash_balance,
   net_pl_monthly, compliance_score, employee_count, sort_order)
values
  ('Robotek India Pvt Ltd', 'Robotek',   'Manufacturing — Mobile Accessories', 'Kundli, Haryana', '', 'bg-brand-red',    'active', 18250000, 4650000, 6835000, 5579000, 2840000, 84, 500, 1),
  ('Muskan',                'Muskan',    '', '', '', 'bg-blue-600',    'active', 0, 0, 0, 0, 0, 0, 0, 2),
  ('Yellow',                'Yellow',    '', '', '', 'bg-yellow-500',  'active', 0, 0, 0, 0, 0, 0, 0, 3),
  ('Skyview',               'Skyview',   '', '', '', 'bg-sky-600',     'active', 0, 0, 0, 0, 0, 0, 0, 4),
  ('Yuval Enterprises',     'Yuval Ent', '', '', '', 'bg-emerald-600', 'active', 0, 0, 0, 0, 0, 0, 0, 5),
  ('Yuval Industries',      'Yuval Ind', '', '', '', 'bg-purple-600',  'active', 0, 0, 0, 0, 0, 0, 0, 6);
