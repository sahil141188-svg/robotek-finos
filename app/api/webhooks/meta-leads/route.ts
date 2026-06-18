/**
 * Meta Lead Ads webhook.
 *
 * GET  — verification handshake (Meta calls this when you register the webhook)
 * POST — receives new lead submissions from Meta Lead Form ads
 *
 * Setup in Meta Business Suite:
 *   1. Go to Business Suite → Leads Centre → Webhooks
 *   2. Paste this URL: https://YOUR_DOMAIN/api/webhooks/meta-leads
 *   3. Verify token: robotek_meta_2024  (set META_VERIFY_TOKEN in Vercel env)
 *   4. Subscribe to the "leadgen" field
 *
 * Meta docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "robotek_meta_2024";

// ── GET — webhook verification ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST — incoming lead data ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: MetaWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Meta sends an array of entries; each entry has an array of changes.
  const leads: ParsedLead[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const val = change.value;

      // Extract field_data key→value pairs from the form submission
      const fields: Record<string, string> = {};
      for (const fd of val.field_data ?? []) {
        fields[fd.name.toLowerCase()] = fd.values?.[0] ?? "";
      }

      leads.push({
        name: fields["full_name"] || fields["name"] || "Meta Lead",
        phone: fields["phone_number"] || fields["phone"] || null,
        email: fields["email"] || null,
        city: fields["city"] || null,
        state: fields["state"] || null,
        company: fields["company_name"] || fields["company"] || null,
        ad_id: String(val.ad_id ?? ""),
        ad_name: String(val.ad_name ?? ""),
        ad_set: String(val.adset_name ?? ""),
        form_id: String(val.form_id ?? ""),
        notes: `Meta Lead Form submission. Form: ${val.form_id ?? "—"} · Ad: ${val.ad_name ?? "—"}`,
      });
    }
  }

  if (leads.length === 0) {
    return NextResponse.json({ received: true });
  }

  // Use service role to bypass RLS (same pattern as public intake form)
  const supabase = (await createClient()) as any;

  const inserts = leads.map((l) => ({
    name: l.name,
    lead_type: "channel_partner",
    source: "Meta Lead Form",
    phone: l.phone,
    email: l.email,
    city: l.city,
    state: l.state,
    company: l.company,
    ad_id: l.ad_id,
    ad_name: l.ad_name,
    ad_set: l.ad_set,
    notes: l.notes,
    status: "new",
  }));

  await supabase.from("crm_leads").insert(inserts);

  return NextResponse.json({ received: true, count: leads.length });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MetaWebhookPayload = {
  entry?: {
    changes?: {
      field: string;
      value: {
        ad_id?: number | string;
        ad_name?: string;
        adset_name?: string;
        form_id?: number | string;
        field_data?: { name: string; values?: string[] }[];
      };
    }[];
  }[];
};

type ParsedLead = {
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  company: string | null;
  ad_id: string;
  ad_name: string;
  ad_set: string;
  form_id: string;
  notes: string;
};
