/**
 * Cron endpoint: Sales OS automation & escalation.
 *
 * Daily (see vercel.json), protected by CRON_SECRET. For each sales owner who
 * opted into WhatsApp, sends a digest of:
 *   • overdue follow-ups
 *   • follow-ups due today
 *   • their open deals with no activity in 7+ days (stale)
 * Logs every send to notification_log.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getWhatsAppConfig } from "@/app/actions/notification-settings";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const OPEN_STAGES = ["new", "qualified", "quoted", "negotiation"];

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const db = supabase as any;
  const waConfig = await getWhatsAppConfig();

  const today = dayStr(new Date());
  const weekAgo = dayStr(new Date(Date.now() - 7 * 86_400_000));

  // Pending follow-ups with a due date.
  const { data: acts } = await db
    .from("crm_activities")
    .select("subject, due_at, owner_id, deal_id, created_at")
    .eq("done", false)
    .not("due_at", "is", null);

  // Open deals (for stale detection) + latest activity per deal.
  const { data: deals } = await db.from("crm_deals").select("id, title, owner_id, stage").in("stage", OPEN_STAGES);
  const { data: dealActs } = await db.from("crm_activities").select("deal_id, created_at").not("deal_id", "is", null);

  const lastActivity = new Map<string, string>();
  ((dealActs ?? []) as { deal_id: string; created_at: string }[]).forEach((a) => {
    const cur = lastActivity.get(a.deal_id);
    if (!cur || a.created_at > cur) lastActivity.set(a.deal_id, a.created_at);
  });

  type Owner = { overdue: string[]; today: string[]; stale: string[] };
  const byOwner = new Map<string, Owner>();
  const ensure = (id: string) => { if (!byOwner.has(id)) byOwner.set(id, { overdue: [], today: [], stale: [] }); return byOwner.get(id)!; };

  for (const a of (acts ?? []) as { subject: string; due_at: string; owner_id: string | null }[]) {
    if (!a.owner_id) continue;
    const due = a.due_at.slice(0, 10);
    if (due < today) ensure(a.owner_id).overdue.push(a.subject);
    else if (due === today) ensure(a.owner_id).today.push(a.subject);
  }
  for (const d of (deals ?? []) as { id: string; title: string; owner_id: string | null }[]) {
    if (!d.owner_id) continue;
    const last = lastActivity.get(d.id);
    if (!last || last.slice(0, 10) < weekAgo) ensure(d.owner_id).stale.push(d.title);
  }

  const ownerIds = [...byOwner.keys()];
  const results = { sent: 0, skipped: 0, failed: 0 };
  if (ownerIds.length === 0) return NextResponse.json({ success: true, message: "Nothing to escalate", ...results });

  const { data: users } = await db
    .from("users")
    .select("id, full_name, whatsapp_number, notify_whatsapp, is_active")
    .in("id", ownerIds);

  for (const u of (users ?? []) as { id: string; full_name: string; whatsapp_number: string | null; notify_whatsapp: boolean; is_active: boolean }[]) {
    if (!u.is_active || !u.notify_whatsapp || !u.whatsapp_number) { results.skipped++; continue; }
    const o = byOwner.get(u.id)!;
    if (o.overdue.length === 0 && o.today.length === 0 && o.stale.length === 0) { results.skipped++; continue; }

    const lines: string[] = [`🔔 Robotek Sales — daily plan for ${u.full_name.split(" ")[0]}`, ""];
    if (o.overdue.length) {
      lines.push(`⚠️ Overdue follow-ups: ${o.overdue.length}`);
      o.overdue.slice(0, 5).forEach((s) => lines.push(`• ${s}`));
    }
    if (o.today.length) {
      lines.push(`📅 Due today: ${o.today.length}`);
      o.today.slice(0, 5).forEach((s) => lines.push(`• ${s}`));
    }
    if (o.stale.length) {
      lines.push(`💤 Deals with no activity 7+ days: ${o.stale.length}`);
      o.stale.slice(0, 5).forEach((s) => lines.push(`• ${s}`));
    }
    lines.push("", "Open Sales OS to action these.");
    const body = lines.join("\n");

    const r = await sendWhatsApp(waConfig, u.whatsapp_number, body);
    const status = r.sent ? "sent" : r.skipped ? "skipped" : "failed";
    try {
      await db.from("notification_log").insert({
        user_id: u.id, channel: "whatsapp", recipient: u.whatsapp_number,
        subject: "Sales OS daily plan", body, status, error: r.error ?? null,
        metadata: { type: "crm_automation", overdue: o.overdue.length, today: o.today.length, stale: o.stale.length },
      });
    } catch { /* non-fatal */ }

    if (r.sent) results.sent++;
    else if (r.skipped) results.skipped++;
    else results.failed++;
    await new Promise((res) => setTimeout(res, 1200));
  }

  return NextResponse.json({ success: true, ...results, message: `Sales automation: ${results.sent} digests sent` });
}
