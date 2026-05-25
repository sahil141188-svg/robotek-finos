"use server";

/**
 * Bank Statement Import — Server Action
 *
 * Handles storing bank account metadata and statements to the database.
 * Called during the import flow when a PDF bank statement is uploaded.
 *
 * Imports:
 * 1. Bank account metadata (bank_accounts table)
 * 2. Individual transactions (bank_statements table)
 *
 * Unit contract (IMPORTANT — do not change without updating all parsers):
 *   BankAccountMetadata.openingBalance / closingBalance → already in PAISA
 *     (parsers call `amount * 100` before setting these fields)
 *   RawRow.Debit / Credit / Balance → in RUPEES (raw from PDF text)
 *     (import-banking converts to paisa with * 100 before storing)
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import type { BankAccountMetadata } from "./parsers/types";
import type { RawRow } from "@/lib/import-utils";

// Type definitions for bank tables (not yet in auto-generated Database type)
interface BankAccountInsert {
  bank_name: string;
  account_number: string;
  account_number_last4: string;
  account_type: string;
  account_holder_name?: string | null;
  ifsc_code?: string | null;
  micr_code?: string | null;
  branch?: string | null;
  opening_balance?: number;
  closing_balance?: number;
  period_start?: string | null;
  period_end?: string | null;
  statement_date?: string | null;
  currency?: string;
  is_primary?: boolean;
  import_id?: string;
  company_id?: string | null;
}

interface BankStatementInsert {
  bank_account_id: string;
  transaction_date?: string | number;
  value_date?: string | null;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number | null;
  category?: string | null;
  reference?: string | null;
  counterparty?: string | null;
  import_id?: string;
}

export type BankImportResult = {
  success: boolean;
  importId: string | null;
  bankAccountId: string | null;
  accountsImported: number;
  transactionsImported: number;
  errors: string[];
};

/**
 * Import bank account metadata and statements
 *
 * @param bankMetadata    Extracted bank account metadata from parser
 * @param transactions    Transaction rows from bank statement
 * @param fileName        Original PDF file name
 */
export async function importBankStatement(
  bankMetadata: BankAccountMetadata | null,
  transactions: RawRow[],
  fileName: string,
): Promise<BankImportResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      importId: null,
      bankAccountId: null,
      accountsImported: 0,
      transactionsImported: 0,
      errors: ["Not authenticated"],
    };
  }

  // Read the company the user currently has selected in the switcher.
  // null = "All Companies" — fall back to the first company in the DB.
  const selectedCompanyId = await getSelectedCompanyId();

  // If "All Companies" (null), try to resolve the primary company automatically.
  let companyId: string | null = selectedCompanyId;
  if (!companyId) {
    const { data: firstCompany } = await (supabase as any)
      .from("companies")
      .select("id")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle() as { data: { id: string } | null };
    companyId = firstCompany?.id ?? null;
  }

  const errors: string[] = [];

  // ── Create file_imports audit record ──────────────────────────────────────

  // FIX N12: Correct FY calculation (Apr-Mar). Old code: getFullYear() > 3 is always true.
  const _now = new Date();
  const _fyStart = _now.getMonth() >= 3 ? _now.getFullYear() : _now.getFullYear() - 1;
  const financialYear = `${_fyStart}-${String(_fyStart + 1).slice(-2)}`;

  // Detect file type from extension for accurate audit logging
  const fileExt = fileName.split(".").pop()?.toLowerCase() ?? "unknown";
  const fileType = ["xlsx", "xls", "csv"].includes(fileExt) ? "excel" : "pdf";

  const { data: importRecord, error: importErr } = await db
    .from("file_imports")
    .insert({
      file_name: fileName,
      file_type: fileType,
      module: "banking",
      uploaded_by: user.id,
      status: "processing",
      rows_imported: 0,
      rows_failed: 0,
      financial_year: financialYear,
      can_rollback: true,
      ...(companyId ? { company_id: companyId } : {}),
    })
    .select("id")
    .single();

  if (importErr || !importRecord) {
    return {
      success: false,
      importId: null,
      bankAccountId: null,
      accountsImported: 0,
      transactionsImported: 0,
      errors: [`Failed to create import record: ${importErr?.message}`],
    };
  }

  const importId = importRecord.id;
  let accountsImported = 0;
  let transactionsImported = 0;
  let bankAccountId: string | null = null;

  // ── Import bank account metadata ──────────────────────────────────────────
  // For PDF imports: bankMetadata is extracted by the parser (rich — bank name, acct number, etc.)
  // For Excel imports: bankMetadata is null — we infer the bank name from the filename and
  //   create a placeholder account so transactions can still be stored and shown on the dashboard.

  if (bankMetadata) {
    try {
      const accountNumber = bankMetadata.accountNumber || "UNKNOWN";
      const last4 = accountNumber.slice(-4) || "0000";

      // FIX B6: Check for an existing account with the same account number before inserting.
      // The DB unique constraint is (account_number, import_id) — NOT per account_number alone —
      // so re-uploading the same statement would create a duplicate without this guard.
      const { data: existingAcct } = await db
        .from("bank_accounts")
        .select("id")
        .eq("account_number", accountNumber)
        .maybeSingle();

      if (existingAcct) {
        // Account already imported — reuse it for the new transactions
        bankAccountId = existingAcct.id;
        accountsImported = 0; // not a new account
        console.log("[import-banking] Account already exists, reusing id:", bankAccountId);
      } else {
        const insertData: BankAccountInsert = {
          bank_name: bankMetadata.bankName,
          account_number: accountNumber,
          account_number_last4: last4,
          // FIX B2: Parsers return "CURRENT" / "SAVINGS" (uppercase).
          // UI lookup table uses lowercase keys ("current", "savings").
          // Normalise here to prevent "Unknown" showing in account cards.
          account_type: (bankMetadata.accountType || "current").toLowerCase(),
          account_holder_name: bankMetadata.accountHolderName,
          ifsc_code: bankMetadata.ifscCode,
          micr_code: bankMetadata.micrCode,
          branch: bankMetadata.branch,
          // FIX B5: Parsers ALREADY return values in paisa (they do `amount * 100` inside).
          // Do NOT multiply by 100 again — that inflates balances 100×.
          opening_balance: Math.round(bankMetadata.openingBalance || 0),
          closing_balance: Math.round(bankMetadata.closingBalance || 0),
          period_start: bankMetadata.periodStart,
          period_end: bankMetadata.periodEnd,
          statement_date: bankMetadata.statementDate || bankMetadata.periodEnd,
          currency: bankMetadata.currency || "INR",
          is_primary: false,
          import_id: importId,
          // Tag with the currently selected company so data is isolated per subsidiary.
          ...(companyId ? { company_id: companyId } : {}),
        };

        const { data: acctData, error: acctErr } = await db
          .from("bank_accounts")
          .insert(insertData)
          .select("id")
          .single();

        if (acctErr) {
          errors.push(`Failed to import bank account: ${acctErr.message}`);
        } else if (acctData) {
          bankAccountId = acctData.id;
          accountsImported = 1;
          console.log("[import-banking] ✓ Imported bank account:", {
            id: bankAccountId,
            bank: bankMetadata.bankName,
            account: accountNumber.slice(-4),
          });
        }
      }
    } catch (err) {
      errors.push(`Error importing bank account: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (transactions.length > 0) {
    // ── Excel upload: no PDF metadata — infer bank name from filename ──────
    // Create a minimal bank account record so transactions have a valid foreign key.
    try {
      const fileBase = fileName.replace(/\.[^.]+$/, ""); // strip extension

      // Try to detect known bank names in the filename (case-insensitive)
      const KNOWN_BANKS = [
        "HDFC", "ICICI", "SBI", "Axis", "Kotak", "IDBI",
        "PNB", "BOI", "Canara", "Union", "Yes Bank", "IndusInd",
        "Federal", "IOB", "UCO",
      ];
      const fileUpper = fileBase.toUpperCase();
      const matched = KNOWN_BANKS.find((b) => fileUpper.includes(b.toUpperCase()));
      const bankName = matched
        ? (matched.toLowerCase().includes("bank") ? matched : `${matched} Bank`)
        : fileBase.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // Generate a pseudo account number that is unique per import
      // (so re-importing the same file doesn't collide with a previous import's account)
      const pseudoAcctNum = `XLS-${Date.now().toString(36).toUpperCase().slice(-8)}`;

      const { data: acctData, error: acctErr } = await db
        .from("bank_accounts")
        .insert({
          bank_name: bankName,
          account_number: pseudoAcctNum,
          account_number_last4: pseudoAcctNum.slice(-4),
          account_type: "current",
          account_holder_name: null,
          opening_balance: 0,
          closing_balance: 0,
          import_id: importId,
          ...(companyId ? { company_id: companyId } : {}),
        })
        .select("id")
        .single();

      if (acctErr) {
        errors.push(`Failed to create bank account for Excel import: ${acctErr.message}`);
      } else if (acctData) {
        bankAccountId = acctData.id;
        accountsImported = 1;
        console.log("[import-banking] ✓ Created placeholder account for Excel import:", {
          id: bankAccountId,
          bank: bankName,
          acct: pseudoAcctNum.slice(-4),
        });
      }
    } catch (err) {
      errors.push(`Error creating bank account: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Import bank statements (transactions) ─────────────────────────────────

  if (bankAccountId && transactions.length > 0) {
    try {
      const statements: BankStatementInsert[] = transactions
        .map((txn) => {
          // Transactions come in as RUPEES from parse-pdf.ts — convert to paisa here
          const debit = typeof txn.Debit === "number"
            ? txn.Debit
            : (txn.Debit ? parseFloat(String(txn.Debit).replace(/[^0-9.]/g, "")) : 0);
          const credit = typeof txn.Credit === "number"
            ? txn.Credit
            : (txn.Credit ? parseFloat(String(txn.Credit).replace(/[^0-9.]/g, "")) : 0);
          const balance = typeof txn.Balance === "number"
            ? txn.Balance
            : (txn.Balance ? parseFloat(String(txn.Balance).replace(/[^0-9.]/g, "")) : 0);

          return {
            bank_account_id: bankAccountId,
            transaction_date: txn.Date || new Date().toISOString().split("T")[0],
            description: String(txn.Description || ""),
            debit: Math.round(debit * 100),   // rupees → paisa
            credit: Math.round(credit * 100),
            balance: Math.round(balance * 100),
            import_id: importId,
          };
        })
        .filter((s) => s.description.length > 0);

      if (statements.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < statements.length; i += BATCH_SIZE) {
          const batch = statements.slice(i, i + BATCH_SIZE);
          const { error: stmtErr } = await db.from("bank_statements").insert(batch);

          if (stmtErr) {
            errors.push(`Failed to import statements batch: ${stmtErr.message}`);
            break;
          }
          transactionsImported += batch.length;
        }
        console.log("[import-banking] ✓ Imported transactions:", transactionsImported);
      }
    } catch (err) {
      errors.push(`Error importing statements: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Update import record ──────────────────────────────────────────────────

  // FIX B3: Both branches previously said "completed" — errors were silently swallowed.
  const { error: updateErr } = await db
    .from("file_imports")
    .update({
      status: errors.length === 0 ? "completed" : "failed",
      rows_imported: accountsImported + transactionsImported,
      rows_failed: errors.length,
      error_log: errors.length > 0 ? errors.join("\n") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (updateErr) {
    console.error("[import-banking] Failed to update import record:", updateErr);
  }

  // Revalidate banking dashboard and imports list
  revalidatePath("/dashboard/banking");
  revalidatePath("/dashboard/imports");

  return {
    success: errors.length === 0 && (accountsImported > 0 || transactionsImported > 0),
    importId,
    bankAccountId,
    accountsImported,
    transactionsImported,
    errors,
  };
}
