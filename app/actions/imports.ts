"use server";

/**
 * imports.ts — Server actions for viewing and deleting imported data.
 *
 * getAllImports()   → list all file_imports rows (CEO/CFO/Accounts only)
 * deleteImport()   → delete an import + its bank accounts/statements
 */

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export interface ImportRecord {
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
  completed_at: string | null;
  uploader_name: string;
}

/** Returns a service-role admin client for privileged deletes */
function getAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Asserts caller is ceo / cfo / accounts */
async function assertCanManageImports(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (data as { role: string } | null)?.role;
  if (!role || !["ceo", "cfo", "accounts"].includes(role)) {
    throw new Error("You don't have permission to manage imports.");
  }
  return user.id;
}

/**
 * Fetch all imports with uploader name, newest first.
 */
export async function getAllImports(): Promise<ImportRecord[]> {
  await assertCanManageImports();
  const admin = getAdmin();

  const { data, error } = await admin
    .from("file_imports")
    .select(`
      id, file_name, file_type, module, status,
      rows_imported, rows_failed, financial_year,
      can_rollback, created_at, completed_at,
      uploader:uploaded_by(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    id:             row.id,
    file_name:      row.file_name,
    file_type:      row.file_type,
    module:         row.module,
    status:         row.status,
    rows_imported:  row.rows_imported,
    rows_failed:    row.rows_failed,
    financial_year: row.financial_year,
    can_rollback:   row.can_rollback,
    created_at:     row.created_at,
    completed_at:   row.completed_at,
    uploader_name:  row.uploader?.full_name ?? "Unknown",
  }));
}

/**
 * Delete an import and all its associated data.
 *
 * For bank_statement imports: deletes bank_accounts (which cascades to
 * bank_statements) before deleting the file_imports record.
 * For other modules: deletes transactions linked to this import.
 */
export async function deleteImport(importId: string): Promise<void> {
  const userId = await assertCanManageImports();
  const admin = getAdmin();

  // Fetch the import to know the module
  const { data: imp, error: fetchErr } = await admin
    .from("file_imports")
    .select("id, module, uploaded_by")
    .eq("id", importId)
    .single();

  if (fetchErr || !imp) throw new Error("Import not found");

  // CEO can delete any import; others can only delete their own
  const supabase = await createClient();
  const { data: callerData } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  const callerRole = (callerData as { role: string } | null)?.role;
  if (callerRole !== "ceo" && (imp as any).uploaded_by !== userId) {
    throw new Error("You can only delete your own imports.");
  }

  // 1. Delete linked data depending on module
  // NOTE: banking imports may be stored as "banking" OR "bank_statement"
  const isBankImport = ["banking", "bank_statement"].includes((imp as any).module);
  if (isBankImport) {
    // Step 1a: delete bank_statements rows that reference accounts from this import
    //          (handles cases where the cascade isn't set up on the FK)
    const { data: accounts } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("import_id", importId);
    if (accounts && accounts.length > 0) {
      const ids = accounts.map((a: any) => a.id);
      await (admin as any).from("bank_statements").delete().in("bank_account_id", ids);
    }
    // Step 1b: delete the bank_account rows themselves
    const { error: baErr } = await admin
      .from("bank_accounts")
      .delete()
      .eq("import_id", importId);
    if (baErr) throw new Error("Failed to delete bank accounts: " + baErr.message);
  } else {
    // Delete transactions linked to this import
    const { error: txErr } = await (admin as any)
      .from("transactions")
      .delete()
      .eq("import_id", importId);
    if (txErr) {
      // Non-fatal — log the warning but continue so the file_imports record is removed
      console.warn("[deleteImport] Could not delete transactions:", txErr.message);
    }
  }

  // 2. Delete the file_imports record itself
  const { error: delErr } = await admin
    .from("file_imports")
    .delete()
    .eq("id", importId);

  if (delErr) throw new Error("Failed to delete import: " + delErr.message);

  revalidatePath("/dashboard/imports");
  revalidatePath("/dashboard/banking");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payables");
  revalidatePath("/dashboard/receivables");
}
