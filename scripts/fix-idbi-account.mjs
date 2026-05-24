/**
 * One-time fix — correct the IDBI account stored as "HDFC Bank ···1811"
 *
 * Problem: IDBI APRIL.pdf was imported but the bank detection misfired,
 * storing the account as "HDFC Bank" with the wrong bank name.
 * The closing_balance of 400 paisa (₹4.00) is also clearly wrong.
 *
 * This script:
 *   1. Finds the misidentified account (bank_name = "HDFC Bank", last4 = "1811")
 *   2. Derives the correct closing balance from the last bank_statements row
 *   3. Updates bank_name → "IDBI Bank", account_type → "savings",
 *      closing_balance → derived from last transaction
 *
 * Run: node scripts/fix-idbi-account.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://huvoohwtexhtadmuedno.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dm9vaHd0ZXhodGFkbXVlZG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI4NTM5NCwiZXhwIjoyMDk0ODYxMzk0fQ.J3r547_1JKQzadZwVeY1_CISKFuB1fmXKhTlULs3HB0";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("=== Fix IDBI Account ===\n");

  // 1. Find all bank accounts
  const { data: accounts, error: accErr } = await db
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_number_last4, account_type, opening_balance, closing_balance, period_start, period_end");

  if (accErr) { console.error("Error fetching accounts:", accErr.message); process.exit(1); }

  console.log("Current bank accounts:");
  for (const a of accounts) {
    const open  = (a.opening_balance / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const close = (a.closing_balance  / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    console.log(`  ${a.id} | ${a.bank_name.padEnd(12)} | ···${a.account_number_last4} | ${a.account_type?.padEnd(8)} | open=₹${open} | close=₹${close}`);
  }

  // 2. Find the misidentified IDBI account (stored as HDFC Bank ···1811)
  const target = accounts.find(
    (a) => a.account_number_last4 === "1811" && a.bank_name === "HDFC Bank"
  );

  if (!target) {
    // Try just by last4 in case bank_name was already fixed
    const byLast4 = accounts.find((a) => a.account_number_last4 === "1811");
    if (byLast4) {
      console.log(`\n⚠️  Account ···1811 found but bank_name is already "${byLast4.bank_name}" — may already be fixed.`);
    } else {
      console.log("\n⚠️  No account with last4=1811 found. Nothing to fix.");
    }
    process.exit(0);
  }

  console.log(`\nTarget account to fix: ${target.id} (${target.bank_name} ···${target.account_number_last4})`);

  // 3. Get transaction count and last balance for this account
  const { data: lastTxn, error: txnErr } = await db
    .from("bank_statements")
    .select("transaction_date, balance, debit, credit")
    .eq("bank_account_id", target.id)
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(5);

  if (txnErr) {
    console.error("Error fetching transactions:", txnErr.message);
  } else {
    console.log("\nLast 5 transactions for this account:");
    for (const t of lastTxn) {
      console.log(`  date=${t.transaction_date} | debit=${t.debit} | credit=${t.credit} | balance=${t.balance}`);
    }
  }

  const { count: txnCount } = await db
    .from("bank_statements")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", target.id);

  console.log(`\nTotal transactions: ${txnCount}`);

  // 4. Derive correct closing balance from last transaction's balance column
  const lastBalance = lastTxn?.[0]?.balance ?? null;
  const newClosingBalance = lastBalance && lastBalance > 400 ? lastBalance : target.closing_balance;

  console.log(`\nDerived closing balance: ${newClosingBalance} paisa = ₹${(newClosingBalance / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

  // 5. Apply fix
  const updates = {
    bank_name:       "IDBI Bank",
    account_type:    "savings",
    closing_balance: newClosingBalance,
  };

  console.log("\nApplying update:", updates);

  const { error: updateErr } = await db
    .from("bank_accounts")
    .update(updates)
    .eq("id", target.id);

  if (updateErr) {
    console.error("❌ Update failed:", updateErr.message);
    process.exit(1);
  }

  console.log("✅ Account updated successfully.");

  // 6. Verify
  const { data: fixed } = await db
    .from("bank_accounts")
    .select("bank_name, account_number_last4, account_type, closing_balance")
    .eq("id", target.id)
    .single();

  if (fixed) {
    console.log(`\nVerification: ${fixed.bank_name} ···${fixed.account_number_last4} | ${fixed.account_type} | ₹${(fixed.closing_balance / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  }
}

main().catch(console.error);
