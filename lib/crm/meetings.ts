/**
 * Sales OS — meetings data access (server-only).
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Meeting = Database["public"]["Tables"]["crm_meetings"]["Row"];

export type MeetingWithContext = Meeting & {
  lead_name: string | null;
  lead_company: string | null;
  lead_phone: string | null;
  lead_enquiry_type: string | null;
  lead_product: string | null;
  lead_notes: string | null;
  assignee_name: string | null;
  arranged_by_name: string | null;
};

async function db(): Promise<any> {
  return (await createClient()) as any;
}

/** Sales Experts + FSRs — the people a meeting can be assigned to / a lead forwarded to. */
export async function getMeetingTargets() {
  const sb = await db();
  const { data } = await sb
    .from("users")
    .select("id, full_name, crm_team_role, whatsapp_number")
    .in("crm_team_role", ["sales_expert", "fsr"])
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []) as { id: string; full_name: string; crm_team_role: string; whatsapp_number: string | null }[];
}

/** Super Stockist accounts — existing customers a lead can be transferred to. */
export async function getSuperStockists() {
  const sb = await db();
  const { data } = await sb
    .from("crm_accounts")
    .select("id, name, phone, city, state")
    .eq("type", "super_stockist")
    .order("name");
  return (data ?? []) as { id: string; name: string; phone: string | null; city: string | null; state: string | null }[];
}

export async function getMeetings(): Promise<MeetingWithContext[]> {
  const sb = await db();
  const [{ data: meetings }, { data: leads }, { data: users }] = await Promise.all([
    sb.from("crm_meetings").select("*").order("scheduled_at", { ascending: true }),
    sb.from("crm_leads").select("id, name, company, phone, enquiry_type, product_interest, notes"),
    sb.from("users").select("id, full_name"),
  ]);

  const leadMap = new Map<string, any>();
  (leads ?? []).forEach((l: any) => leadMap.set(l.id, l));
  const userMap = new Map<string, string>();
  (users ?? []).forEach((u: { id: string; full_name: string }) => userMap.set(u.id, u.full_name));

  return ((meetings ?? []) as Meeting[]).map((m) => {
    const l = m.lead_id ? leadMap.get(m.lead_id) : null;
    return {
      ...m,
      lead_name: l?.name ?? null,
      lead_company: l?.company ?? null,
      lead_phone: l?.phone ?? null,
      lead_enquiry_type: l?.enquiry_type ?? null,
      lead_product: l?.product_interest ?? null,
      lead_notes: l?.notes ?? null,
      assignee_name: m.assigned_to ? userMap.get(m.assigned_to) ?? null : null,
      arranged_by_name: m.arranged_by ? userMap.get(m.arranged_by) ?? null : null,
    };
  });
}
