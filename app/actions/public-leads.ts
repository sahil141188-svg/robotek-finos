"use server";

/**
 * Public web-to-lead intake. Inserts a lead from the public /intake form
 * using the service-role client (bypasses RLS — anonymous submitters have no
 * session). Auto-assigns to the least-loaded NBD member.
 */
import { createClient } from "@supabase/supabase-js";
import type { CrmLeadType } from "@/types/database";

type Result = { ok: boolean; error?: string };

function serviceDb(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function pickNbdAssignee(db: any): Promise<string | null> {
  const { data: members } = await db.from("users").select("id").eq("crm_department", "nbd").eq("is_active", true);
  const ids = (members ?? []).map((m: { id: string }) => m.id);
  if (ids.length === 0) return null;
  const { data: open } = await db.from("crm_leads").select("assigned_to").neq("status", "converted").neq("status", "unqualified");
  const load = new Map<string, number>();
  ids.forEach((id: string) => load.set(id, 0));
  (open ?? []).forEach((l: { assigned_to: string | null }) => {
    if (l.assigned_to && load.has(l.assigned_to)) load.set(l.assigned_to, (load.get(l.assigned_to) ?? 0) + 1);
  });
  let best = ids[0], min = Infinity;
  for (const id of ids) { const c = load.get(id) ?? 0; if (c < min) { min = c; best = id; } }
  return best;
}

export async function submitPublicLead(input: {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  lead_type?: CrmLeadType;
  notes?: string;
  source?: string;
  honeypot?: string; // bots fill this; humans never see it
}): Promise<Result> {
  // Silently accept bot submissions without storing.
  if (input.honeypot && input.honeypot.trim().length > 0) return { ok: true };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, error: "Please add a phone number or email so we can reach you." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Intake is not configured yet. Please contact us directly." };
  }

  const db = serviceDb();
  const assignedTo = await pickNbdAssignee(db);

  const { error } = await db.from("crm_leads").insert({
    name,
    company: input.company?.trim() || null,
    lead_type: input.lead_type ?? "channel_partner",
    source: input.source?.trim() || "Website",
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "new",
    assigned_to: assignedTo,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
