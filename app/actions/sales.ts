"use server";

/**
 * Server actions for the AI Sales Coordinator.
 */
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getWhatsAppConfig } from "@/app/actions/notification-settings";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getCustomerDetail } from "@/lib/supabase/sales-queries";
import { churnNudgeWithItems } from "@/lib/sales/whatsapp-templates";

/** Service-role client for sales_* writes (the customer-item target table has no
 * authenticated write policy). Server-only; we auth-check the caller first. */
function salesAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) as any;
}
async function requireUser() {
  const supa = await createClient();
  const { data } = await supa.auth.getUser();
  return data.user;
}

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

/** Update a company-level item monthly target. */
export async function updateProductTarget(productId: string, qty: number) {
  if (!(await requireUser())) return { ok: false as const, error: "Not signed in" };
  const q = Math.max(0, Math.round(Number(qty) || 0));
  const { error } = await salesAdmin()
    .from("sales_products")
    .update({ monthly_target_qty: q || null, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/sales/items");
  revalidatePath("/dashboard/sales/categories");
  return { ok: true as const };
}

/** Update a customer's monthly target qty for one item. */
export async function updateCustomerItemTarget(customerId: string, productId: string, qty: number) {
  if (!(await requireUser())) return { ok: false as const, error: "Not signed in" };
  const q = Math.max(0, Math.round(Number(qty) || 0));
  const { error } = await salesAdmin()
    .from("sales_customer_item_targets")
    .update({ monthly_target_qty: q, updated_at: new Date().toISOString() })
    .eq("customer_id", customerId).eq("product_id", productId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/sales/${customerId}`);
  return { ok: true as const };
}

/** Add (or upsert) a focus item target for a customer. */
export async function addCustomerItemTarget(customerId: string, productId: string, qty: number) {
  if (!(await requireUser())) return { ok: false as const, error: "Not signed in" };
  if (!productId) return { ok: false as const, error: "Pick an item" };
  const q = Math.max(0, Math.round(Number(qty) || 0));
  const { error } = await salesAdmin()
    .from("sales_customer_item_targets")
    .upsert({ customer_id: customerId, product_id: productId, monthly_target_qty: q, is_focus: true, months_active: 0, total_qty: 0, updated_at: new Date().toISOString() }, { onConflict: "customer_id,product_id" });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/sales/${customerId}`);
  return { ok: true as const };
}

/** Remove an item target from a customer's list. */
export async function removeCustomerItemTarget(customerId: string, productId: string) {
  if (!(await requireUser())) return { ok: false as const, error: "Not signed in" };
  const { error } = await salesAdmin()
    .from("sales_customer_item_targets")
    .delete().eq("customer_id", customerId).eq("product_id", productId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/sales/${customerId}`);
  return { ok: true as const };
}
