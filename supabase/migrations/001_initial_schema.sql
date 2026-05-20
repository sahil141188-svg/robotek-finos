-- ============================================================
-- Robotek FinOS — Initial Database Schema
-- Migration: 001_initial_schema
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ── ENUM TYPES ──────────────────────────────────────────────

create type user_role as enum ('ceo', 'cfo', 'coo', 'accounts', 'ca');

create type dr_cr_type as enum ('DR', 'CR');

create type compliance_status as enum (
  'pending', 'filed', 'paid', 'overdue', 'not_applicable'
);

create type task_status as enum (
  'pending', 'in_progress', 'completed', 'overdue', 'cancelled'
);

create type task_priority as enum ('low', 'medium', 'high', 'urgent');

create type file_type as enum ('xlsx', 'xls', 'csv', 'pdf');

create type import_status as enum (
  'pending', 'processing', 'completed', 'failed', 'rolled_back'
);

-- ── USERS TABLE ─────────────────────────────────────────────
-- Extends Supabase auth.users with role and notification preferences.

create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null unique,
  full_name         text not null,
  role              user_role not null,
  is_active         boolean not null default true,
  whatsapp_number   text,
  notify_whatsapp   boolean not null default false,
  notify_email      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read their own row; ceo/cfo can read all
create policy "users_select_own" on public.users
  for select to authenticated
  using (
    (select auth.uid()) = id
    or (
      select role from public.users where id = (select auth.uid())
    ) in ('ceo', 'cfo')
  );

-- Users can update their own profile
create policy "users_update_own" on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Only ceo can insert new users (invite flow)
create policy "users_insert_ceo" on public.users
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) = 'ceo'
  );

-- ── VENDORS TABLE ───────────────────────────────────────────

create table public.vendors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  gstin               text,
  pan                 text,
  contact_person      text,
  phone               text,
  email               text,
  payment_terms_days  integer not null default 30,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_vendors_name on public.vendors (name);

alter table public.vendors enable row level security;

create policy "vendors_select" on public.vendors
  for select to authenticated using (true);

create policy "vendors_insert_update" on public.vendors
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('accounts', 'cfo', 'coo', 'ceo')
  );

create policy "vendors_update" on public.vendors
  for update to authenticated
  using (true)
  with check (
    (select role from public.users where id = (select auth.uid())) in ('accounts', 'cfo', 'coo', 'ceo')
  );

-- ── CUSTOMERS TABLE ─────────────────────────────────────────

create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  gstin               text,
  pan                 text,
  contact_person      text,
  phone               text,
  email               text,
  credit_limit        numeric(15, 2) not null default 0,
  payment_terms_days  integer not null default 30,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_customers_name on public.customers (name);

alter table public.customers enable row level security;

create policy "customers_select" on public.customers
  for select to authenticated using (true);

create policy "customers_insert_update" on public.customers
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('accounts', 'cfo', 'coo', 'ceo')
  );

create policy "customers_update" on public.customers
  for update to authenticated
  using (true)
  with check (
    (select role from public.users where id = (select auth.uid())) in ('accounts', 'cfo', 'coo', 'ceo')
  );

-- ── FILE_IMPORTS TABLE ──────────────────────────────────────
-- Must be created before transactions (FK reference above).

create table public.file_imports (
  id              uuid primary key default gen_random_uuid(),
  file_name       text not null,
  file_type       file_type not null,
  module          text not null,               -- 'transactions', 'vendors', 'customers', etc.
  uploaded_by     uuid not null references public.users(id),
  status          import_status not null default 'pending',
  rows_imported   integer not null default 0,
  rows_failed     integer not null default 0,
  error_log       text,
  financial_year  text not null,
  can_rollback    boolean not null default true,  -- false after 24 hours
  rolled_back_at  timestamptz,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index idx_file_imports_uploaded_by on public.file_imports (uploaded_by);
create index idx_file_imports_module on public.file_imports (module);
create index idx_file_imports_status on public.file_imports (status);

alter table public.file_imports enable row level security;

create policy "file_imports_select" on public.file_imports
  for select to authenticated using (true);

create policy "file_imports_insert" on public.file_imports
  for insert to authenticated
  with check ((select auth.uid()) = uploaded_by);

create policy "file_imports_update" on public.file_imports
  for update to authenticated
  using ((select auth.uid()) = uploaded_by)
  with check ((select auth.uid()) = uploaded_by);

-- ── COMPLIANCE_ITEMS TABLE ──────────────────────────────────

create table public.compliance_items (
  id                      uuid primary key default gen_random_uuid(),
  category                text not null,               -- 'GST', 'TDS', 'TCS', 'PF', 'ESI', 'ROC', 'Income Tax', 'Advance Tax'
  title                   text not null,
  description             text,
  due_date                date not null,
  status                  compliance_status not null default 'pending',
  financial_year          text not null,
  period                  text,                        -- 'April 2024', 'Q1 FY25', etc.
  assigned_to             uuid references public.users(id),
  filed_date              date,
  acknowledgement_number  text,
  notes                   text,
  is_recurring            boolean not null default true,
  recurrence_rule         text,                        -- RRULE string or 'monthly_7th' etc.
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_compliance_due_date on public.compliance_items (due_date);
create index idx_compliance_category on public.compliance_items (category);
create index idx_compliance_status on public.compliance_items (status);
create index idx_compliance_fy on public.compliance_items (financial_year);

alter table public.compliance_items enable row level security;

-- All authenticated users can view compliance items
create policy "compliance_select" on public.compliance_items
  for select to authenticated using (true);

-- CFO, CEO, CA can insert/update
create policy "compliance_insert" on public.compliance_items
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo', 'ca', 'accounts')
  );

create policy "compliance_update" on public.compliance_items
  for update to authenticated
  using (true)
  with check (
    (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo', 'ca', 'accounts')
  );

-- ── TASKS TABLE ─────────────────────────────────────────────

create table public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  status                task_status not null default 'pending',
  priority              task_priority not null default 'medium',
  assigned_to           uuid references public.users(id),
  assigned_by           uuid references public.users(id),
  due_date              timestamptz,
  completed_at          timestamptz,
  compliance_item_id    uuid references public.compliance_items(id) on delete set null,
  module                text,                -- which module this task belongs to
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_tasks_assigned_to on public.tasks (assigned_to);
create index idx_tasks_status on public.tasks (status);
create index idx_tasks_due_date on public.tasks (due_date);

alter table public.tasks enable row level security;

-- Users see tasks assigned to or by them; cfo/ceo/coo see all
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (
    assigned_to = (select auth.uid())
    or assigned_by = (select auth.uid())
    or (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo', 'coo')
  );

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (
    assigned_by = (select auth.uid())
  );

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (
    assigned_to = (select auth.uid())
    or assigned_by = (select auth.uid())
    or (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo', 'coo')
  )
  with check (
    assigned_to = (select auth.uid())
    or assigned_by = (select auth.uid())
    or (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo', 'coo')
  );

-- ── AUDIT_LOGS TABLE ────────────────────────────────────────
-- Append-only log of all significant user actions.

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id),
  action      text not null,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_user on public.audit_logs (user_id);
create index idx_audit_logs_table on public.audit_logs (table_name);
create index idx_audit_logs_created on public.audit_logs (created_at);

alter table public.audit_logs enable row level security;

-- Only ceo/cfo can read audit logs
create policy "audit_select" on public.audit_logs
  for select to authenticated
  using (
    (select role from public.users where id = (select auth.uid())) in ('ceo', 'cfo')
  );

-- Any authenticated user can insert (their own action)
create policy "audit_insert" on public.audit_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ── TRANSACTIONS TABLE ──────────────────────────────────────
-- Created after file_imports so the FK reference resolves correctly.

create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  voucher_number   text,
  voucher_type     text not null,               -- Sales, Purchase, Payment, Receipt, Journal, etc.
  ledger_name      text not null,
  amount           numeric(15, 2) not null check (amount >= 0),
  dr_cr            dr_cr_type not null,
  narration        text,
  financial_year   text not null,               -- e.g. "2024-25"
  import_id        uuid references public.file_imports(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index idx_transactions_date on public.transactions (transaction_date);
create index idx_transactions_ledger on public.transactions (ledger_name);
create index idx_transactions_fy on public.transactions (financial_year);
create index idx_transactions_voucher_type on public.transactions (voucher_type);
create index idx_transactions_import on public.transactions (import_id);

alter table public.transactions enable row level security;

-- All authenticated users can view transactions; accounts/cfo/ceo can insert
create policy "transactions_select" on public.transactions
  for select to authenticated using (true);

create policy "transactions_insert" on public.transactions
  for insert to authenticated
  with check (
    (select role from public.users where id = (select auth.uid())) in ('accounts', 'cfo', 'ceo')
  );

create policy "transactions_delete" on public.transactions
  for delete to authenticated
  using (
    (select role from public.users where id = (select auth.uid())) in ('cfo', 'ceo')
  );

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
-- Auto-updates the updated_at column on any table that has it.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger vendors_updated_at
  before update on public.vendors
  for each row execute function public.handle_updated_at();

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.handle_updated_at();

create trigger compliance_updated_at
  before update on public.compliance_items
  for each row execute function public.handle_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ── AUTO-CREATE USER PROFILE ON SIGNUP ─────────────────────
-- When a user signs up via Supabase Auth, create their public.users row.
-- The role is read from auth app_metadata (set server-side, never user-editable).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security invoker
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(
      (new.raw_app_meta_data->>'role')::user_role,
      'accounts'::user_role
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── GRANT DATA API ACCESS ───────────────────────────────────
-- Expose tables to the REST/Data API for anon + authenticated roles.
-- RLS policies above control which rows are visible.

grant select on public.users to authenticated;
grant insert, update on public.users to authenticated;

grant select on public.transactions to authenticated;
grant insert, delete on public.transactions to authenticated;

grant select on public.vendors to authenticated;
grant insert, update on public.vendors to authenticated;

grant select on public.customers to authenticated;
grant insert, update on public.customers to authenticated;

grant select on public.compliance_items to authenticated;
grant insert, update on public.compliance_items to authenticated;

grant select on public.tasks to authenticated;
grant insert, update on public.tasks to authenticated;

grant select on public.file_imports to authenticated;
grant insert, update on public.file_imports to authenticated;

grant select on public.audit_logs to authenticated;
grant insert on public.audit_logs to authenticated;
