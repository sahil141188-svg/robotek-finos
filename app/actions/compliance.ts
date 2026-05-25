"use server";

/**
 * Compliance Server Actions — Module 3: Compliance Calendar
 *
 * updateComplianceStatus — mark a compliance item as filed / paid
 * getComplianceItems     — try Supabase first, fall back to sample data
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import {
  COMPLIANCE_ITEMS,
  type ComplianceItem,
  type ComplianceStatus,
} from "@/lib/compliance-data";
import type { Database } from "@/types/database";

type ComplianceInsert = Database["public"]["Tables"]["compliance_items"]["Insert"];
type ComplianceUpdate = Database["public"]["Tables"]["compliance_items"]["Update"];

export type UpdateStatusPayload = {
  id: string;
  status: ComplianceStatus;
  filed_date?: string;       // YYYY-MM-DD
  acknowledgement_number?: string;
  notes?: string;
};

// ─── Get compliance items ─────────────────────────────────────────────────────

/**
 * Load compliance items for a financial year.
 * Tries Supabase first; if empty (not yet seeded) returns in-memory sample data.
 */
export async function getComplianceItems(
  financialYear: string = "2026-27",
): Promise<ComplianceItem[]> {
  try {
    const supabase = await createClient();
    const companyId = await getSelectedCompanyId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let query = db
      .from("compliance_items")
      .select("*")
      .order("due_date", { ascending: true });
    if (companyId) query = query.eq("company_id", companyId);

    let { data, error: queryErr } = await query as {
      data: ComplianceItem[] | null;
      error: { code?: string; message: string } | null;
    };

    // Pre-migration fallback: if company_id column doesn't exist, retry without filter
    if (queryErr && queryErr.code === "42703" && companyId) {
      console.warn("[compliance] company_id column missing — run migration 006.");
      const fallback = await db
        .from("compliance_items")
        .select("*")
        .order("due_date", { ascending: true }) as { data: ComplianceItem[] | null };
      data = fallback.data;
    }

    if (data && data.length > 0) {
      // Merge: prefer DB status (user may have updated), rest from sample data
      const dbMap = new Map(data.map((d: ComplianceItem) => [d.id, d]));
      return COMPLIANCE_ITEMS.map((item) => {
        const dbItem = dbMap.get(item.id);
        return dbItem ? { ...item, ...dbItem } : item;
      });
    }
  } catch {
    // Supabase unavailable — use sample data
  }

  return COMPLIANCE_ITEMS.filter(
    (i) => i.financial_year === financialYear || i.financial_year === "2025-26",
  );
}

// ─── Update compliance status ─────────────────────────────────────────────────

/**
 * Mark a compliance item as filed or paid.
 * Upserts into Supabase compliance_items table.
 */
export async function updateComplianceStatus(
  payload: UpdateStatusPayload,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  // Find the sample item to get all required fields for the insert
  const sample = COMPLIANCE_ITEMS.find((i) => i.id === payload.id);
  if (!sample) return { success: false, message: "Compliance item not found" };

  // Bug #8 fix: include company_id so the row is scoped correctly.
  // Without it the upserted row has no company context and the
  // getComplianceItems filter (.eq("company_id", …)) never matches it.
  const companyId = await getSelectedCompanyId();
  const now = new Date().toISOString();
  const upsertData: ComplianceInsert & { company_id?: string } = {
    id:                     payload.id,
    category:               sample.category,
    title:                  sample.title,
    description:            sample.description,
    due_date:               sample.due_date,
    status:                 payload.status,
    financial_year:         sample.financial_year,
    period:                 sample.period ?? null,
    filed_date:             payload.filed_date ?? null,
    acknowledgement_number: payload.acknowledgement_number ?? null,
    notes:                  payload.notes ?? sample.notes ?? null,
    is_recurring:           sample.is_recurring,
    created_at:             now,
    updated_at:             now,
    ...(companyId ? { company_id: companyId } : {}),
  };

  const { error } = await db
    .from("compliance_items")
    .upsert(upsertData, { onConflict: "id" }) as { error: { message: string } | null };

  // Bug #5 fix: was returning success:true even when the DB write failed.
  // The caller showed a green toast while the status was never persisted.
  if (error) {
    console.error("Compliance upsert error:", error.message);
    return { success: false, message: `Failed to save: ${error.message}` };
  }

  revalidatePath("/dashboard/compliance", "layout");
  return { success: true, message: `Marked as ${payload.status}` };
}

// ─── Compliance summary for dashboard ────────────────────────────────────────

export type ComplianceSummary = {
  total: number;
  overdue: number;
  dueSoon: number;   // within 7 days
  completed: number;
  score: number;     // 0-100
};

export async function getComplianceSummary(): Promise<ComplianceSummary> {
  const items = await getComplianceItems();
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

  const overdue   = items.filter((i) => i.status === "overdue" || (i.due_date < today && i.status === "pending")).length;
  const dueSoon   = items.filter((i) => i.due_date >= today && i.due_date <= sevenDaysOut && i.status === "pending").length;
  const completed = items.filter((i) => i.status === "filed" || i.status === "paid").length;
  const pastDue   = items.filter((i) => i.due_date <= today);
  const score     = pastDue.length === 0 ? 100 : Math.round((completed / pastDue.length) * 100);

  return { total: items.length, overdue, dueSoon, completed, score };
}
