/**
 * Cron endpoint: Sales OS lead drip sender.
 *
 * Called by Vercel Cron daily (see vercel.json). Protected by CRON_SECRET.
 *
 * What it does:
 *   1. Finds drip messages that are due (status=pending, scheduled_for <= today)
 *   2. Sends each via WhatsApp (using the admin Notification Settings config)
 *   3. Marks the message sent/skipped/failed and logs to notification_log
 *   4. When a lead has no pending drip messages left, marks its drip "done"
 *   5. Skips/cancels messages for leads whose drip was stopped
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getWhatsAppConfig } from "@/app/actions/notification-settings";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev — no secret set
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Inter-message delay so we don't hammer the WhatsApp gateway. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const waConfig = await getWhatsAppConfig();
  const today = new Date().toISOString().slice(0, 10);

  const results = { sent: 0, skipped: 0, failed: 0, no_phone: 0, cancelled: 0 };

  // ── 1. Due messages ─────────────────────────────────────────
  const { data: due } = (await db
    .from("crm_drip_messages")
    .select("id, lead_id, body, step_no")
    .eq("status", "pending")
    .lte("scheduled_for", today)
    .order("scheduled_for", { ascending: true })) as {
      data: { id: string; lead_id: string; body: string; step_no: number }[] | null;
    };

  const msgs = due ?? [];
  if (msgs.length === 0) {
    return NextResponse.json({ success: true, message: "No drip messages due", ...results });
  }

  // ── 2. Load the leads referenced ────────────────────────────
  const leadIds = [...new Set(msgs.map((m) => m.lead_id))];
  const { data: leads } = (await db
    .from("crm_leads")
    .select("id, name, phone, drip_status")
    .in("id", leadIds)) as {
      data: { id: string; name: string; phone: string | null; drip_status: string }[] | null;
    };
  const leadMap = new Map<string, { id: string; name: string; phone: string | null; drip_status: string }>();
  (leads ?? []).forEach((l) => leadMap.set(l.id, l));

  // ── 3. Send each due message ────────────────────────────────
  for (const m of msgs) {
    const lead = leadMap.get(m.lead_id);

    if (!lead || lead.drip_status === "stopped") {
      await db.from("crm_drip_messages").update({ status: "cancelled" }).eq("id", m.id);
      results.cancelled++;
      continue;
    }
    if (!lead.phone) {
      await db.from("crm_drip_messages").update({ status: "skipped", error: "No phone number" }).eq("id", m.id);
      results.no_phone++;
      continue;
    }

    const result = await sendWhatsApp(waConfig, lead.phone, m.body);
    const status = result.sent ? "sent" : result.skipped ? "skipped" : "failed";

    await db
      .from("crm_drip_messages")
      .update({ status, sent_at: result.sent ? new Date().toISOString() : null, error: result.error ?? null })
      .eq("id", m.id);

    try {
      await db.from("notification_log").insert({
        channel: "whatsapp",
        recipient: lead.phone,
        subject: `Drip #${m.step_no} → ${lead.name}`,
        body: m.body,
        status,
        error: result.error ?? null,
        metadata: { type: "crm_drip", lead_id: m.lead_id, drip_message_id: m.id, step: m.step_no },
      });
    } catch {
      /* logging is non-fatal */
    }

    if (result.sent) results.sent++;
    else if (result.skipped) results.skipped++;
    else results.failed++;

    await sleep(1200);
  }

  // ── 4. Mark leads done when no pending messages remain ──────
  for (const id of leadIds) {
    const lead = leadMap.get(id);
    if (!lead || lead.drip_status !== "active") continue;
    const { data: remaining } = (await db
      .from("crm_drip_messages")
      .select("id")
      .eq("lead_id", id)
      .eq("status", "pending")
      .limit(1)) as { data: { id: string }[] | null };
    if ((remaining ?? []).length === 0) {
      await db.from("crm_leads").update({ drip_status: "done" }).eq("id", id);
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    message: `Drip: ${results.sent} sent, ${results.failed} failed, ${results.skipped + results.no_phone} skipped`,
  });
}
