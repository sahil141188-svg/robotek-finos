/**
 * WhatsApp Cloud API webhook receiver.
 *
 * GET  — Meta verification handshake (called once when you register the webhook)
 * POST — receives all incoming WhatsApp messages on +91 96259 97436
 *
 * What it does on each incoming message:
 *   1. Checks if this phone number is already a lead in CRM
 *   2. If NEW number → creates a lead (source = "Meta WhatsApp", status = "new")
 *   3. Logs the message as a note activity on the lead
 *
 * Meta setup (do once):
 *   developers.facebook.com → Your App → WhatsApp → Configuration → Webhook
 *   Callback URL:  https://YOUR_DOMAIN/api/webhooks/whatsapp
 *   Verify token:  robotek_wa_2024   (also set WHATSAPP_VERIFY_TOKEN in Vercel env)
 *   Subscribe to:  messages
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "robotek_wa_2024";

// ── GET — Meta webhook verification ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new NextResponse(searchParams.get("hub.challenge"), { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST — incoming WhatsApp message ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: WAPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = (await createClient()) as any;
  let created = 0;
  let logged = 0;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const val = change.value;

      // Map contact profiles: wa_id (phone) → display name
      const contactMap: Record<string, string> = {};
      for (const c of val.contacts ?? []) {
        contactMap[c.wa_id] = c.profile?.name ?? c.wa_id;
      }

      for (const msg of val.messages ?? []) {
        const waId   = msg.from;                        // e.g. "919625997436"
        const phone  = `+${waId}`;
        const name   = contactMap[waId] ?? phone;
        const text   = msgText(msg);

        // 1. Check if lead already exists (match on last 10 digits)
        const last10 = waId.slice(-10);
        const { data: existing } = await supabase
          .from("crm_leads")
          .select("id, name")
          .ilike("phone", `%${last10}`)
          .maybeSingle();

        let leadId: string;

        if (!existing) {
          // 2. Create new lead
          const { data: newLead, error: insertErr } = await supabase
            .from("crm_leads")
            .insert({
              name,
              phone,
              source: "Meta WhatsApp",
              lead_type: "channel_partner",
              status: "new",
              priority: "COLD",
              notes: `First message: ${text}`,
              ad_name: "WhatsApp Inbound",
            })
            .select("id")
            .single();

          if (insertErr || !newLead) continue;
          leadId = newLead.id;
          created++;
        } else {
          leadId = existing.id;
        }

        // 3. Log message as a note activity on the lead
        if (text) {
          await supabase.from("crm_activities").insert({
            lead_id: leadId,
            type: "whatsapp",
            subject: text.length > 120 ? text.slice(0, 117) + "…" : text,
            done: true,
          });
          logged++;
        }
      }
    }
  }

  return NextResponse.json({ received: true, leads_created: created, messages_logged: logged });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function msgText(msg: WAMessage): string {
  if (msg.type === "text")     return msg.text?.body ?? "";
  if (msg.type === "image")    return "[Image received]";
  if (msg.type === "audio")    return "[Voice message received]";
  if (msg.type === "video")    return "[Video received]";
  if (msg.type === "document") return `[Document: ${msg.document?.filename ?? "file"}]`;
  if (msg.type === "location") return `[Location shared: ${msg.location?.name ?? ""}]`;
  return `[${msg.type} message]`;
}

// ── WhatsApp Cloud API payload types ─────────────────────────────────────────

type WAPayload = {
  entry?: {
    changes?: {
      field: string;
      value: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WAMessage[];
      };
    }[];
  }[];
};

type WAMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string };
  audio?: { id: string };
  video?: { id: string };
  document?: { id: string; filename?: string };
  location?: { latitude: number; longitude: number; name?: string };
};
