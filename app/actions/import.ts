"use server";

/**
 * Import Server Actions — Module 2: Data Import Engine
 *
 * These actions handle the server-side half of the import flow:
 *   importTransactions  — write mapped rows to the transactions table
 *   rollbackImport      — delete all transactions from a given import_id
 *   getImportHistory    — fetch recent file_imports records
 *
 * All client-side parsing is done in lib/import-utils.ts; only the
 * validated, mapped rows are sent here for the actual DB write.
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MappedRow } from "@/lib/import-utils";
import type { Database } from "@/types/database";

// Convenience row aliases to avoid casting everywhere
type FileImportRow    = Database["public"]["Tables"]["file_imports"]["Row"];
type FileImportInsert = Database["public"]["Tables"]["file_imports"]["Insert"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export type ImportResult = {
  success: boolean;
  importId: string | null;
  rowsImported: number;
  rowsFailed: number;
  errors: string[];
};

export type ImportHistoryRow = {
  id: string;
  file_name: string;
  file_type: string;
  module: string;
  status: string;
  rows_imported: number;
  rows_failed: number;
  financial_year: string;
  can_rollback: boolean;
  created_at: string;
  uploader_name: string;
};

// ─── Import transactions ──────────────────────────────────────────────────────

/**
 * Write validated + mapped rows to the `transactions` table.
 * Creates a `file_imports` audit record first, then bulk-inserts rows.
 *
 * @param rows      Already validated MappedRow array (from client)
 * @param fileName  Original file name for the audit log
 * @param fileType  "xlsx" | "xls" | "csv"
 * @param module    Which module this import belongs to
 */
export async function importTransactions(
  rows: MappedRow[],
  fileName: string,
  fileType: "xlsx" | "xls" | "csv" | "pdf",
  module: string,
): Promise<ImportResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any; // supabase-js v2.106 generic inference incompatibility workaround
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, importId: null, rowsImported: 0, rowsFailed: 0, errors: ["Not authenticated"] };

  // Infer financial year from majority of rows
  const fyMap = new Map<string, number>();
  rows.forEach((r) => fyMap.set(r.financial_year, (fyMap.get(r.financial_year) ?? 0) + 1));
  const financialYear = Array.from(fyMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "2025-26";

  // Create the audit import record
  const insertData: FileImportInsert = {
    file_name: fileName, file_type: fileType, module,
    uploaded_by: user.id, status: "processing",
    rows_imported: 0, rows_failed: 0,
    financial_year: financialYear, can_rollback: true,
  };
  const { data: importRecord, error: importErr } = await db
    .from("file_imports")
    .insert(insertData)
    .select("id")
    .single() as { data: Pick<FileImportRow, "id"> | null; error: { message: string } | null };

  if (importErr || !importRecord) {
    return {
      success: false, importId: null, rowsImported: 0, rowsFailed: 0,
      errors: [`Failed to create import record: ${importErr?.message}`],
    };
  }

  const importId = importRecord.id;
  let rowsImported = 0;
  let rowsFailed = 0;
  const errors: string[] = [];

  // Bulk insert in batches of 500 to avoid Supabase payload limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const inserts: TransactionInsert[] = batch.map((r) => ({
      transaction_date: r.transaction_date,
      voucher_number:   r.voucher_number,
      voucher_type:     r.voucher_type || "Journal",
      ledger_name:      r.ledger_name,
      amount:           Math.max(r.dr_amount, r.cr_amount),
      dr_cr:            (r.dr_amount >= r.cr_amount ? "DR" : "CR") as "DR" | "CR",
      narration:        r.narration,
      financial_year:   r.financial_year,
      import_id:        importId,
    }));

    const { error: batchErr, count } = await db
      .from("transactions")
      .insert(inserts, { count: "exact" }) as { error: { message: string } | null; count: number | null };

    if (batchErr) {
      rowsFailed += batch.length;
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchErr.message}`);
    } else {
      rowsImported += count ?? batch.length;
    }
  }

  // Update the import record with final counts
  await db
    .from("file_imports")
    .update({
      status:        rowsFailed === 0 ? "completed" : "failed",
      rows_imported: rowsImported,
      rows_failed:   rowsFailed,
      error_log:     errors.length > 0 ? errors.join("\n") : null,
      completed_at:  new Date().toISOString(),
    })
    .eq("id", importId);

  revalidatePath("/dashboard", "layout");

  return {
    success: rowsFailed === 0 || rowsImported > 0,
    importId,
    rowsImported,
    rowsFailed,
    errors,
  };
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

/**
 * Delete all transactions created by a specific import, then mark the
 * file_imports record as rolled_back.
 * Only allowed within 24 hours of the import (can_rollback flag).
 */
export async function rollbackImport(importId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  // Verify the import exists and is still rollback-able
  const { data: record, error: fetchErr } = await db
    .from("file_imports")
    .select("id, can_rollback, uploaded_by, created_at")
    .eq("id", importId)
    .single() as { data: Pick<FileImportRow, "id" | "can_rollback" | "uploaded_by" | "created_at"> | null; error: unknown };

  if (fetchErr || !record) return { success: false, message: "Import record not found" };
  if (!record.can_rollback) return { success: false, message: "This import can no longer be rolled back (>24 hours)" };

  // Delete transactions linked to this import
  const { error: deleteErr } = await db
    .from("transactions")
    .delete()
    .eq("import_id", importId) as { error: { message: string } | null };

  if (deleteErr) return { success: false, message: `Failed to delete transactions: ${deleteErr.message}` };

  // Mark as rolled back
  await db
    .from("file_imports")
    .update({ status: "rolled_back", can_rollback: false, rolled_back_at: new Date().toISOString() })
    .eq("id", importId);

  revalidatePath("/dashboard", "layout");
  return { success: true, message: "Import rolled back successfully" };
}

// ─── Import history ───────────────────────────────────────────────────────────

/**
 * Fetch the 20 most recent file imports.
 * Joins with the users table to get the uploader's name.
 */
export async function getImportHistory(): Promise<ImportHistoryRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await db
    .from("file_imports")
    .select(`id, file_name, file_type, module, status, rows_imported, rows_failed,
             financial_year, can_rollback, created_at,
             users!uploaded_by ( full_name )`)
    .order("created_at", { ascending: false })
    .limit(20) as { data: (FileImportRow & { users: { full_name: string } | null })[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((d) => ({
    id:             d.id,
    file_name:      d.file_name,
    file_type:      d.file_type,
    module:         d.module,
    status:         d.status,
    rows_imported:  d.rows_imported,
    rows_failed:    d.rows_failed,
    financial_year: d.financial_year,
    can_rollback:   d.can_rollback,
    created_at:     d.created_at,
    uploader_name:  d.users?.full_name ?? "Unknown",
  }));
}
