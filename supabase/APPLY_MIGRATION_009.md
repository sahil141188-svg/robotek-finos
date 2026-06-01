# Apply Migration 009 — Sales Intelligence (AI Sales Coordinator)

This creates the `sales_*` tables that power the AI SC (Churn Radar, Target-Gap,
Launch/Restock). It does **not** touch any existing finance/accounting tables.

## Step 1 — Create the tables (one-time, ~30 seconds)

1. Open Supabase → **SQL Editor** → New query
   (project: `huvoohwtexhtadmuedno`)
2. Open `supabase/migrations/009_sales_intelligence.sql`, copy the whole file.
3. Paste into the editor → click **Run**.
4. You should see `Success. No rows returned`. Done.

## Step 2 — Backfill order history from the sheets

From the project root:

```bash
# validate parsing only (no DB writes) — optional, already passing:
node scripts/import-sales-orders.mjs --dry

# real import (both sheets):
node scripts/import-sales-orders.mjs

# or just one source:
node scripts/import-sales-orders.mjs --only=backup2026
```

The importer is **idempotent** — safe to run as many times as you like. Each item
line has a `line_hash`, so re-running only inserts genuinely new lines. That same
property makes this the basis of the nightly sync later.

## What gets loaded (validated by dry run)

| | Count |
|---|---|
| Line items | ~33,600 |
| Orders | ~2,727 |
| Customers (firms) | ~122 |
| Products | ~940 |

## Sources

Defined at the top of `scripts/import-sales-orders.mjs` in the `SOURCES` array:

- **backup2026** — `1vWp…Iss1c` gid 343204249 (Jan–Apr 2026, grouped by Order Number)
- **live2024** — `1ArY…JFdQ` gid 0 (Jul–Dec 2024, grouped by Unique Number col I)

➕ **To add the live Vercel-app order tab:** add a new entry to `SOURCES` with its
`sheetId`, `gid`, and column `map`, then re-run the importer.

## Next (after backfill)

- Phase 2: AI SC dashboard pages — Churn Radar + Target-Gap (route `/sales`).
- Mark breakeven items + set `monthly_target_qty` on `sales_products` (Target-Gap input).
