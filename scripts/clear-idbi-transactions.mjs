/**
 * Clear IDBI bank_statements rows so the user can re-import with the
 * corrected parser (which now picks up real amounts instead of NEFT
 * reference number fragments like "721" from "007721529111").
 *
 * The bank_accounts row for IDBI is kept intact (correct bank name,
 * closing balance from the PDF).  Only the individual transaction rows
 * are deleted — re-importing the PDF will recreate them correctly.
 *
 * Run: node scripts/clear-idbi-transactions.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://huvoohwtexhtadmuedno.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dm9vaHd0ZXhodGFkbXVlZG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI4NTM5NCwiZXhwIjoyMDk0ODYxMzk0fQ.J3r547_1JKQzadZwVeY1_CISKFuB1fmXKhTlULs3HB0";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("=== Clear IDBI Transactions for Re-import ===\n");

  // Find the IDBI account
  const { data: acct } = await db
    .from("bank_accounts")
    .select("id, bank_name, account_number_last4")
    .eq("bank_name", "IDBI Bank")
    .single();

  if (!acct) {
    console.log("❌ IDBI Bank account not found. Run fix-idbi-account.mjs first.");
    process.exit(1);
  }

  console.log(`Found: ${acct.bank_name} ···${acct.account_number_last4} (id: ${acct.id})`);

  // Count current transactions
  const { count: before } = await db
    .from("bank_statements")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", acct.id);

  console.log(`Current transaction rows: ${before}`);

  // Delete all transactions for this account
  const { error } = await db
    .from("bank_statements")
    .delete()
    .eq("bank_account_id", acct.id);

  if (error) {
    console.error("❌ Delete failed:", error.message);
    process.exit(1);
  }

  // Also clear the file_imports records so re-import is treated as fresh
  const { data: imports } = await db
    .from("file_imports")
    .select("id, file_name")
    .eq("module", "banking")
    .ilike("file_name", "%idbi%");

  if (imports?.length) {
    console.log(`\nClearing ${imports.length} IDBI import record(s):`, imports.map(i => i.file_name));
    await db.from("file_imports").delete().in("id", imports.map(i => i.id));
  }

  console.log("\n✅ IDBI transactions cleared.");
  console.log("\nNext step: go to Import Data and re-upload the IDBI APRIL.pdf.");
  console.log("The fixed parser will correctly extract amounts (₹12,980, ₹98,518, etc.)");
  console.log("instead of NEFT reference fragments (₹721, ₹529, etc.)");
}

main().catch(console.error);
