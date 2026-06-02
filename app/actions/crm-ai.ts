"use server";

/**
 * AI Sales Coach for Sales OS.
 *
 * Three helpers for the Sales Coordinator:
 *   • getDailyPlan()    — "what should I do now" prioritized action list
 *   • draftReply()      — draft a WhatsApp reply to an enquiry
 *   • handleObjection() — suggested responses to a customer objection
 *
 * Uses Claude (AI SDK + @ai-sdk/anthropic) when ANTHROPIC_API_KEY is set.
 * Falls back to a deterministic, rule-based response otherwise — so the tab
 * is useful even without an API key.
 */

import { requireAuth } from "@/lib/auth";
import { getFollowups, getDeals, getLeads } from "@/lib/crm/queries";
import { DEAL_STAGE_LABELS } from "@/lib/crm/types";
import type { CrmLeadType } from "@/types/database";

export type CoachResult = { text: string; ai: boolean };

const ROBOTEK_CONTEXT = `Robotek India is a mobile-accessories manufacturer (chargers, data cables, audio, neckbands, etc.) established 2004, factory in Kundli (Haryana), HQ Delhi. It sells to channel partners (Super Stockists, distributors, dealers) and to corporate/OEM/bulk buyers. You are assisting a Sales Coordinator (SC) in the NBD (New Business Development) team who runs the new-customer journey: qualify the lead, arrange a meeting, negotiate, and convert — using timely WhatsApp follow-ups. Note: over-calling gets numbers blocked, so prefer well-timed, helpful messages.`;

/** Call Claude; returns null if no API key or on error (caller uses fallback). */
async function askClaude(system: string, prompt: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { text } = await generateText({
      model: anthropic("claude-3-5-haiku-20241022"),
      system,
      prompt,
    });
    return text?.trim() || null;
  } catch (err) {
    console.error("[crm-ai] generateText failed:", err);
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "no date";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ── 1. DAILY PLAN ───────────────────────────────────────────

export async function getDailyPlan(): Promise<CoachResult> {
  const { profile } = await requireAuth();
  const [followups, deals, leads] = await Promise.all([getFollowups(), getDeals(), getLeads()]);

  const mine = (ownerId: string | null) => ownerId === profile.id;
  // Prefer the SC's own items; if they own nothing, fall back to all NBD.
  const ownsAnything =
    followups.some((f) => mine(f.owner_id)) ||
    deals.some((d) => mine(d.owner_id)) ||
    leads.some((l) => mine(l.assigned_to));

  const fOf = (f: { owner_id: string | null }) => !ownsAnything || mine(f.owner_id);
  const dOf = (d: { owner_id: string | null }) => !ownsAnything || mine(d.owner_id);
  const lOf = (l: { assigned_to: string | null }) => !ownsAnything || mine(l.assigned_to);

  const overdue = followups.filter((f) => f.bucket === "overdue" && fOf(f));
  const today = followups.filter((f) => f.bucket === "today" && fOf(f));
  const hotDeals = deals.filter((d) => (d.stage === "negotiation" || d.stage === "quoted") && dOf(d));
  const newQualified = leads.filter((l) => l.status === "qualified" && lOf(l));
  const freshLeads = leads.filter((l) => (l.status === "new" || l.status === "contacted") && lOf(l));

  // Compact context for the model.
  const context = `
Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}.
Coordinator: ${profile.full_name}.

OVERDUE FOLLOW-UPS (${overdue.length}):
${overdue.slice(0, 10).map((f) => `- "${f.subject}" (${f.context_label ?? "no link"}), was due ${fmtDate(f.due_at)}`).join("\n") || "- none"}

DUE TODAY (${today.length}):
${today.slice(0, 10).map((f) => `- "${f.subject}" (${f.context_label ?? "no link"})`).join("\n") || "- none"}

DEALS IN NEGOTIATION/QUOTED (${hotDeals.length}):
${hotDeals.slice(0, 10).map((d) => `- "${d.title}" — ${DEAL_STAGE_LABELS[d.stage]}, value ₹${d.value}`).join("\n") || "- none"}

QUALIFIED LEADS (${newQualified.length}):
${newQualified.slice(0, 10).map((l) => `- ${l.name}${l.company ? ` (${l.company})` : ""}`).join("\n") || "- none"}

NEW / CONTACTED LEADS (${freshLeads.length}):
${freshLeads.slice(0, 10).map((l) => `- ${l.name}${l.company ? ` (${l.company})` : ""}`).join("\n") || "- none"}
`.trim();

  const ai = await askClaude(
    `${ROBOTEK_CONTEXT}\nYou are the SC's AI coach. Produce a short, prioritized action plan for RIGHT NOW. Rank the 5-7 most important actions (overdue first, then hot deals, then today's follow-ups, then qualified leads). For each: a one-line action + a 1-line reason. Where a message is the right move, include a ready-to-send WhatsApp line in quotes. Be specific, concise, no markdown headers — just a clean numbered list.`,
    `Here is the coordinator's current pipeline state. Give the plan:\n\n${context}`
  );

  if (ai) return { text: ai, ai: true };

  // ── Deterministic fallback ──
  const lines: string[] = [];
  let n = 1;
  for (const f of overdue.slice(0, 5)) lines.push(`${n++}. ⚠️ Overdue: ${f.subject}${f.context_label ? ` — ${f.context_label}` : ""} (was due ${fmtDate(f.due_at)}). Do this first.`);
  for (const d of hotDeals.slice(0, 3)) lines.push(`${n++}. 🔥 Push deal "${d.title}" (${DEAL_STAGE_LABELS[d.stage]}). Send a value/next-step message and book the next follow-up.`);
  for (const f of today.slice(0, 4)) lines.push(`${n++}. 📅 Today: ${f.subject}${f.context_label ? ` — ${f.context_label}` : ""}.`);
  for (const l of newQualified.slice(0, 3)) lines.push(`${n++}. ✅ Qualified lead ${l.name}${l.company ? ` (${l.company})` : ""} — confirm drip is running and try to arrange a meeting.`);
  if (lines.length === 0) lines.push("You're all caught up — no overdue or due-today items. Good time to qualify new leads or follow up on quoted deals.");

  const text = `Your plan for ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}:\n\n${lines.join("\n")}\n\n(Set ANTHROPIC_API_KEY for AI-written, personalized guidance.)`;
  return { text, ai: false };
}

// ── 2. DRAFT REPLY ──────────────────────────────────────────

export async function draftReply(input: {
  enquiry: string;
  leadName?: string | null;
  company?: string | null;
  leadType?: CrmLeadType | null;
  tone?: "warm" | "professional" | "concise";
}): Promise<CoachResult> {
  const enquiry = input.enquiry?.trim();
  if (!enquiry) return { text: "Paste the customer's enquiry/message first.", ai: false };

  const tone = input.tone ?? "warm";
  const who = input.leadName ? `${input.leadName}${input.company ? ` from ${input.company}` : ""}` : "the customer";
  const typeNote = input.leadType === "corporate" ? "This is a corporate/OEM buyer." : input.leadType === "channel_partner" ? "This is a channel partner (Super Stockist/distributor/dealer)." : "";

  const ai = await askClaude(
    `${ROBOTEK_CONTEXT}\nWrite a single WhatsApp reply the SC can send. Tone: ${tone}. Under 80 words, friendly and professional, Indian B2B style, end with one clear next step (e.g., share catalogue, propose a call/meeting, ask for requirement). No markdown, no preamble — output ONLY the message text.`,
    `Reply to ${who}. ${typeNote}\n\nTheir message/enquiry:\n"${enquiry}"`
  );

  if (ai) return { text: ai, ai: true };

  const name = input.leadName?.split(" ")[0] ?? "there";
  const text = `Hi ${name}, thank you for reaching out to Robotek India 🙏 We'd be glad to help with your requirement. Could you share the items and approximate quantity you're looking at? I'll send our catalogue and best pricing right away. — Team Robotek`;
  return { text, ai: false };
}

// ── 3. OBJECTION HANDLING ───────────────────────────────────

const OBJECTION_FALLBACKS: { match: RegExp; responses: string[] }[] = [
  {
    match: /price|expensive|costl|rate|margin/i,
    responses: [
      "I understand price matters. Our pricing reflects BIS-certified quality and consistent supply — fewer returns and faster rotation, which protects your margin. Can I show you the numbers on a fast-moving SKU?",
      "Happy to find the right fit for your budget. If we look at your top-selling categories, I can suggest a starter range with the best margin-to-rotation balance.",
    ],
  },
  {
    match: /supplier|already have|existing|current vendor/i,
    responses: [
      "Totally fair — most of our partners already had a supplier. Many added Robotek for specific fast-movers where we're stronger on quality and availability. Could we start with just 1-2 SKUs as a trial?",
      "No need to switch everything. Let's test us on one category you struggle to keep in stock and see the difference in rotation.",
    ],
  },
  {
    match: /quality|durab|warrant|defect|return/i,
    responses: [
      "Quality is exactly why partners stay with us — BIS-certified, in-house QC at our Kundli plant. I can send specs and arrange a sample set so you can check before committing.",
      "We back our products and keep return rates low. Let me send a sample kit so your team can verify quality first-hand.",
    ],
  },
  {
    match: /moq|minimum|quantity|bulk/i,
    responses: [
      "We can keep the first order light so you're comfortable. Tell me your market's fastest movers and I'll suggest a small, smart starter mix.",
      "Flexible to start — let's begin with a manageable quantity and scale once rotation proves out.",
    ],
  },
  {
    match: /deliver|ship|logistic|time|lead time/i,
    responses: [
      "We plan dispatch around your needs — share your location and I'll confirm realistic timelines. Consistent on-time supply is a core promise.",
      "Let me confirm the delivery schedule for your area so you can plan stock with confidence.",
    ],
  },
];

export async function handleObjection(input: {
  objection: string;
  leadType?: CrmLeadType | null;
}): Promise<CoachResult> {
  const objection = input.objection?.trim();
  if (!objection) return { text: "Type the objection the customer raised.", ai: false };

  const typeNote = input.leadType === "corporate" ? "Buyer type: corporate/OEM." : input.leadType === "channel_partner" ? "Buyer type: channel partner (SS/distributor/dealer)." : "";

  const ai = await askClaude(
    `${ROBOTEK_CONTEXT}\nYou are a B2B sales coach. Given a customer objection, give 2-3 short, practical responses the SC can say or send on WhatsApp. Confident and helpful, never pushy. Indian channel-sales context. Number them. No markdown headers.`,
    `${typeNote}\n\nObjection: "${objection}"\n\nGive 2-3 suggested responses.`
  );

  if (ai) return { text: ai, ai: true };

  const hit = OBJECTION_FALLBACKS.find((o) => o.match.test(objection));
  const responses = hit?.responses ?? [
    "Acknowledge their concern, then reframe to value: quality + reliable supply = better rotation and margin for them.",
    "Offer a low-risk next step: a sample set or a small trial order so they can evaluate before committing.",
  ];
  const text = responses.map((r, i) => `${i + 1}. ${r}`).join("\n\n") + "\n\n(Set ANTHROPIC_API_KEY for AI-tailored responses.)";
  return { text, ai: false };
}
