"use server";

/**
 * Server actions for the AI Sales Coordinator.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Save / update a sales customer's WhatsApp phone number. */
export async function setSalesCustomerPhone(id: string, phone: string) {
  const supabase = await createClient();
  // keep digits and a leading + only
  const clean = phone.replace(/[^\d+]/g, "").slice(0, 16);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("sales_customers")
    .update({ phone: clean || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/sales/${id}`);
  return { ok: true as const, phone: clean || null };
}
