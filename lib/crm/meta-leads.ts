/**
 * Meta Leads queries — filters crm_leads by Meta ad sources.
 */
import { createClient } from "@/lib/supabase/server";

const META_SOURCES = ["Meta WhatsApp", "Meta Lead Form"];

export type MetaLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  est_value: number | null;
  created_at: string;
  assigned_name: string | null;
  ad_name: string | null;
  ad_id: string | null;
};

export async function getMetaLeads(): Promise<MetaLead[]> {
  const sb = (await createClient()) as any;
  const { data } = await sb
    .from("crm_leads")
    .select("id, name, phone, email, company, city, state, source, status, notes, est_value, created_at, assigned_to, ad_name, ad_id")
    .in("source", META_SOURCES)
    .order("created_at", { ascending: false });

  if (!data) return [];

  // Resolve assignee names
  const ownerIds = [...new Set(data.map((r: { assigned_to: string | null }) => r.assigned_to).filter(Boolean))] as string[];
  let nameMap: Record<string, string> = {};
  if (ownerIds.length) {
    const { data: users } = await sb.from("users").select("id, full_name").in("id", ownerIds);
    if (users) users.forEach((u: { id: string; full_name: string }) => { nameMap[u.id] = u.full_name; });
  }

  return data.map((r: { assigned_to: string | null; [key: string]: unknown }) => ({
    ...r,
    assigned_name: r.assigned_to ? (nameMap[r.assigned_to] ?? null) : null,
  }));
}

export async function getSalesTeam(): Promise<{ id: string; full_name: string }[]> {
  const sb = (await createClient()) as any;
  const { data } = await sb
    .from("users")
    .select("id, full_name")
    .not("crm_team_role", "is", null)
    .order("full_name");
  return data ?? [];
}
