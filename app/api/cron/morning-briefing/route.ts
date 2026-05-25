/**
 * CFO Morning Briefing — Vercel Cron Route
 *
 * Schedule: 7:00 AM IST = 01:30 UTC daily  →  "30 1 * * *" in vercel.json
 * Protected by CRON_SECRET (Vercel sets this automatically).
 *
 * What it does:
 *   1. Fetches KPIs for all active companies (or scoped to one company)
 *   2. Pulls overdue tasks + today's compliance deadlines
 *   3. Calls Claude Haiku to write a concise briefing narrative
 *   4. Sends the briefing via Resend (email) to CFO / CEO
 *   5. Optionally sends a short WhatsApp summary via Twilio/Meta
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — Service-role key (bypasses RLS)
 *   ANTHROPIC_API_KEY             — Claude Haiku (optional — template fallback)
 *   RESEND_API_KEY                — Resend email API key
 *   BRIEFING_TO_EMAIL             — Recipient address (CFO / CEO email)
 *   BRIEFING_FROM_EMAIL           — Verified sender in Resend (e.g. briefing@robotek.in)
 *
 * Optional env vars (WhatsApp):
 *   TWILIO_ACCOUNT_SID            — Twilio account SID
 *   TWILIO_AUTH_TOKEN             — Twilio auth token
 *   TWILIO_WHATSAPP_FROM          — e.g. "whatsapp:+14155238886"
 *   BRIEFING_WHATSAPP_TO          — recipient e.g. "+919876543210"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — allow without secret
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `₹${(abs / 1_00_000).toFixed(1)} L`;
  if (abs >= 1_000)       return `₹${(abs / 1_000).toFixed(0)} K`;
  return `₹${abs.toFixed(0)}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Data fetching ─────────────────────────────────────────────────────────────

type TxRow = {
  transaction_date: string;
  amount: number;
  dr_cr: "DR" | "CR";
  ledger_name: string;
};

type ComplianceRow = {
  title: string;
  due_date: string;
  status: string;
};

type TaskRow = {
  title: string;
  due_date: string | null;
  priority: string;
  assigned_to: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  monthly_revenue: number;
  cash_balance: number;
  ap_outstanding: number;
  ar_outstanding: number;
  compliance_score: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBriefingData(supabase: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  // Today's + yesterday's transactions (across all companies — group view)
  const { data: txns } = await db
    .from("transactions")
    .select("transaction_date, amount, dr_cr, ledger_name")
    .in("transaction_date", [today, yesterday]) as { data: TxRow[] | null };

  // Compliance items due today or already overdue
  const { data: complianceItems } = await db
    .from("compliance_items")
    .select("title, due_date, status")
    .or(`due_date.eq.${today},status.eq.overdue`) as { data: ComplianceRow[] | null };

  // Overdue tasks
  const { data: overdueTasks } = await db
    .from("tasks")
    .select("title, due_date, priority, assigned_to")
    .eq("status", "pending")
    .lte("due_date", today)
    .order("priority", { ascending: false })
    .limit(10) as { data: TaskRow[] | null };

  // Company summaries for group overview
  const { data: companies } = await db
    .from("companies")
    .select("id, name, monthly_revenue, cash_balance, ap_outstanding, ar_outstanding, compliance_score")
    .eq("status", "active")
    .order("sort_order", { ascending: true }) as { data: CompanyRow[] | null };

  const allTxns   = txns ?? [];
  const todayTxns = allTxns.filter((t) => t.transaction_date === today);
  const yestTxns  = allTxns.filter((t) => t.transaction_date === yesterday);

  function sum(arr: TxRow[], type: "DR" | "CR") {
    return arr.filter((t) => t.dr_cr === type).reduce((s, t) => s + Number(t.amount), 0);
  }

  return {
    today,
    todayIn:   sum(todayTxns, "CR"),
    todayOut:  sum(todayTxns, "DR"),
    todayCount: todayTxns.length,
    yestIn:    sum(yestTxns, "CR"),
    yestOut:   sum(yestTxns, "DR"),
    yestCount: yestTxns.length,
    compliance: complianceItems ?? [],
    overdueTasks: overdueTasks ?? [],
    companies: companies ?? [],
  };
}

// ── Claude narrative ──────────────────────────────────────────────────────────

async function generateNarrative(data: Awaited<ReturnType<typeof fetchBriefingData>>): Promise<string> {
  const {
    today, todayIn, todayOut, todayCount,
    yestIn, yestOut, yestCount,
    compliance, overdueTasks, companies,
  } = data;

  const todayNet  = todayIn  - todayOut;
  const yestNet   = yestIn   - yestOut;

  const complianceDueToday = compliance.filter((c) => c.due_date === today && c.status !== "filed" && c.status !== "paid");
  const complianceOverdue  = compliance.filter((c) => c.status === "overdue");

  const groupRevenue = companies.reduce((s, c) => s + c.monthly_revenue, 0);
  const groupCash    = companies.reduce((s, c) => s + c.cash_balance, 0);
  const groupAP      = companies.reduce((s, c) => s + c.ap_outstanding, 0);
  const groupAR      = companies.reduce((s, c) => s + c.ar_outstanding, 0);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const { generateText } = await import("ai");
      const { anthropic }    = await import("@ai-sdk/anthropic");

      const context = `Date: ${fmtDate(today)}

TODAY'S TRANSACTION ACTIVITY
- Transactions today: ${todayCount} (yesterday: ${yestCount})
- Inflow today: ${fmtINR(todayIn)} (yesterday: ${fmtINR(yestIn)})
- Outflow today: ${fmtINR(todayOut)} (yesterday: ${fmtINR(yestOut)})
- Net today: ${fmtINR(todayNet)} (yesterday: ${fmtINR(yestNet)})

GROUP FINANCIALS (all companies)
- Monthly Revenue: ${fmtINR(groupRevenue)}
- Cash Balance: ${fmtINR(groupCash)}
- AP Outstanding: ${fmtINR(groupAP)}
- AR Outstanding: ${fmtINR(groupAR)}

COMPLIANCE
- Due today (not filed): ${complianceDueToday.length} items${complianceDueToday.length > 0 ? ": " + complianceDueToday.map((c) => c.title).join(", ") : ""}
- Overdue: ${complianceOverdue.length} items${complianceOverdue.length > 0 ? ": " + complianceOverdue.slice(0, 3).map((c) => c.title).join(", ") : ""}

OVERDUE TASKS
- ${overdueTasks.length} pending task${overdueTasks.length !== 1 ? "s" : ""} past due date${overdueTasks.length > 0 ? ":\n" + overdueTasks.slice(0, 5).map((t) => `  • ${t.title} (${t.priority}, assigned: ${t.assigned_to ?? "unassigned"})`).join("\n") : ""}`;

      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        system: `You are the AI CFO assistant for Robotek India Group, a mobile accessories manufacturer (500+ employees, manufacturing in Kundli Haryana).
Write a crisp executive morning briefing for the CEO/CFO.
Use Indian number format (Lakhs/Crores). Be direct — no filler phrases.
Structure it in clear sections: Cash & Transactions → Compliance → Overdue Tasks → Today's Priority.
Plain text only — no markdown. Max 280 words. End with one specific action item.`,
        prompt: `Write the morning financial briefing:\n\n${context}`,
        maxOutputTokens: 450,
      });

      return text.trim();
    } catch (err) {
      console.error("[morning-briefing] Claude call failed:", err);
    }
  }

  // Template fallback
  const lines: string[] = [
    `ROBOTEK INDIA GROUP — MORNING BRIEFING`,
    `${fmtDate(today)}`,
    ``,
    `CASH & TRANSACTIONS`,
    `Transactions today: ${todayCount} (yesterday: ${yestCount}).`,
    `Inflow: ${fmtINR(todayIn)} · Outflow: ${fmtINR(todayOut)} · Net: ${todayNet >= 0 ? "+" : ""}${fmtINR(todayNet)}.`,
    ``,
    `GROUP FINANCIALS`,
    `Monthly Revenue: ${fmtINR(groupRevenue)} · Cash: ${fmtINR(groupCash)} · AP: ${fmtINR(groupAP)} · AR: ${fmtINR(groupAR)}.`,
    ``,
    `COMPLIANCE`,
  ];

  if (complianceDueToday.length === 0 && complianceOverdue.length === 0) {
    lines.push("No compliance deadlines today. All items on track.");
  } else {
    if (complianceDueToday.length > 0) {
      lines.push(`DUE TODAY (${complianceDueToday.length}): ${complianceDueToday.map((c) => c.title).join(", ")}.`);
    }
    if (complianceOverdue.length > 0) {
      lines.push(`OVERDUE (${complianceOverdue.length}): ${complianceOverdue.slice(0, 3).map((c) => c.title).join(", ")}.`);
    }
  }

  lines.push(``, `OVERDUE TASKS`);
  if (overdueTasks.length === 0) {
    lines.push("No overdue tasks. Team is on schedule.");
  } else {
    overdueTasks.slice(0, 5).forEach((t) => {
      lines.push(`• ${t.title} [${t.priority}]${t.assigned_to ? ` — ${t.assigned_to}` : ""}`);
    });
  }

  lines.push(``, `TODAY'S PRIORITY`);
  if (complianceDueToday.length > 0) {
    lines.push(`File ${complianceDueToday[0].title} today — deadline is today.`);
  } else if (overdueTasks.length > 0) {
    lines.push(`Clear overdue task: "${overdueTasks[0].title}".`);
  } else {
    lines.push(`No critical deadlines today. Focus on revenue collection.`);
  }

  return lines.join("\n");
}

// ── Email sending via Resend ──────────────────────────────────────────────────

async function sendEmail(narrative: string, today: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail   = process.env.BRIEFING_TO_EMAIL;
  const fromEmail = process.env.BRIEFING_FROM_EMAIL ?? "briefing@robotek.in";

  if (!apiKey || !toEmail) {
    console.log("[morning-briefing] Email skipped — RESEND_API_KEY or BRIEFING_TO_EMAIL not set.");
    return { sent: false, error: "Email not configured" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const dateLabel = new Date(today).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: #E52D31; padding: 20px 24px;">
    <h1 style="color: #fff; font-size: 18px; margin: 0; font-weight: 700;">Robotek FinOS — Morning Briefing</h1>
    <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 4px 0 0;">${dateLabel}</p>
  </div>
  <div style="padding: 24px; white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #1F1B20;">
${narrative}
  </div>
  <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #F5F4F4;">
    <p style="font-size: 11px; color: #9A9596; margin: 0;">Robotek FinOS · Auto-generated at 07:00 IST · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://finos.robotek.in"}/dashboard" style="color: #E52D31;">Open Dashboard →</a></p>
  </div>
</div>`;

  const { error } = await resend.emails.send({
    from:    fromEmail,
    to:      toEmail,
    subject: `[FinOS] CFO Briefing — ${dateLabel}`,
    html:    htmlBody,
    text:    narrative,
  });

  if (error) {
    console.error("[morning-briefing] Resend error:", error);
    return { sent: false, error: String(error) };
  }

  return { sent: true };
}

// ── WhatsApp summary via Twilio ───────────────────────────────────────────────

async function sendWhatsAppSummary(data: Awaited<ReturnType<typeof fetchBriefingData>>): Promise<{ sent: boolean; skipped?: boolean }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM;
  const to         = process.env.BRIEFING_WHATSAPP_TO;

  if (!accountSid || !authToken || !from || !to) {
    console.log("[morning-briefing] WhatsApp skipped — Twilio credentials not set.");
    return { sent: false, skipped: true };
  }

  const { today, todayIn, todayOut, todayCount, compliance, overdueTasks } = data;
  const todayNet = todayIn - todayOut;
  const complianceDueToday = compliance.filter((c) => c.due_date === today && c.status !== "filed" && c.status !== "paid");

  const msg = [
    `📊 *Robotek FinOS — Morning Briefing* (${new Date(today).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`,
    ``,
    `💵 Txns today: ${todayCount} | Net: ${fmtINR(todayNet)}`,
    complianceDueToday.length > 0
      ? `⚠️ Compliance due today: ${complianceDueToday.map((c) => c.title).join(", ")}`
      : `✅ No compliance deadlines today`,
    overdueTasks.length > 0
      ? `🔴 ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? "s" : ""}: ${overdueTasks[0].title}${overdueTasks.length > 1 ? ` +${overdueTasks.length - 1} more` : ""}`
      : `✅ No overdue tasks`,
    ``,
    `🔗 Dashboard: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://finos.robotek.in"}/dashboard`,
  ].join("\n");

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: msg });
    const res  = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[morning-briefing] Twilio WhatsApp error:", errText);
      return { sent: false };
    }

    return { sent: true };
  } catch (err) {
    console.error("[morning-briefing] Twilio error:", err);
    return { sent: false };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const data      = await fetchBriefingData(supabase);
    const narrative = await generateNarrative(data);

    const [emailResult, waResult] = await Promise.all([
      sendEmail(narrative, data.today),
      sendWhatsAppSummary(data),
    ]);

    console.log("[morning-briefing] Complete:", {
      email:    emailResult.sent,
      whatsapp: waResult.sent,
    });

    return NextResponse.json({
      ok:       true,
      date:     data.today,
      email:    emailResult,
      whatsapp: waResult,
      preview:  narrative.slice(0, 200) + "…",
    });
  } catch (err) {
    console.error("[morning-briefing] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
