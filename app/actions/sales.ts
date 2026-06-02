"use server";

/**
 * Server actions for the AI Sales Coordinator.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getWhatsAppConfig } from "@/app/actions/notification-settings";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getCustomerDetail } from "@/lib/supabase/sales-queries";
import { churnNudgeWithItems } from "@/lib/sales/whatsapp-templates";

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

/**
 * Actually SEND a churn nudge to one customer via the WhatsApp API already
 * configured in FinOS (Maytapi/Meta/Twilio — getWhatsAppConfig). The message
 * lists their real regular items. Requires a phone number on file.
 */
export async function sendChurnNudgeWhatsApp(customerId: string) {
  const supabase = await createClient();
  const data = await getCustomerDetail(supabase, customerId);
  if (!data) return { ok: false as const, error: "Customer not found" };

  const { customer, focus } = data;
  if (!customer.phone) return { ok: false as const, error: "No phone number on file — add one first." };

  const body = churnNudgeWithItems(customer.name, focus.map((f) => ({ name: f.productName })));
  const cfg = await getWhatsAppConfig();
  const res = await sendWhatsApp(cfg, customer.phone, body);

  if (!res.sent) {
    return { ok: false as const, error: res.skipped ? "WhatsApp not configured in FinOS." : res.error || "Send failed." };
  }

  // stamp last-contacted so the dashboard can show it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("sales_customers").update({ notes: `wa_nudged:${new Date().toISOString()}` }).eq("id", customerId);
  revalidatePath(`/dashboard/sales/${customerId}`);
  return { ok: true as const, messageId: res.messageId ?? null };
}
