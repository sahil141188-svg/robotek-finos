/**
 * Morning Executive Brief — Vercel Cron Route
 *
 * Schedule: 08:00 AM IST = 02:30 UTC daily  →  "30 2 * * *" in vercel.json
 * Protected by CRON_SECRET (Vercel sets this automatically).
 *
 * What it does:
 *   1. Pulls LIVE aggregates (cash, AR, AP, sales, alerts) across all 7 group companies
 *   2. Pulls yesterday's transaction pulse (sales, receipts, payments)
 *   3. Pulls top 3 overdue receivable parties
 *   4. Pulls upcoming compliance deadlines (next 7 days)
 *   5. Formats a world-class concise WhatsApp message
 *   6. Sends via Maytapi (configured in admin → Notification Settings) to
 *      every recipient listed in app_settings.briefing.recipients
 *   7. Also sends a longer HTML version to BRIEFING_TO_EMAIL via Resend (if set)
 *
 * Recipients are managed via the admin Notification Settings page —
 * NO code change needed to add/remove people.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchGroupAggregates } from "@/lib/supabase/group-aggregates";
import { buildPartyAging } from "@/lib/supabase/party-aging";
import {
  getWhatsAppConfig,
  getBriefingSettings,
} from "@/app/actions/notification-settings";
import { sendWhatsApp } from "@/lib/whatsapp";
import type { Database } from "@/types/database";

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow without secret
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(1)} L`;
  if (abs >= 1_000)       return `${sign}₹${(abs / 1_000).toFixed(0)} K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

/** Sleep helper — for inter-message rate limiting on Maytapi. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── The brief itself ──────────────────────────────────────────────────────────

type BriefData = {
  today: string;
  yesterday: string;
  groupCash: number;
  groupAR: number;
  groupAROverdue: number;
  groupAP: number;
  groupRevenueMTD: number;
  companies: Array<{ name: string; short: string; cash: number; ar: number; revMTD: number }>;
  yestSales: number;
  yestSalesCount: number;
  yestReceipts: number;
  yestPayments: number;
  topOverdue: Array<{ name: string; amount: number; days: number; company: string }>;
  upcomingCompliance: Array<{ title: string; due_date: string; days_away: number }>;
  alertCount: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBriefData(supabase: any): Promise<BriefData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const in7days   = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

  // 1. Group + per-company live aggregates
  const groupRows = await fetchGroupAggregates(supabase);
  const activeCos = groupRows.filter((c) => c.status === "active");
  const groupCash    = activeCos.reduce((s, c) => s + c.cash_balance, 0);
  const groupAR      = activeCos.reduce((s, c) => s + c.ar_outstanding, 0);
  const groupAP      = activeCos.reduce((s, c) => s + c.ap_outstanding, 0);
  const groupRevenueMTD = activeCos.reduce((s, c) => s + c.monthly_revenue, 0);

  // 2. AR overdue (31+ days) — top 3 across all companies
  type PartyHit = { name: string; amount: number; days: number; company: string };
  const overduePool: PartyHit[] = [];
  let groupAROverdue = 0;
  for (const c of activeCos) {
    try {
      const { parties, summary } = await buildPartyAging(supabase, "customer", c.id);
      groupAROverdue += summary.overdue;
      for (const p of parties) {
        const overdueTotal = p.ag31to60 + p.ag61to90 + p.ag90plus;
        if (overdueTotal <= 0) continue;
        // Find oldest open invoice for days-outstanding
        const oldest = (p.open_invoices || []).reduce(
          (max, inv) => (inv.days_outstanding > max ? inv.days_outstanding : max),
          0,
        );
        if (oldest <= 30) continue; // only true overdue
        overduePool.push({
          name:    p.party_name.replace(/ \(Aggarwal\)$/, ""),
          amount:  overdueTotal,
          days:    oldest,
          company: c.short_name,
        });
      }
    } catch { /* ignore one-company failure */ }
  }
  overduePool.sort((a, b) => b.amount - a.amount);
  const topOverdue = overduePool.slice(0, 3);

  // 3. Yesterday's pulse — sales, receipts, payments (group-wide)
  const { data: yestTxns } = await db
    .from("transactions")
    .select("voucher_type, amount, dr_cr, voucher_number")
    .eq("transaction_date", yesterday) as {
      data: Array<{ voucher_type: string; amount: number; dr_cr: "DR" | "CR"; voucher_number: string | null }> | null;
    };

  let yestSales = 0, yestReceipts = 0, yestPayments = 0;
  const yestSalesVouchers = new Set<string>();
  for (const t of yestTxns ?? []) {
    const vt = (t.voucher_type || "").toLowerCase();
    const amt = Number(t.amount);
    if (vt === "supo" || vt === "sales" || vt === "sale") {
      if (t.dr_cr === "DR" && t.voucher_number) yestSalesVouchers.add(t.voucher_number);
      // Sales total: customer DRs (their AR increase = sale value to them)
      if (t.dr_cr === "DR") yestSales += amt;
    } else if (vt === "rcpt" || vt === "receipt") {
      if (t.dr_cr === "DR") yestReceipts += amt; // bank/cash DR side = money in
    } else if (vt === "pymt" || vt === "payment") {
      if (t.dr_cr === "CR") yestPayments += amt; // bank/cash CR side = money out
    }
  }
  // Sales sum can be ~2x if we counted both sides — for now we take the sales register convention:
  // sum of customer DR rows. (This is consistent with Sales Register reports.)

  // 4. Upcoming compliance (next 7 days, not yet filed)
  const { data: compliance } = await db
    .from("compliance_items")
    .select("title, due_date, status")
    .gte("due_date", today)
    .lte("due_date", in7days)
    .order("due_date", { ascending: true }) as {
      data: Array<{ title: string; due_date: string; status: string }> | null;
    };
  const upcomingCompliance = (compliance ?? [])
    .filter((c) => c.status !== "filed" && c.status !== "paid")
    .slice(0, 5)
    .map((c) => ({
      title:     c.title,
      due_date:  c.due_date,
      days_away: Math.max(0, Math.floor((new Date(c.due_date).getTime() - Date.now()) / 86_400_000)),
    }));

  // 5. Open alerts count (any module surfaces alerts via the `alerts` table if present)
  let alertCount = 0;
  try {
    const { count } = await db
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "open") as { count: number | null };
    alertCount = count ?? 0;
  } catch { /* alerts table may not exist yet — skip */ }

  return {
    today,
    yesterday,
    groupCash,
    groupAR,
    groupAROverdue,
    groupAP,
    groupRevenueMTD,
    companies: activeCos.map((c) => ({
      name:   c.name,
      short:  c.short_name,
      cash:   c.cash_balance,
      ar:     c.ar_outstanding,
      revMTD: c.monthly_revenue,
    })),
    yestSales,
    yestSalesCount: yestSalesVouchers.size,
    yestReceipts,
    yestPayments,
    topOverdue,
    upcomingCompliance,
    alertCount,
  };
}

// ── World-class WhatsApp message format ──────────────────────────────────────

function buildWhatsAppBrief(name: string, d: BriefData): string {
  const dt = fmtDateShort(new Date());
  const lines: string[] = [];

  // Header
  lines.push(`☀️ *Good morning, ${name}*`);
  lines.push(`*Robotek Group — Morning Brief*`);
  lines.push(`_${dt}_`);
  lines.push("");

  // Cash position
  lines.push(`💰 *Cash position (live)*`);
  lines.push(`Group: *${fmtINR(d.groupCash)}*`);
  // Per-company one-liner — only companies with non-zero cash
  const withCash = d.companies.filter((c) => Math.abs(c.cash) >= 1000);
  for (const c of withCash) {
    const cashStr = fmtINR(c.cash);
    const flag    = c.cash < 0 ? " ⚠️" : "";
    lines.push(`• ${c.short}: ${cashStr}${flag}`);
  }
  lines.push("");

  // Yesterday's pulse
  lines.push(`📈 *Yesterday's pulse*`);
  if (d.yestSalesCount > 0 || d.yestReceipts > 0 || d.yestPayments > 0) {
    lines.push(`Sales: ${fmtINR(d.yestSales)} (${d.yestSalesCount} vouchers)`);
    lines.push(`Receipts in: ${fmtINR(d.yestReceipts)}`);
    lines.push(`Payments out: ${fmtINR(d.yestPayments)}`);
  } else {
    lines.push(`No transactions booked yesterday.`);
  }
  lines.push("");

  // MTD revenue
  if (d.groupRevenueMTD > 0) {
    lines.push(`📊 *Revenue MTD*: ${fmtINR(d.groupRevenueMTD)}`);
    lines.push("");
  }

  // Receivables
  lines.push(`🧾 *Receivables*`);
  lines.push(`Total: ${fmtINR(d.groupAR)} | 31+ days: *${fmtINR(d.groupAROverdue)}*`);
  if (d.topOverdue.length > 0) {
    lines.push(`Top overdue:`);
    for (const p of d.topOverdue) {
      lines.push(`• ${p.name} — ${fmtINR(p.amount)} (${p.days}d, ${p.company})`);
    }
  }
  lines.push("");

  // Payables
  lines.push(`💼 *Payables*: ${fmtINR(d.groupAP)}`);
  lines.push("");

  // Compliance
  if (d.upcomingCompliance.length > 0) {
    lines.push(`📅 *Compliance — next 7 days*`);
    for (const c of d.upcomingCompliance) {
      const label = c.days_away === 0 ? "TODAY" : c.days_away === 1 ? "tomorrow" : `${c.days_away}d`;
      lines.push(`• ${label} — ${c.title}`);
    }
    lines.push("");
  }

  // Alerts
  if (d.alertCount > 0) {
    lines.push(`🔔 *Alerts*: ${d.alertCount} open`);
    lines.push("");
  }

  // Footer
  lines.push(`🔗 ${process.env.NEXT_PUBLIC_APP_URL ?? "https://robotek-project.vercel.app"}/dashboard`);
  lines.push(`— Robotek FinOS`);

  return lines.join("\n");
}

// ── Email (richer HTML version) ──────────────────────────────────────────────

async function sendEmail(brief: string, today: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey    = process.env.RESEND_API_KEY;
  const toEmail   = process.env.BRIEFING_TO_EMAIL;
  const fromEmail = process.env.BRIEFING_FROM_EMAIL ?? "briefing@robotek.in";

  if (!apiKey || !toEmail) return { sent: false, error: "Email not configured" };

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const dateLabel = new Date(today).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  // Convert WhatsApp markdown (*bold*, _italic_) to HTML
  const html = brief
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: #E52D31; padding: 20px 24px;">
    <h1 style="color: #fff; font-size: 18px; margin: 0; font-weight: 700;">Robotek FinOS — Morning Brief</h1>
    <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 4px 0 0;">${dateLabel}</p>
  </div>
  <div style="padding: 24px; font-size: 14px; line-height: 1.7; color: #1F1B20;">
${html}
  </div>
  <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #F5F4F4;">
    <p style="font-size: 11px; color: #9A9596; margin: 0;">Auto-generated · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://robotek-project.vercel.app"}/dashboard" style="color: #E52D31;">Open Dashboard →</a></p>
  </div>
</div>`;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to:   toEmail,
    subject: `[FinOS] Morning Brief — ${dateLabel}`,
    html: htmlBody,
    text: brief,
  });

  return error ? { sent: false, error: String(error) } : { sent: true };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * Shared brief-generation + send pipeline. Used by both the cron `GET` handler
 * and the manual `POST` (test-now button) handler.
 */
async function runBrief(supabase: ReturnType<typeof createClient<Database>>): Promise<{
  ok: boolean;
  date: string;
  recipients: Array<{ name: string; phone: string; sent: boolean; error?: string }>;
  email: { sent: boolean; error?: string };
  preview: string;
}> {
  const data    = await fetchBriefData(supabase);
  const config  = await getBriefingSettings();
  const waConfig = await getWhatsAppConfig();

  // Send WhatsApp to each recipient (only if briefing.enabled)
  type SendOutcome = { name: string; phone: string; sent: boolean; error?: string };
  const recipientResults: SendOutcome[] = [];
  if (config.enabled && config.recipients.length > 0) {
    for (let i = 0; i < config.recipients.length; i++) {
      const r = config.recipients[i];
      const message = buildWhatsAppBrief(r.name, data);
      try {
        const result = await sendWhatsApp(waConfig, r.phone, message);
        recipientResults.push({
          name:  r.name,
          phone: r.phone,
          sent:  result.sent,
          error: result.error,
        });
      } catch (err) {
        recipientResults.push({
          name:  r.name,
          phone: r.phone,
          sent:  false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
      // Inter-message delay (rate limit guard for Maytapi)
      if (i < config.recipients.length - 1) await sleep(2000);
    }
  }

  // Send email (CFO-style — uses recipient #1 as the "you")
  const previewName = config.recipients[0]?.name ?? "Team";
  const previewBrief = buildWhatsAppBrief(previewName, data);
  const emailResult = await sendEmail(previewBrief, data.today);

  // Log to notification_log so we can audit deliveries
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const rows = recipientResults.map((r) => ({
      channel:   "whatsapp",
      recipient: r.phone,
      subject:   "Morning Brief",
      body:      buildWhatsAppBrief(r.name, data),
      status:    r.sent ? "sent" : "failed",
      error:     r.error ?? null,
      metadata:  { type: "morning_brief", recipient_name: r.name },
    }));
    if (rows.length > 0) await db.from("notification_log").insert(rows);
  } catch { /* log failure is non-fatal */ }

  return {
    ok: true,
    date: data.today,
    recipients: recipientResults,
    email: emailResult,
    preview: previewBrief,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const result = await runBrief(supabase);
    console.log("[morning-brief] complete:", {
      date:       result.date,
      sentCount:  result.recipients.filter((r) => r.sent).length,
      failCount:  result.recipients.filter((r) => !r.sent).length,
      email:      result.email.sent,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[morning-brief] fatal:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/**
 * POST endpoint — used by the admin "Send Test Brief Now" button.
 * Same logic as GET but doesn't require CRON_SECRET (caller is the admin UI
 * which already enforces auth via the wrapping page).
 */
export async function POST(req: NextRequest) {
  // Lightweight protection: only allow from same origin
  const origin = req.headers.get("origin") ?? "";
  const host   = req.headers.get("host") ?? "";
  if (origin && !origin.includes(host)) {
    return NextResponse.json({ error: "Cross-origin not allowed" }, { status: 403 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const result = await runBrief(supabase);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[morning-brief] manual-trigger fatal:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
