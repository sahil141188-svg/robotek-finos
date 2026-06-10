/**
 * Single-record detail queries (Odoo-style Form view) + chatter messages.
 * Server-only. Same any-cast convention as lib/crm/queries.ts.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Deal = Database["public"]["Tables"]["crm_deals"]["Row"];
type Lead = Database["public"]["Tables"]["crm_leads"]["Row"];
type Activity = Database["public"]["Tables"]["crm_activities"]["Row"];
type LostReason = Database["public"]["Tables"]["crm_lost_reasons"]["Row"];

async function db(): Promise<any> {
  return (await createClient()) as any;
}

export type ChatMessage = {
  id: string;
  kind: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

async function userMap(sb: any): Promise<Map<string, string>> {
  const { data } = await sb.from("users").select("id, full_name");
  const m = new Map<string, string>();
  ((data ?? []) as { id: string; full_name: string }[]).forEach((u) => m.set(u.id, u.full_name));
  return m;
}

export async function getMessages(parentType: string, parentId: string): Promise<ChatMessage[]> {
  const sb = await db();
  const [{ data }, names] = await Promise.all([
    sb.from("crm_messages").select("*").eq("parent_type", parentType).eq("parent_id", parentId).order("created_at", { ascending: false }),
    userMap(sb),
  ]);
  return ((data ?? []) as { id: string; kind: string; body: string; author_id: string | null; created_at: string }[]).map((m) => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    author_name: m.author_id ? names.get(m.author_id) ?? null : null,
    created_at: m.created_at,
  }));
}

export async function getLostReasons(): Promise<LostReason[]> {
  const sb = await db();
  const { data } = await sb.from("crm_lost_reasons").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []) as LostReason[];
}

export type DealDetail = {
  deal: Deal & { account_name: string | null; owner_name: string | null; lost_reason_name: string | null };
  activities: Activity[];
  messages: ChatMessage[];
};

export async function getDealDetail(id: string): Promise<DealDetail | null> {
  const sb = await db();
  const { data: deal } = await sb.from("crm_deals").select("*").eq("id", id).single();
  if (!deal) return null;

  const [names, { data: acc }, { data: acts }, messages, { data: lr }] = await Promise.all([
    userMap(sb),
    deal.account_id ? sb.from("crm_accounts").select("name").eq("id", deal.account_id).single() : Promise.resolve({ data: null }),
    sb.from("crm_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
    getMessages("deal", id),
    deal.lost_reason_id ? sb.from("crm_lost_reasons").select("name").eq("id", deal.lost_reason_id).single() : Promise.resolve({ data: null }),
  ]);

  return {
    deal: {
      ...(deal as Deal),
      account_name: (acc as { name?: string } | null)?.name ?? null,
      owner_name: deal.owner_id ? names.get(deal.owner_id) ?? null : null,
      lost_reason_name: (lr as { name?: string } | null)?.name ?? null,
    },
    activities: (acts ?? []) as Activity[],
    messages,
  };
}

export type LeadDetail = {
  lead: Lead & { assigned_name: string | null };
  activities: Activity[];
  messages: ChatMessage[];
};

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const sb = await db();
  const { data: lead } = await sb.from("crm_leads").select("*").eq("id", id).single();
  if (!lead) return null;

  const [names, { data: acts }, messages] = await Promise.all([
    userMap(sb),
    sb.from("crm_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    getMessages("lead", id),
  ]);

  return {
    lead: { ...(lead as Lead), assigned_name: lead.assigned_to ? names.get(lead.assigned_to) ?? null : null },
    activities: (acts ?? []) as Activity[],
    messages,
  };
}
