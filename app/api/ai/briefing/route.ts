/**
 * CFO Morning Briefing — streaming AI narrative.
 *
 * POST /api/ai/briefing
 * Body: { report: IntelligenceReport }
 *
 * If ANTHROPIC_API_KEY is set → streams a real Claude narrative.
 * Otherwise → streams a template-based briefing (no API key required).
 *
 * The client reads the stream and displays it character-by-character.
 */

import { NextRequest } from "next/server";
import type { IntelligenceReport } from "@/app/actions/ai-insights";

function formatINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

/** Template-based briefing when no Claude API key is set */
function generateTemplateBriefing(report: IntelligenceReport): string {
  const { healthScore, summary, anomalies, duplicates, fraudSignals, gstIssues, vendorRisk, whatChanged } = report;

  const date = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const netDir = summary.netCashflow >= 0 ? "surplus" : "deficit";
  const cashChanged = whatChanged.find((w) => w.metric === "Cash Balance");

  let brief = `Good morning. Here is your financial briefing for ${date}.\n\n`;

  brief += `FINANCIAL HEALTH: ${healthScore.grade} — ${healthScore.total}/100\n`;
  brief += `${healthScore.summary}\n\n`;

  brief += `CASH POSITION\n`;
  brief += `Running balance: ${formatINR(summary.cashBalance)}. `;
  brief += `Total inflow: ${formatINR(summary.totalInflow)}, Total outflow: ${formatINR(summary.totalOutflow)}. `;
  brief += `Net ${netDir}: ${formatINR(Math.abs(summary.netCashflow))}.`;
  if (cashChanged && cashChanged.direction !== "flat") {
    brief += ` Cash ${cashChanged.direction === "up" ? "increased" : "decreased"} ${formatINR(Math.abs(cashChanged.delta))} vs yesterday.`;
  }
  brief += "\n\n";

  if (summary.alertCount > 0) {
    brief += `ALERTS REQUIRING ATTENTION (${summary.alertCount} total)\n`;
    if (anomalies.length > 0) {
      brief += `• ${anomalies.length} unusual transaction${anomalies.length > 1 ? "s" : ""} detected. `;
      const top = anomalies[0];
      brief += `Most significant: ${top.ledger} — ${formatINR(top.amount)} (${top.reason}).\n`;
    }
    if (duplicates.length > 0) {
      brief += `• ${duplicates.length} potential duplicate payment${duplicates.length > 1 ? "s" : ""} flagged for ${duplicates[0].ledger}. Verify before next payment run.\n`;
    }
    if (fraudSignals.filter((f) => f.risk === "high").length > 0) {
      const highRisk = fraudSignals.filter((f) => f.risk === "high");
      brief += `• ${highRisk.length} high-risk fraud signal${highRisk.length > 1 ? "s" : ""}: ${highRisk[0].signal} on ${highRisk[0].ledger}.\n`;
    }
    if (gstIssues.length > 0) {
      brief += `• ${gstIssues.length} GST mismatch${gstIssues.length > 1 ? "es" : ""} — review with your CA before GSTR-3B filing.\n`;
    }
    brief += "\n";
  } else {
    brief += "No critical alerts today. All systems normal.\n\n";
  }

  if (vendorRisk.filter((v) => v.riskLevel === "high").length > 0) {
    const highRiskVendors = vendorRisk.filter((v) => v.riskLevel === "high");
    brief += `VENDOR RISK\n`;
    brief += `${highRiskVendors.length} high-risk vendor${highRiskVendors.length > 1 ? "s" : ""}: `;
    brief += highRiskVendors.map((v) => `${v.name} (${v.concentration}% of AP)`).join(", ");
    brief += ". Consider diversifying suppliers.\n\n";
  }

  brief += `TRANSACTIONS\n`;
  brief += `${summary.totalTxns} transactions on record. `;

  const todayTxns = whatChanged.find((w) => w.metric === "Transactions Today");
  if (todayTxns && todayTxns.current > 0) {
    brief += `${todayTxns.current} transaction${todayTxns.current !== 1 ? "s" : ""} today`;
    if (todayTxns.direction !== "flat") {
      brief += ` (${todayTxns.direction === "up" ? "+" : ""}${todayTxns.delta} vs yesterday)`;
    }
    brief += ".";
  }
  brief += "\n\n";

  brief += `Have a productive day.`;

  return brief;
}

export async function POST(req: NextRequest) {
  const { report } = (await req.json()) as { report: IntelligenceReport };

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── Claude-powered briefing ───────────────────────────────────────────────
  if (apiKey) {
    const { streamText }    = await import("ai");
    const { anthropic }     = await import("@ai-sdk/anthropic");

    const { summary, healthScore, anomalies, duplicates, fraudSignals, gstIssues, vendorRisk } = report;

    const context = `
Financial data as of ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}:

Health Score: ${healthScore.total}/100 (Grade ${healthScore.grade})
- Cash Health: ${healthScore.cashHealth}/25
- AR Health: ${healthScore.arHealth}/25
- AP Health: ${healthScore.apHealth}/25
- Compliance: ${healthScore.complianceH}/25

Cash Position:
- Running Balance: ${formatINR(summary.cashBalance)}
- Total Inflow: ${formatINR(summary.totalInflow)}
- Total Outflow: ${formatINR(summary.totalOutflow)}
- Net: ${formatINR(summary.netCashflow)}

Alerts:
- Anomalies: ${anomalies.length} (top: ${anomalies[0]?.reason ?? "none"})
- Duplicate payments: ${duplicates.length}
- Fraud signals (high): ${fraudSignals.filter((f) => f.risk === "high").length}
- GST mismatches: ${gstIssues.length}

Top vendor risks: ${vendorRisk.filter((v) => v.riskLevel === "high").map((v) => `${v.name} (${v.concentration}% of AP)`).join(", ") || "none"}
`;

    const result = streamText({
      model: anthropic("claude-3-5-haiku-20241022"),
      system: `You are the AI CFO assistant for Robotek India, a mobile accessories manufacturer.
Write a crisp, executive morning briefing for the CEO/CFO.
Use Indian number formatting (Lakhs/Crores). Be direct — no fluff.
Structure: Health Summary → Cash Position → Alerts → Vendor Risk → Today's Focus.
Keep it under 250 words. Use plain paragraphs, no markdown.`,
      prompt: `Generate a morning financial briefing based on this data:\n\n${context}`,
    });

    return result.toTextStreamResponse();
  }

  // ── Template fallback (no API key needed) ────────────────────────────────
  const text = generateTemplateBriefing(report);

  // Stream the template text in small chunks for a typewriter effect
  const encoder = new TextEncoder();
  const CHUNK   = 4; // characters per chunk
  const stream  = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < text.length; i += CHUNK) {
        controller.enqueue(encoder.encode(text.slice(i, i + CHUNK)));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
