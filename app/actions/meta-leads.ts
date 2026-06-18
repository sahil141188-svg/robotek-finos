"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmLeadStatus } from "@/types/database";

type Result = { error: string | null };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return v && String(v).trim() ? String(v).trim() : null;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v ? Number(v) : null;
}

async function currentUserId(): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Create a Meta WhatsApp lead (manual entry for Click-to-WhatsApp ad leads).
 */
export async function createMetaLead(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const name = str(formData, "name");
  if (!name) return { error: "Lead name is required" };

  const supabase = (await createClient()) as any;

  const { error } = await supabase.from("crm_leads").insert({
    name,
    lead_type: "channel_partner",
    source: "Meta WhatsApp",
    company: str(formData, "company"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    est_value: num(formData, "est_value"),
    assigned_to: str(formData, "assigned_to"),
    notes: str(formData, "notes"),
    ad_name: str(formData, "ad_name"),
    created_by: uid,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/meta-leads");
  revalidatePath("/dashboard/sales-os/leads");
  return { error: null };
}

/**
 * Update lead status (reused from main CRM, but revalidates meta-leads path too).
 */
export async function updateLeadStatus(id: string, status: CrmLeadStatus): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/meta-leads");
  revalidatePath("/dashboard/sales-os/leads");
  return { error: null };
}
