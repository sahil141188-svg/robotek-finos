-- ============================================================
-- Migration 005: Add bank_accounts and bank_statements tables
-- ============================================================
-- Stores imported bank statement data with metadata extraction.
-- Integrates with the bank statement parser system.
-- ============================================================

-- ── Create ENUM for transaction categories ─────────────────
create type bank_txn_category as enum (
  'customer_receipt',
  'vendor_payment',
  'payroll',
  'tax_payment',
  'bank_charges',
  'interest_income',
  'inter_account_transfer',
  'other_debit',
  'other_credit'
);

-- ── BANK_ACCOUNTS TABLE ────────────────────────────────────
-- Stores metadata extracted from bank statements
-- account_number is masked; account_number_last4 is displayed

create table public.bank_accounts (
  id                    uuid primary key default gen_random_uuid(),
  bank_name             text not null,
  account_number        text not null,               -- Full account number (masked in UI)
  account_number_last4  text not null,               -- Last 4 digits for display
  account_type          text not null,               -- 'current', 'savings', 'od', 'cc'
  account_holder_name   text,
  ifsc_code             text,
  micr_code             text,
  branch                text,
  opening_balance       numeric(15, 2) not null default 0,  -- In paisa (divide by 100 for display)
  closing_balance       numeric(15, 2) not null default 0,  -- In paisa
  period_start          date,
  period_end            date,
  statement_date        date,
  currency              text not null default 'INR',
  is_primary            boolean not null default false,
  import_id             uuid references public.file_imports(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Constraint: account_number_last4 should be last 4 digits of account_number
  -- (validated on insert via trigger if needed)
  constraint unique_account_per_import unique (account_number, import_id)
);

create index idx_bank_accounts_bank_name on public.bank_accounts (bank_name);
create index idx_bank_accounts_account_number on public.bank_accounts (account_number);
create index idx_bank_accounts_import on public.bank_accounts (import_id);
create index idx_bank_accounts_period on public.bank_accounts (period_start, period_end);

alter table public.bank_accounts enable row level security;

-- All authenticated users can view bank accounts
create policy "bank_accounts_select" on public.bank_accounts
  for select to authenticated using (true);

-- Only accounts/cfo/ceo can insert (during import)
create policy "bank_accounts_insert" on public.bank_accounts
  for insert to authenticated
  with check (
    (select public.get_my_role()) in ('accounts', 'cfo', 'ceo')
  );

-- Only cfo/ceo can update
create policy "bank_accounts_update" on public.bank_accounts
  for update to authenticated
  using (
    (select public.get_my_role()) in ('cfo', 'ceo')
  )
  with check (
    (select public.get_my_role()) in ('cfo', 'ceo')
  );

-- ── BANK_STATEMENTS TABLE ──────────────────────────────────
-- Stores individual transactions from bank statements

create table public.bank_statements (
  id                uuid primary key default gen_random_uuid(),
  bank_account_id   uuid not null references public.bank_accounts(id) on delete cascade,
  transaction_date  date not null,
  value_date        date,
  description       text not null,
  debit             numeric(15, 2) not null default 0,       -- In paisa
  credit            numeric(15, 2) not null default 0,       -- In paisa
  balance           numeric(15, 2),                           -- Running balance after txn (in paisa)
  category          bank_txn_category,
  reference         text,                                      -- Bank reference/cheque number
  counterparty      text,                                      -- Vendor/customer name
  import_id         uuid references public.file_imports(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_bank_statements_account_id on public.bank_statements (bank_account_id);
create index idx_bank_statements_transaction_date on public.bank_statements (transaction_date);
create index idx_bank_statements_category on public.bank_statements (category);
create index idx_bank_statements_import on public.bank_statements (import_id);
create index idx_bank_statements_balance on public.bank_statements (balance);

alter table public.bank_statements enable row level security;

-- All authenticated users can view transactions
create policy "bank_statements_select" on public.bank_statements
  for select to authenticated using (true);

-- Only accounts/cfo/ceo can insert (during import)
create policy "bank_statements_insert" on public.bank_statements
  for insert to authenticated
  with check (
    (select public.get_my_role()) in ('accounts', 'cfo', 'ceo')
  );

-- ── Add updated_at trigger for bank_accounts ───────────────
create trigger bank_accounts_updated_at
  before update on public.bank_accounts
  for each row execute function public.handle_updated_at();

-- ── Grant Data API access ──────────────────────────────────
grant select on public.bank_accounts to authenticated;
grant insert, update on public.bank_accounts to authenticated;

grant select on public.bank_statements to authenticated;
grant insert on public.bank_statements to authenticated;

grant usage on type public.bank_txn_category to authenticated;
