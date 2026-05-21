/**
 * Robotek FinOS — One-time setup script.
 * Applies migration 002 (permissions column) and creates the CEO user.
 *
 * Run: node scripts/setup.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

// Load .env.local
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SVC) {
  console.error("❌  Missing env vars. Check .env.local");
  process.exit(1);
}

const admin = createClient(URL, SVC, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Create CEO user via Supabase Auth admin ───────────────────────────
console.log("\n📧  Creating CEO user (sahil141188@gmail.com)…");

const { data: authData, error: authErr } = await admin.auth.admin.createUser({
  email: "sahil141188@gmail.com",
  password: "Robotek@2024",          // Temporary — user should change after first login
  email_confirm: true,               // Skip email confirmation
  user_metadata: { full_name: "Sahil Aggarwal" },
  app_metadata: { role: "ceo" },
});

if (authErr && !authErr.message.includes("already been registered")) {
  console.error("❌  Auth error:", authErr.message);
} else if (authErr) {
  console.log("ℹ️   CEO auth user already exists — skipping create.");
} else {
  console.log("✅  Auth user created:", authData.user.id);

  // Upsert profile row
  await admin.from("users").upsert({
    id:          authData.user.id,
    email:       "sahil141188@gmail.com",
    full_name:   "Sahil Aggarwal",
    role:        "ceo",
    is_active:   true,
    permissions: {
      view_dashboard:   true,
      import_data:      true,
      view_compliance:  true,
      manage_tasks:     true,
      view_payables:    true,
      view_receivables: true,
      view_review:      true,
      view_alerts:      true,
      admin_users:      true,
    },
  });
  console.log("✅  Profile row upserted.");
}

// ── 2. Check if permissions column already exists ─────────────────────────
console.log("\n🔍  Checking permissions column…");
const { error: colCheck } = await admin.from("users").select("permissions").limit(1);

if (!colCheck) {
  console.log("✅  permissions column already exists — migration 002 not needed.");
  console.log("\n🎉  Setup complete! Login at http://localhost:3000/login");
  console.log("    Email:    sahil141188@gmail.com");
  console.log("    Password: Robotek@2024  (change this after first login)");
  process.exit(0);
}

// ── 3. Apply migration 002 via SQL file ──────────────────────────────────
console.log("⚠️   permissions column missing.");
console.log("\n📋  Migration 002 SQL to paste into Supabase SQL Editor:");
console.log("    https://supabase.com/dashboard/project/huvoohwtexhtadmuedno/sql/new\n");
console.log("────────────────────────────────────────────────────────────────");

const migration = `
-- Add permissions column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "view_dashboard":    true,
    "import_data":       false,
    "view_compliance":   false,
    "manage_tasks":      false,
    "view_payables":     false,
    "view_receivables":  false,
    "view_review":       false,
    "view_alerts":       true,
    "admin_users":       false
  }'::jsonb;

-- Set CEO permissions
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":true}'::jsonb WHERE role = 'ceo';

-- Set CFO permissions
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":true,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'cfo';

-- Set Accounts permissions
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":true,"view_compliance":true,"manage_tasks":true,"view_payables":true,"view_receivables":true,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'accounts';

-- Set CA permissions
UPDATE public.users SET permissions = '{"view_dashboard":true,"import_data":false,"view_compliance":true,"manage_tasks":true,"view_payables":false,"view_receivables":false,"view_review":false,"view_alerts":true,"admin_users":false}'::jsonb WHERE role = 'ca';
`.trim();

console.log(migration);
console.log("────────────────────────────────────────────────────────────────");
console.log("\n👆  Paste the SQL above in the Supabase SQL Editor and click Run.");
console.log("    Then re-run: node scripts/setup.mjs to verify.");
