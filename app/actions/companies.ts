"use server";

/**
 * Company CRUD server actions.
 * All mutating actions (create / update / delete) are CEO-only.
 * getCompanies() is available to all authenticated users (for the switcher).
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Company } from "@/lib/companies-data";
import type { Database } from "@/types/database";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all companies from Supabase, ordered by sort_order then name.
 * Falls back to an empty array (never throws) so the switcher always renders.
 */
export async function getCompanies(): Promise<Company[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name",       { ascending: true });

    if (error || !data) return [];
    // Map DB row → Company (field names are identical; cast status)
    return (data as CompanyRow[]).map((row) => ({
      id:               row.id,
      name:             row.name,
      short_name:       row.short_name,
      type:             row.type,
      city:             row.city,
      gstin:            row.gstin,
      color_class:      row.color_class,
      status:           row.status as "active" | "dormant",
      monthly_revenue:  row.monthly_revenue,
      ap_outstanding:   row.ap_outstanding,
      ar_outstanding:   row.ar_outstanding,
      cash_balance:     row.cash_balance,
      net_pl_monthly:   row.net_pl_monthly,
      compliance_score: row.compliance_score,
      employee_count:   row.employee_count,
    }));
  } catch {
    return [];
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCompany(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Auto sort_order = max existing + 1
    const { data: existing } = await supabase
      .from("companies")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = ((existing as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1;

    const name       = (formData.get("name")       as string).trim();
    const short_name = (formData.get("short_name")  as string).trim();
    if (!name)       return { success: false, error: "Company name is required." };
    if (!short_name) return { success: false, error: "Short name is required." };

    const insert: Database["public"]["Tables"]["companies"]["Insert"] = {
      name,
      short_name:  short_name.slice(0, 18),
      type:        ((formData.get("type")        as string) ?? "").trim(),
      city:        ((formData.get("city")        as string) ?? "").trim(),
      gstin:       ((formData.get("gstin")       as string) ?? "").trim().toUpperCase(),
      color_class: (formData.get("color_class") as string) || "bg-brand-red",
      status:      ((formData.get("status") as string) as "active" | "dormant") || "active",
      sort_order:  nextOrder,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("companies") as any).insert(insert) as { error: { message: string } | null };

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/consolidated");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCompany(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const name       = (formData.get("name")       as string).trim();
    const short_name = (formData.get("short_name")  as string).trim();
    if (!name)       return { success: false, error: "Company name is required." };
    if (!short_name) return { success: false, error: "Short name is required." };

    const upd: Database["public"]["Tables"]["companies"]["Update"] = {
      name,
      short_name:  short_name.slice(0, 18),
      type:        ((formData.get("type")        as string) ?? "").trim(),
      city:        ((formData.get("city")        as string) ?? "").trim(),
      gstin:       ((formData.get("gstin")       as string) ?? "").trim().toUpperCase(),
      color_class: (formData.get("color_class") as string) || "bg-brand-red",
      status:      ((formData.get("status") as string) as "active" | "dormant") || "active",
      updated_at:  new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("companies") as any).update(upd).eq("id", id) as { error: { message: string } | null };

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/consolidated");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCompany(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("companies") as any).delete().eq("id", id) as { error: { message: string } | null };

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/consolidated");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
