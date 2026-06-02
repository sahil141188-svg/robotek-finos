/**
 * Drip campaign sequences for Sales OS leads.
 *
 * Two lead types get different warm-up sequences. When a lead is qualified
 * (or "Start drip" is clicked), these steps are scheduled as WhatsApp messages
 * on day offsets from enrollment. A daily cron sends the ones that are due.
 *
 * Keep this client-safe (pure data + a tiny renderer) — used for labels in UI.
 */
import type { CrmLeadType, CrmDripStatus } from "@/types/database";

export const LEAD_TYPE_LABELS: Record<CrmLeadType, string> = {
  corporate:       "Corporate",
  channel_partner: "Channel Partner",
};

export const LEAD_TYPE_HINT: Record<CrmLeadType, string> = {
  corporate:       "Brands, OEMs, bulk B2B buyers",
  channel_partner: "Super Stockist / Distributor / Dealer",
};

export const DRIP_STATUS_LABELS: Record<CrmDripStatus, string> = {
  none:    "No drip",
  active:  "Drip active",
  done:    "Drip done",
  stopped: "Drip stopped",
};

export const DRIP_STATUS_COLORS: Record<CrmDripStatus, string> = {
  none:    "bg-brand-gray-light text-brand-gray-mid",
  active:  "bg-emerald-100 text-emerald-700",
  done:    "bg-blue-100 text-blue-700",
  stopped: "bg-amber-100 text-amber-700",
};

export type DripStep = {
  step: number;   // 1-based
  day: number;    // days after enrollment
  body: string;   // supports {{name}} and {{company}} placeholders
};

/**
 * Sequences. ~5 touches over 3 weeks — enough to stay warm without spamming.
 * Edit the copy here; new enrollments use the latest version.
 */
export const DRIP_SEQUENCES: Record<CrmLeadType, DripStep[]> = {
  corporate: [
    { step: 1, day: 0,  body: "Hi {{name}}, thank you for connecting with Robotek India 🙏 We manufacture mobile accessories (chargers, cables, audio & more) since 2004 — supplying brands & OEMs across India. I'll share how we can support {{company}}. — Team Robotek" },
    { step: 2, day: 3,  body: "Hi {{name}}, a quick note on quality: our products are BIS-certified and made in our Kundli (Haryana) facility with in-house QC. Happy to share our full catalogue and specs whenever you're ready. — Team Robotek" },
    { step: 3, day: 7,  body: "Hi {{name}}, many brands choose Robotek for consistent quality + on-time bulk supply. We can do custom packaging/branding for {{company}} too. Would a quick call this week help?" },
    { step: 4, day: 14, body: "Hi {{name}}, would you like a sample kit or a price quote for your requirement? Just share the items & quantity and we'll get it across promptly. — Team Robotek" },
    { step: 5, day: 21, body: "Hi {{name}}, checking in — is there anything we can help {{company}} with on mobile accessories? We're here whenever the timing is right. — Team Robotek 🙏" },
  ],
  channel_partner: [
    { step: 1, day: 0,  body: "Hi {{name}}, thanks for your interest in partnering with Robotek India 🤝 We're a 2004-established mobile-accessories manufacturer with strong dealer/distributor margins and fast-moving SKUs. Excited to explore {{company}} working with us!" },
    { step: 2, day: 3,  body: "Hi {{name}}, our fastest-moving lines (chargers, data cables, neckbands) give partners healthy margins and quick rotation. I can share the partner price list + current schemes — want me to send it?" },
    { step: 3, day: 7,  body: "Hi {{name}}, we support our channel partners with territory focus, marketing material, and on-ground help from our sales team. Good products + good support = repeat sales for you 💪" },
    { step: 4, day: 14, body: "Hi {{name}}, ready to start? We can send a sample set or set up your first order for {{company}} on easy terms. Tell me what your market moves most and I'll recommend a starter range." },
    { step: 5, day: 21, body: "Hi {{name}}, just following up 🙏 Whenever you'd like to stock Robotek, we'll make onboarding smooth. Happy to answer any questions on pricing, margins or supply." },
  ],
};

/** Fill {{name}} / {{company}} placeholders. */
export function renderDrip(body: string, vars: { name?: string | null; company?: string | null }): string {
  return body
    .replace(/\{\{\s*name\s*\}\}/g, (vars.name ?? "there").trim() || "there")
    .replace(/\{\{\s*company\s*\}\}/g, (vars.company ?? "your business").trim() || "your business");
}
