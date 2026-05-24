/**
 * One-time cleanup script — fix phantom bank accounts created by Kotak PDF import.
 *
 * Problem: The Kotak statement parser picked up HDFC/ICICI counterparty bank names
 * from transaction descriptions and created phantom bank_account rows for them.
 * Result: 4 accounts instead of 1 — 3 are phantoms.
 *
 * This script:
 *   1. Lists all bank_accounts so we can see what's there
 *   2. Keeps the real Kotak account (highest closing_balance)
 *   3. Fixes its account_type if it is blank/unknown
 *   4. Deletes phantom accounts + their bank_statements rows (cascade)
 *
 * Run: node scripts/fix-bank-accounts.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://huvoohwtexhtadmuedno.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dm9vaHd0ZXhodGFkbXVlZG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI4NTM5NCwiZXhwIjoyMDk0ODYxMzk0fQ.J3r547_1JKQzadZwVeY1_CISKFuB1fmXKhTlULs3HB0";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("=== Bank Account Cleanup ===\n");

  // 1. Fetch all accounts
  const { data: accounts, error } = await db
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_number_last4, account_type, closing_balance, opening_balance")
    .order("closing_balance", { ascending: false });

  if (error) {
    console.error("Failed to fetch accounts:", error.message);
    process.exit(1);
  }

  console.log(`Found ${accounts.length} account(s):\n`);
  accounts.forEach((a, i) => {
    console.log(
      `  [${i + 1}] ${a.bank_name} ···${a.account_number_last4} | type: ${a.account_type} | closing: ₹${(a.closing_balance / 100).toFixed(2)} | id: ${a.id}`
    );
  });

  // 2. Identify the real Kotak account — it has the largest balance and bank_name contains "Kotak"
  const kotakAccount = accounts.find((a) =>
    a.bank_name?.toLowerCase().includes("kotak")
  );

  if (!kotakAccount) {
    console.error("\n❌ Could not find a Kotak account — aborting to be safe.");
    process.exit(1);
  }

  console.log(`\n✓ Real account identified: ${kotakAccount.bank_name} ···${kotakAccount.account_number_last4} (id: ${kotakAccount.id})`);

  // 3. Fix account_type on the Kotak account if it is blank or "unknown"
  const needsTypefix =
    !kotakAccount.account_type ||
    kotakAccount.account_type.toLowerCase() === "unknown";

  if (needsTypefix) {
    const { error: typeErr } = await db
      .from("bank_accounts")
      .update({ account_type: "current" })
      .eq("id", kotakAccount.id);

    if (typeErr) {
      console.error("Failed to fix account_type:", typeErr.message);
    } else {
      console.log(`✓ Fixed account_type → "current" for ${kotakAccount.bank_name}`);
    }
  } else {
    console.log(`  account_type already OK: "${kotakAccount.account_type}"`);
  }

  // 4. Delete phantom accounts
  const phantoms = accounts.filter((a) => a.id !== kotakAccount.id);

  if (phantoms.length === 0) {
    console.log("\n✓ No phantom accounts to delete.");
  } else {
    console.log(`\nDeleting ${phantoms.length} phantom account(s)...`);

    for (const phantom of phantoms) {
      // Delete bank_statements first (FK constraint)
      const { error: stmtErr, count: stmtCount } = await db
        .from("bank_statements")
        .delete({ count: "exact" })
        .eq("bank_account_id", phantom.id);

      if (stmtErr) {
        console.error(`  ❌ Failed to delete statements for ${phantom.id}:`, stmtErr.message);
        continue;
      }
      console.log(`  Deleted ${stmtCount ?? 0} statement rows for phantom ${phantom.bank_name} ···${phantom.account_number_last4}`);

      // Delete the account
      const { error: acctErr } = await db
        .from("bank_accounts")
        .delete()
        .eq("id", phantom.id);

      if (acctErr) {
        console.error(`  ❌ Failed to delete account ${phantom.id}:`, acctErr.message);
      } else {
        console.log(`  ✓ Deleted phantom account: ${phantom.bank_name} ···${phantom.account_number_last4}`);
      }
    }
  }

  // 5. Final state
  const { data: final } = await db
    .from("bank_accounts")
    .select("id, bank_name, account_number_last4, account_type, closing_balance");

  console.log(`\n=== Final state (${final?.length ?? 0} account(s)) ===`);
  final?.forEach((a) => {
    console.log(
      `  ${a.bank_name} ···${a.account_number_last4} | type: ${a.account_type} | closing: ₹${(a.closing_balance / 100).toFixed(2)}`
    );
  });

  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
