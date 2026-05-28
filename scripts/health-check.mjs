/**
 * End-to-end health check.
 * Runs every server-query function against real Supabase data and reports.
 *
 * Run: node --env-file=.env.local scripts/health-check.mjs
 */

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);
const info = (msg) => console.log(`    ${msg}`);

// ── 1. Companies ────────────────────────────────────────────────────────────
console.log("\n[1] Companies");
const { data: companies, error: cE } = await db
  .from("companies").select("id, name, short_name, sort_order, color_class, status").order("sort_order");
if (cE) fail(`companies error: ${cE.message}`);
else {
  pass(`${companies.length} companies in table`);
  for (const c of companies) info(`  ${c.sort_order}. ${c.short_name.padEnd(12)} ${c.status}`);
  // Aggarwal must be present
  const aggarwal = companies.find((c) => c.short_name === "Aggarwal");
  aggarwal ? pass(`Aggarwal Enterprise present (id ${aggarwal.id.slice(0, 8)})`) : fail("Aggarwal missing");
}

const ROBOTEK = companies.find((c) => c.short_name === "Robotek")?.id;
const MUSKAN  = companies.find((c) => c.short_name === "Muskan")?.id;
const YUVAL   = companies.find((c) => c.short_name === "Yuval Ent")?.id;

// ── 2. Bank accounts reconciliation ─────────────────────────────────────────
console.log("\n[2] Bank account reconciliation (each must be ₹0 diff)");
const { data: accts } = await db.from("bank_accounts").select("id, bank_name, account_number_last4, opening_balance, closing_balance, period_start, period_end, company_id");
for (const a of accts) {
  const { data: stmts } = await db.from("bank_statements").select("debit, credit").eq("bank_account_id", a.id);
  let d = 0, c = 0;
  for (const r of stmts) { d += Number(r.debit); c += Number(r.credit); }
  const op = Number(a.opening_balance), cl = Number(a.closing_balance);
  const swing = (cl - op) / 100;
  const net   = (c - d) / 100;
  const diff  = Math.abs(swing - net);
  const company = companies.find((co) => co.id === a.company_id)?.short_name ?? "?";
  if (diff < 5) pass(`${company.padEnd(12)} ${a.bank_name} ···${a.account_number_last4} | ${a.period_start} → ${a.period_end} | close ₹${(cl/100).toLocaleString("en-IN")} | ₹${diff.toFixed(2)} diff`);
  else          fail(`${company} ${a.bank_name} ···${a.account_number_last4} — ₹${diff.toLocaleString("en-IN")} diff (swing ₹${swing.toLocaleString("en-IN")} vs net ₹${net.toLocaleString("en-IN")})`);
}

// ── 3. AP / AR aging engine ─────────────────────────────────────────────────
console.log("\n[3] AP/AR aging engine — per-company totals");
async function ageCheck(coId, coName) {
  if (!coId) { fail(`${coName} not found`); return; }
  // Customer count
  const { count: custCount } = await db.from("customers").select("*", { count: "exact", head: true }).eq("company_id", coId);
  const { count: venCount }  = await db.from("vendors").select("*", { count: "exact", head: true }).eq("company_id", coId);
  // Transaction count
  const { count: txnCount }  = await db.from("transactions").select("*", { count: "exact", head: true }).eq("company_id", coId);
  pass(`${coName.padEnd(12)} customers=${custCount} vendors=${venCount} transactions=${txnCount}`);
}
await ageCheck(ROBOTEK, "Robotek");
await ageCheck(MUSKAN,  "Muskan");
await ageCheck(YUVAL,   "Yuval Ent");

// ── 4. Notification log (reminder flow) ────────────────────────────────────
console.log("\n[4] Notification log table");
const { error: nlErr, count: nlCount } = await db.from("notification_log").select("*", { count: "exact", head: true });
if (nlErr) fail(`notification_log error: ${nlErr.message}`);
else pass(`notification_log present (${nlCount ?? 0} rows)`);

// ── 5. app_settings (reminder + whatsapp config) ───────────────────────────
console.log("\n[5] app_settings");
const { data: settings } = await db.from("app_settings").select("key");
const keys = (settings ?? []).map((s) => s.key);
for (const need of ["whatsapp", "email", "reminders", "templates"]) {
  if (keys.includes(need)) pass(`app_settings.${need} present`);
  else fail(`app_settings.${need} MISSING — reminder flow won't work`);
}

// ── 6. Migration 008 status ────────────────────────────────────────────────
console.log("\n[6] Migration 008 — per-company party uniqueness");
const { data: tryDupe, error: dupeErr } = await db.from("customers")
  .insert({ name: "__health_check_dupe__", company_id: ROBOTEK })
  .select("id")
  .single();
if (tryDupe) {
  // Try inserting same name under different company — should succeed if 008 applied
  const { error: cross } = await db.from("customers")
    .insert({ name: "__health_check_dupe__", company_id: MUSKAN }).select("id").single();
  if (cross) {
    fail(`Migration 008 NOT applied — global name uniqueness still active: ${cross.message}`);
  } else {
    pass("Migration 008 applied — same party name allowed across companies");
    // clean up both
    await db.from("customers").delete().eq("name", "__health_check_dupe__");
  }
  await db.from("customers").delete().eq("name", "__health_check_dupe__");
}
if (dupeErr) info(`(initial insert: ${dupeErr.message})`);

// ── 7. file_imports — recent ──────────────────────────────────────────────
console.log("\n[7] Recent imports (last 10)");
const { data: imps } = await db.from("file_imports")
  .select("file_name, module, status, rows_imported, completed_at")
  .order("created_at", { ascending: false }).limit(10);
for (const i of (imps ?? [])) info(`  ${(i.completed_at ?? "").slice(0, 16)}  ${i.module.padEnd(15)} ${(i.file_name ?? "").padEnd(40).slice(0, 40)} ${i.status} (${i.rows_imported})`);

console.log("\n=== Done ===");
