# Apply the Robotek FinOS Schema to Supabase

## Step 1 — Open the SQL Editor
Go to: https://supabase.com/dashboard/project/huvoohwtexhtadmuedno/sql/new

## Step 2 — Paste and run the migration
Copy the entire contents of `supabase/migrations/001_initial_schema.sql` and run it.

The migration creates:
- `users` — 5-role profiles (ceo, cfo, coo, accounts, ca)
- `file_imports` — tracks every data import with rollback support
- `transactions` — Busy Accounting data (DR/CR, financial year)
- `vendors` — AP master data
- `customers` — AR master data
- `compliance_items` — GST, TDS, TCS, PF, ROC, Advance Tax deadlines
- `tasks` — task management with escalation
- `audit_logs` — append-only action log

All tables have RLS enabled and role-based policies.

## Step 3 — Create your first user
In Supabase Dashboard → Authentication → Users → Invite user.
Then in the SQL editor, set their app_metadata role:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "ceo"}'::jsonb
WHERE email = 'sahil141188@gmail.com';
```

## Step 4 — Seed compliance deadlines (optional for Day 1)
Run the compliance seed script in supabase/seeds/001_compliance_seed.sql after creating it on Day 2.
