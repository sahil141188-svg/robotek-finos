/**
 * Rule-based lead scoring (Zia-style, no ML needed). Pure + client-safe.
 * Produces a 0-100 score and a Hot / Warm / Cold band from lead attributes.
 */
import type { CrmLeadStatus, CrmLeadType } from "@/types/database";

export type ScoreBand = "hot" | "warm" | "cold";

export type ScorableLead = {
  source: string | null;
  est_value: number;
  lead_type: CrmLeadType;
  status: CrmLeadStatus;
  phone: string | null;
  email: string | null;
};

const SOURCE_WEIGHTS: Record<string, number> = {
  "Referral": 20,
  "Existing Customer": 20,
  "Exhibition": 14,
  "Field Visit": 12,
  "Website": 10,
  "WhatsApp": 8,
  "Phone Call": 6,
};

export function scoreLead(l: ScorableLead): { score: number; band: ScoreBand } {
  let s = 0;

  // Contactability
  if (l.phone) s += 15;
  if (l.email) s += 10;

  // Deal size
  if (l.est_value >= 100_000) s += 25;
  else if (l.est_value >= 50_000) s += 15;
  else if (l.est_value >= 10_000) s += 8;

  // Source quality
  s += SOURCE_WEIGHTS[(l.source ?? "").trim()] ?? 4;

  // Corporate buyers tend to be larger
  if (l.lead_type === "corporate") s += 10;

  // Status progression
  if (l.status === "contacted") s += 10;
  else if (l.status === "qualified") s += 25;
  else if (l.status === "converted") s += 40;
  else if (l.status === "unqualified") s -= 100;

  const score = Math.max(0, Math.min(100, s));
  const band: ScoreBand = score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";
  return { score, band };
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const BAND_COLORS: Record<ScoreBand, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-amber-100 text-amber-700",
  cold: "bg-blue-100 text-blue-700",
};
