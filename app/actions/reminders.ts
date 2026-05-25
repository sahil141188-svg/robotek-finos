"use server";

/**
 * AR Reminders — send WhatsApp reminders to overdue customers.
 *
 *   listOverdueCustomers()  — returns customers with AR outstanding + phone
 *   updateCustomerContact() — server action to edit customer phone/email/notes
 *   sendArReminder()        — send a single reminder + log it
 *   sendBulkReminders()     — send to a list of customer IDs
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { buildPartyAging } from "@/lib/supabase/party-aging";
import {
  getNotificationSettings,
  getWhatsAppConfig,
} from "@/app/actions/notification-settings";
import { sendWhatsApp } from "@/lib/whatsapp";

export type OverdueCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  outstanding: number;
  overdue: number;
  oldestInvoice: string | null;
  daysOverdue: number;
};

export async function listOverdueCustomers(): Promise<{ customers: OverdueCustomer[]; companyId: string | null }> {
  const supabase = await createClient();
  const companyId = await getSelectedCompanyId();
  if (!companyId) return { customers: [], companyId: null };

  const { parties } = await buildPartyAging(supabase, "customer", companyId);

  const out: OverdueCustomer[] = parties
    .filter((p) => p.total > 0)
    .map((p) => {
      const overdue = p.ag31to60 + p.ag61to90 + p.ag90plus;
      const oldest = p.open_invoices
        .filter((i) => i.amount > 0)
        .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))[0];
      return {
        id: p.party_id,
        name: p.party_name,
        phone: p.phone,
        email: p.email,
        gstin: p.gstin,
        outstanding: p.total,
        overdue,
        oldestInvoice: oldest?.invoice_date ?? null,
        daysOverdue: oldest?.days_outstanding ?? 0,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  return { customers: out, companyId };
}

export async function updateCustomerContact(input: {
  customerId: string;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const patch: Record<string, string | null> = {};
  if (input.phone !== undefined)         patch.phone         = input.phone || null;
  if (input.email !== undefined)         patch.email         = input.email || null;
  if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customers")
    .update(patch)
    .eq("id", input.customerId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard/receivables");
  return { ok: true };
}

export async function updateVendorContact(input: {
  vendorId: string;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const patch: Record<string, string | null> = {};
  if (input.phone !== undefined)         patch.phone         = input.phone || null;
  if (input.email !== undefined)         patch.email         = input.email || null;
  if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("vendors")
    .update(patch)
    .eq("id", input.vendorId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/payables");
  return { ok: true };
}

/** Render an AR reminder message from the template stored in app_settings. */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Format INR amount like "₹1,23,456" */
function fmtINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export async function sendArReminder(input: {
  customerId: string;
  invoiceNo?: string;
  amount?: number;
  dueDate?: string;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sent: false, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: c } = await (supabase as any)
    .from("customers").select("*").eq("id", input.customerId).maybeSingle();
  if (!c) return { sent: false, error: "Customer not found" };
  if (!c.phone) return { sent: false, error: "No phone number on file for this customer" };

  const settings = await getNotificationSettings();
  const tpl = settings.templates.ar_reminder ??
    "Dear {customer_name},\n\nThis is a reminder that invoice {invoice_no} for ₹{amount} is due on {due_date}.\n\nPlease arrange payment at the earliest.\n\nRegards,\n{company_name} Finance Team";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (supabase as any)
    .from("companies").select("name, short_name").eq("id", c.company_id).maybeSingle();

  const body = renderTemplate(tpl, {
    customer_name: c.name,
    invoice_no:    input.invoiceNo ?? "(consolidated outstanding)",
    amount:        input.amount !== undefined ? input.amount.toLocaleString("en-IN") : "(see ledger)",
    due_date:      input.dueDate ?? "the agreed date",
    company_name:  company?.name ?? "Robotek",
  });

  const cfg = await getWhatsAppConfig();
  const result = await sendWhatsApp(cfg, c.phone, body);

  // Log
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("notification_log").insert({
      user_id:   user.id,
      channel:   "whatsapp",
      recipient: c.phone,
      subject:   "AR Reminder",
      body,
      status:    result.sent ? "sent" : result.skipped ? "skipped" : "failed",
      error:     result.error ?? null,
      metadata:  { customer_id: c.id, customer_name: c.name, amount: input.amount, invoice_no: input.invoiceNo },
    });
  } catch { /* logging is non-fatal */ }

  revalidatePath("/dashboard/reminders");
  return result;
}

export async function sendBulkReminders(customerIds: string[]): Promise<{
  total: number; sent: number; skipped: number; failed: number;
  results: Array<{ customerId: string; status: "sent" | "skipped" | "failed"; error?: string }>;
}> {
  const aggregate = { total: customerIds.length, sent: 0, skipped: 0, failed: 0 };
  const results: Array<{ customerId: string; status: "sent" | "skipped" | "failed"; error?: string }> = [];

  // Pull current AR aging so we can include amount + oldest invoice
  const { customers } = await listOverdueCustomers();
  const byId = new Map(customers.map((c) => [c.id, c]));

  for (const cid of customerIds) {
    const c = byId.get(cid);
    const r = await sendArReminder({
      customerId: cid,
      amount:     c?.outstanding,
      invoiceNo:  undefined,
      dueDate:    c?.oldestInvoice ? new Date(c.oldestInvoice + "T00:00:00").toLocaleDateString("en-IN") : undefined,
    });
    if (r.sent)       { aggregate.sent++;    results.push({ customerId: cid, status: "sent" }); }
    else if (r.skipped) { aggregate.skipped++; results.push({ customerId: cid, status: "skipped", error: r.error }); }
    else              { aggregate.failed++;  results.push({ customerId: cid, status: "failed", error: r.error }); }
  }

  return { ...aggregate, results };
}
