# How to Apply Migration 006 — Multi-Company Data Isolation

## What it does

Adds a `company_id` foreign key to every core data table:

| Table | Effect |
|---|---|
| `bank_accounts` | Bank statements belong to a specific company |
| `transactions` | P&L / ledger entries belong to a company |
| `compliance_items` | GST/TDS deadlines per company |
| `tasks` | Tasks assigned within a company |
| `file_imports` | Import log tagged to a company |
| `vendors` | Vendor master per company |
| `customers` | Customer master per company |

All existing rows are backfilled with **Robotek India Pvt Ltd** (the company with `sort_order = 1`).

## Prerequisites

Run these **first** if you haven't already:

1. `supabase/create_companies_table.sql` — creates the `companies` table and seeds 6 companies
2. `supabase/migrations/005_bank_accounts_and_statements.sql` — creates `bank_accounts` and `bank_statements`

## Steps

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Paste the contents of `supabase/migrations/006_add_company_id.sql`
3. Click **Run**
4. Confirm you see: `Migration 006: Backfill complete — company_id = <uuid>`

## After applying

The app will automatically:

- Tag all new imports with the currently selected company  
- Filter dashboard KPIs, bank statements, compliance, and tasks by company  
- Show "— no data —" on empty company views (e.g. Muskan has no imports yet)

## Rollback (if needed)

```sql
ALTER TABLE public.bank_accounts    DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.transactions     DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.compliance_items DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.tasks            DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.file_imports     DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.vendors          DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.customers        DROP COLUMN IF EXISTS company_id;
```
