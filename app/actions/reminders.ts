"use server";

/**
 * AR Reminders — one-click WhatsApp reminders for overdue customers.
 *
 * Public actions:
 *   listOverdueCustomers()      — every customer with outstanding balance
 *                                 (annotated with last_reminder_date and
 *                                 eligible-today flag).
 *   listTodaysList()            — eligible-only subset for the daily review.
 *   updateCustomerContact()     — inline edit of phone / email / contact person.
 *   updateVendorContact()       — same for vendors.
 *   sendArReminder()            — send a single reminder, log it.
 *   sendBulkReminders()         — send to a list of customer IDs with cooldown
 *                                 + rate limit between calls.
 *   sendAllTodaysReminders()    — convenience wrapper: picks every eligible
 *                                 customer and sends. Used by the one-click
 *                                 button on /dashboard/reminders.
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

const COOLDOWN_DAYS_DEFAULT  = 3;
const INTER_DELAY_MS_DEFAULT = 2000;

export type OverdueCustomer = {
  id: string;
  name: string;            // firm name (used in message)
  phone: string | null;
  email: string | null;
  gstin: string | null;
  outstanding: number;
  overdue: number;
  oldestInvoice: string | null;
  daysOverdue: number;
  lastReminderAt: string | null; // ISO timestamp of most recent successful WhatsApp send
  daysSinceLastReminder: number | null;
  eligibleToday: boolean;        // has phone + cooldown elapsed
  reason?: string;               // why not eligible
};

/** Format INR for the message body (Indian comma grouping, no decimals) */
function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Render the AR template with this customer's variables */
function renderArMessage(template: string, vars: {
  customer_name: string;
  amount: string;
  due_date: string;
  days_overdue: string;
  invoice_no: string;
  company_name: string;
}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars as Record<string, string>)[k] ?? `{${k}}`);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Listing ─────────────────────────────────────────────────────────────────

async function fetchLastReminderTimestamps(
  customerIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (customerIds.length === 0) return map;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("notification_log")
    .select("created_at, metadata, status")
    .eq("channel", "whatsapp")
    .eq("status",  "sent")
    .order("created_at", { ascending: false })
    .limit(5000);

  for (const row of (data ?? []) as Array<{ created_at: string; metadata: { customer_id?: string } | null }>) {
    const cid = row.metadata?.customer_id;
    if (!cid) continue;
    if (!map.has(cid)) map.set(cid, row.created_at);
  }
  return map;
}

export async function listOverdueCustomers(): Promise<{
  customers: OverdueCustomer[];
  companyId: string | null;
  cooldownDays: number;
}> {
  const supabase = await createClient();
  const companyId = await getSelectedCompanyId();
  if (!companyId) return { customers: [], companyId: null, cooldownDays: COOLDOWN_DAYS_DEFAULT };

  const settings   = await getNotificationSettings();
  const cooldown   = settings.reminders.ar_min_days_between_reminders ?? COOLDOWN_DAYS_DEFAULT;
  const { parties } = await buildPartyAging(supabase, "customer", companyId);
  const overduePartiesAll = parties.filter((p) => p.total > 0);

  const lastByCustomer = await fetchLastReminderTimestamps(overduePartiesAll.map((p) => p.party_id));

  const today = new Date().toISOString().slice(0, 10);
  const customers: OverdueCustomer[] = overduePartiesAll.map((p) => {
    const overdue = p.ag31to60 + p.ag61to90 + p.ag90plus;
    const oldest = p.open_invoices
      .filter((i) => i.amount > 0)
      .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))[0];
    const lastAt = lastByCustomer.get(p.party_id) ?? null;
    const days = lastAt ? daysBetween(lastAt.slice(0, 10), today) : null;

    let eligibleToday = true;
    let reason: string | undefined;
    if (!p.phone) { eligibleToday = false; reason = "No phone number"; }
    else if (days !== null && days < cooldown) {
      eligibleToday = false;
      reason = `Reminder sent ${days} day${days === 1 ? "" : "s"} ago (cooldown: ${cooldown}d)`;
    }

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
      lastReminderAt: lastAt,
      daysSinceLastReminder: days,
      eligibleToday,
      reason,
    };
  }).sort((a, b) => {
    // Eligible first, then by outstanding desc
    if (a.eligibleToday !== b.eligibleToday) return a.eligibleToday ? -1 : 1;
    return b.outstanding - a.outstanding;
  });

  return { customers, companyId, cooldownDays: cooldown };
}

// ── Contact edit ────────────────────────────────────────────────────────────

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

  // Use .select() so we get the updated row back. Without this, Supabase silently
  // returns 0 rows when RLS blocks the UPDATE — leaving the UI to wrongly think
  // the save succeeded. With .select() we can detect 0 rows and surface a real error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("customers").update(patch).eq("id", input.customerId).select("id");
  if (error) {
    console.error("[updateCustomerContact] DB error:", error);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    console.error("[updateCustomerContact] 0 rows affected", { customerId: input.customerId, userId: user.id });
    return { ok: false, error: "Permission denied or customer not found. Refresh the page and try again." };
  }
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

  // .select() forces PostgREST to return the updated row, so we can detect
  // silent 0-row RLS rejections (otherwise the UI would think the save succeeded).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("vendors").update(patch).eq("id", input.vendorId).select("id");
  if (error) {
    console.error("[updateVendorContact] DB error:", error);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    console.error("[updateVendorContact] 0 rows affected", { vendorId: input.vendorId, userId: user.id });
    return { ok: false, error: "Permission denied or vendor not found. Refresh the page and try again." };
  }
  revalidatePath("/dashboard/payables");
  return { ok: true };
}

// ── Send (single) ────────────────────────────────────────────────────────────

async function sendArReminderInternal(
  customerId: string,
  amount: number,
  oldestInvoiceDate: string | null,
  daysOverdue: number,
  cooldownDays: number,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sent: false, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: c } = await (supabase as any)
    .from("customers").select("*").eq("id", customerId).maybeSingle();
  if (!c) return { sent: false, error: "Customer not found" };
  if (!c.phone) return { sent: false, error: "No phone number on file" };

  // Cooldown guard: skip if a successful send happened within the cooldown window
  const lastMap = await fetchLastReminderTimestamps([customerId]);
  const lastAt = lastMap.get(customerId);
  if (lastAt) {
    const days = daysBetween(lastAt.slice(0, 10), new Date().toISOString().slice(0, 10));
    if (days < cooldownDays) {
      return { sent: false, skipped: true, error: `In cooldown (${days}d since last send, min ${cooldownDays}d)` };
    }
  }

  const settings = await getNotificationSettings();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (supabase as any)
    .from("companies").select("name, short_name").eq("id", c.company_id).maybeSingle();

  const body = renderArMessage(settings.templates.ar_reminder, {
    customer_name: c.name,
    amount:        fmtINR(amount),
    due_date:      oldestInvoiceDate
      ? new Date(oldestInvoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "the agreed date",
    days_overdue:  String(daysOverdue),
    invoice_no:    "(consolidated outstanding)",
    company_name:  company?.name ?? "Robotek",
  });

  const cfg = await getWhatsAppConfig();
  const result = await sendWhatsApp(cfg, c.phone, body);

  // Log every attempt
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
      metadata:  { customer_id: c.id, customer_name: c.name, amount, oldest_invoice: oldestInvoiceDate, days_overdue: daysOverdue },
    });
  } catch { /* logging is non-fatal */ }

  return result;
}

export async function sendArReminder(input: {
  customerId: string;
  amount: number;
  oldestInvoiceDate: string | null;
  daysOverdue: number;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const settings = await getNotificationSettings();
  const cooldown = settings.reminders.ar_min_days_between_reminders ?? COOLDOWN_DAYS_DEFAULT;
  const r = await sendArReminderInternal(
    input.customerId, input.amount, input.oldestInvoiceDate, input.daysOverdue, cooldown,
  );
  revalidatePath("/dashboard/reminders");
  return r;
}

// ── Send (bulk / one-click) ──────────────────────────────────────────────────

export type BulkResult = {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    customerId: string;
    customerName: string;
    status: "sent" | "skipped" | "failed";
    error?: string;
  }>;
};

export async function sendBulkReminders(customerIds: string[]): Promise<BulkResult> {
  const settings = await getNotificationSettings();
  const cooldown = settings.reminders.ar_min_days_between_reminders ?? COOLDOWN_DAYS_DEFAULT;
  const delay    = settings.reminders.ar_inter_message_delay_ms       ?? INTER_DELAY_MS_DEFAULT;

  // Pull current AR aging so amount + oldest invoice are accurate per customer
  const { customers } = await listOverdueCustomers();
  const byId = new Map(customers.map((c) => [c.id, c]));

  const agg: BulkResult = { total: customerIds.length, sent: 0, skipped: 0, failed: 0, results: [] };

  for (let i = 0; i < customerIds.length; i++) {
    const cid = customerIds[i];
    const c   = byId.get(cid);
    if (!c) {
      agg.failed++;
      agg.results.push({ customerId: cid, customerName: "(not found)", status: "failed", error: "Customer not in current outstanding list" });
      continue;
    }
    const r = await sendArReminderInternal(cid, c.outstanding, c.oldestInvoice, c.daysOverdue, cooldown);
    if (r.sent)      { agg.sent++;    agg.results.push({ customerId: cid, customerName: c.name, status: "sent" }); }
    else if (r.skipped) { agg.skipped++; agg.results.push({ customerId: cid, customerName: c.name, status: "skipped", error: r.error }); }
    else             { agg.failed++;  agg.results.push({ customerId: cid, customerName: c.name, status: "failed",  error: r.error }); }

    // Rate-limit between calls (skip after the last one)
    if (i < customerIds.length - 1 && delay > 0) await sleep(delay);
  }

  revalidatePath("/dashboard/reminders");
  return agg;
}

/**
 * One-click "send today's reminders": picks every eligible customer for the
 * currently-selected company and sends. Returns a structured summary.
 */
export async function sendAllTodaysReminders(): Promise<BulkResult & { totalEligible: number }> {
  const { customers } = await listOverdueCustomers();
  const eligible = customers.filter((c) => c.eligibleToday);
  const result   = await sendBulkReminders(eligible.map((c) => c.id));
  return { ...result, totalEligible: eligible.length };
}
