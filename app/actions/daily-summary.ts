"use server";

/**
 * Daily Summary — "What changed today?" card action.
 *
 * Compares today's transactions vs yesterday's, then calls Claude Haiku
 * to produce 5 concise bullet points. Falls back to template bullets when
 * no ANTHROPIC_API_KEY is configured.
 */

import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";

type TxRow = {
  transaction_date: string;
  amount: number;
  dr_cr: "DR" | "CR";
  ledger_name: string;
};

function fmtINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `₹${(abs / 1_00_000).toFixed(1)} L`;
  if (abs >= 1_000)       return `₹${(abs / 1_000).toFixed(0)} K`;
  return `₹${abs.toFixed(0)}`;
}

function sum(arr: TxRow[], type: "DR" | "CR"): number {
  return arr.filter((t) => t.dr_cr === type).reduce((s, t) => s + Number(t.amount), 0);
}

/** Template bullets used when Claude API is unavailable */
function templateBullets(
  todayCount: number, yestCount: number,
  todayIn: number,   yestIn: number,
  todayOut: number,  yestOut: number,
  todayNet: number,  yestNet: number,
): string[] {
  const countDelta = todayCount - yestCount;
  const inDelta    = todayIn  - yestIn;
  const outDelta   = todayOut - yestOut;
  const netDelta   = todayNet - yestNet;

  return [
    todayCount === 0
      ? "No transactions recorded today — import Busy data to see live figures"
      : `${todayCount} transactions processed today (${countDelta >= 0 ? "+" : ""}${countDelta} vs yesterday)`,
    todayIn === 0
      ? "No inflows recorded today"
      : `Inflow: ${fmtINR(todayIn)} today ${inDelta >= 0 ? "↑" : "↓"} ${fmtINR(Math.abs(inDelta))} vs yesterday`,
    todayOut === 0
      ? "No outflows recorded today"
      : `Outflow: ${fmtINR(todayOut)} today ${outDelta >= 0 ? "↑" : "↓"} ${fmtINR(Math.abs(outDelta))} vs yesterday`,
    todayNet >= 0
      ? `Net position: +${fmtINR(todayNet)} — positive cash day`
      : `Net position: −${fmtINR(Math.abs(todayNet))} — outflows exceeded inflows`,
    netDelta >= 0
      ? "Overall cash flow is trending better than yesterday"
      : "Cash flow is lower than yesterday — review high-value outflows",
  ];
}

export type DailySummaryResult = {
  bullets: string[];
  todayDate: string;
  hasClaude: boolean;
};

/**
 * Fetch today vs yesterday transaction deltas and generate a 5-bullet summary.
 * Uses Claude Haiku (claude-haiku-4-5-20251001) when ANTHROPIC_API_KEY is set.
 */
export async function getDailySummaryBullets(): Promise<DailySummaryResult> {
  const supabase   = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db         = supabase as any;
  const companyId  = await getSelectedCompanyId();

  const today     = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  // One query for both days to minimise round-trips
  let query = db
    .from("transactions")
    .select("transaction_date, amount, dr_cr, ledger_name")
    .in("transaction_date", [today, yesterday]);
  if (companyId) query = query.eq("company_id", companyId);

  const { data } = await query as { data: TxRow[] | null };

  const allTxns   = data ?? [];
  const todayTxns = allTxns.filter((t) => t.transaction_date === today);
  const yestTxns  = allTxns.filter((t) => t.transaction_date === yesterday);

  const todayIn  = sum(todayTxns, "CR");
  const todayOut = sum(todayTxns, "DR");
  const yestIn   = sum(yestTxns,  "CR");
  const yestOut  = sum(yestTxns,  "DR");
  const todayNet = todayIn - todayOut;
  const yestNet  = yestIn  - yestOut;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      bullets:    templateBullets(todayTxns.length, yestTxns.length, todayIn, yestIn, todayOut, yestOut, todayNet, yestNet),
      todayDate:  today,
      hasClaude:  false,
    };
  }

  // ── Claude Haiku call ────────────────────────────────────────────────────────
  const deltaIn  = todayIn  - yestIn;
  const deltaOut = todayOut - yestOut;
  const topLedgers = [...new Set(todayTxns.slice(0, 6).map((t) => t.ledger_name))].join(", ");

  const userPrompt = `Today's snapshot vs yesterday for Robotek India (${today}):
- Transactions today: ${todayTxns.length} (yesterday: ${yestTxns.length}, Δ ${todayTxns.length - yestTxns.length > 0 ? "+" : ""}${todayTxns.length - yestTxns.length})
- Inflow today: ${fmtINR(todayIn)} (yesterday: ${fmtINR(yestIn)}, Δ ${deltaIn >= 0 ? "+" : ""}${fmtINR(Math.abs(deltaIn))})
- Outflow today: ${fmtINR(todayOut)} (yesterday: ${fmtINR(yestOut)}, Δ ${deltaOut >= 0 ? "+" : ""}${fmtINR(Math.abs(deltaOut))})
- Net cash today: ${fmtINR(todayNet)} (yesterday: ${fmtINR(yestNet)})
${topLedgers ? `- Key ledgers active today: ${topLedgers}` : "- No transactions imported for today yet"}

Write exactly 5 bullet points. Each bullet: max 18 words, starts with a relevant emoji, no markdown. One line each.`;

  try {
    const { generateText } = await import("ai");
    const { anthropic }    = await import("@ai-sdk/anthropic");

    const { text } = await generateText({
      model:     anthropic("claude-haiku-4-5-20251001"),
      system:    "You are a CFO assistant for an Indian manufacturing company. Use Indian number format (Lakhs/Crores). Output exactly 5 bullet lines, each starting with an emoji then a space. No headers, no extra text.",
      prompt:    userPrompt,
      maxOutputTokens: 300,
    });

    const bullets = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      // Keep lines that start with an emoji (broad Unicode emoji range)
      .filter((l) => /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l))
      .slice(0, 5);

    if (bullets.length >= 3) {
      return { bullets, todayDate: today, hasClaude: true };
    }
  } catch (err) {
    console.error("[daily-summary] Claude call failed:", err);
  }

  // Fallback: template bullets
  return {
    bullets:   templateBullets(todayTxns.length, yestTxns.length, todayIn, yestIn, todayOut, yestOut, todayNet, yestNet),
    todayDate: today,
    hasClaude: false,
  };
}
