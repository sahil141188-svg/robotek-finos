/**
 * CRM server-side data access. Import only in Server Components / actions.
 *
 * Joins are resolved in JS (not PostgREST embeds) because several CRM tables
 * have multiple foreign keys to public.users, which makes implicit embeds
 * ambiguous.
 *
 * NOTE: this codebase's generated Database type does not infer narrow
 * `.select(cols)` / `.insert()` shapes (see lib/supabase/expenses-queries.ts,
 * app/actions/companies.ts), so we follow the established convention of
 * casting the client to `any` and casting results back to typed Rows.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Account  = Database["public"]["Tables"]["crm_accounts"]["Row"];
type Contact  = Database["public"]["Tables"]["crm_contacts"]["Row"];
type Lead     = Database["public"]["Tables"]["crm_leads"]["Row"];
type Deal     = Database["public"]["Tables"]["crm_deals"]["Row"];
type Activity = Database["public"]["Tables"]["crm_activities"]["Row"];

export type DealWithNames = Deal & { account_name: string | null; owner_name: string | null };
export type LeadWithNames = Lead & { assigned_name: string | null };
export type AccountWithNames = Account & { owner_name: string | null; open_deals: number };
export type ActivityWithNames = Activity & {
  owner_name: string | null;
  account_name: string | null;
};

/** Typed client cast to `any` for query building (repo convention). */
async function db(): Promise<any> {
  return (await createClient()) as any;
}

/** Map of user id -> full name, for resolving owner/assignee labels. */
async function userNameMap(sb: any): Promise<Map<string, string>> {
  const { data } = await sb.from("users").select("id, full_name");
  const rows = (data ?? []) as { id: string; full_name: string }[];
  const map = new Map<string, string>();
  rows.forEach((u) => map.set(u.id, u.full_name));
  return map;
}

async function accountNameMap(sb: any): Promise<Map<string, string>> {
  const { data } = await sb.from("crm_accounts").select("id, name");
  const rows = (data ?? []) as { id: string; name: string }[];
  const map = new Map<string, string>();
  rows.forEach((a) => map.set(a.id, a.name));
  return map;
}

/** Lightweight list of sales-team members for assignment dropdowns. */
export async function getSalesTeam() {
  const sb = await db();
  const { data } = await sb
    .from("users")
    .select("id, full_name, crm_team_role, crm_department")
    .order("full_name");
  return (data ?? []) as {
    id: string;
    full_name: string;
    crm_team_role: string | null;
    crm_department: string | null;
  }[];
}

// ── OVERVIEW KPIs ───────────────────────────────────────────

export type CrmOverview = {
  totalAccounts: number;
  crrAccounts: number;
  nbdAccounts: number;
  openLeads: number;
  openDealsCount: number;
  openPipelineValue: number;
  wonThisMonthValue: number;
  wonThisMonthCount: number;
  stageCounts: Record<string, number>;
};

export async function getCrmOverview(): Promise<CrmOverview> {
  const sb = await db();

  const [{ data: accounts }, { data: leads }, { data: deals }] = await Promise.all([
    sb.from("crm_accounts").select("department"),
    sb.from("crm_leads").select("status"),
    sb.from("crm_deals").select("stage, value, won_at"),
  ]);

  const accs = (accounts ?? []) as Pick<Account, "department">[];
  const lds = (leads ?? []) as Pick<Lead, "status">[];
  const dls = (deals ?? []) as Pick<Deal, "stage" | "value" | "won_at">[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const openStages = new Set(["new", "qualified", "quoted", "negotiation"]);
  const stageCounts: Record<string, number> = {};
  let openPipelineValue = 0;
  let openDealsCount = 0;
  let wonThisMonthValue = 0;
  let wonThisMonthCount = 0;

  for (const d of dls) {
    stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;
    if (openStages.has(d.stage)) {
      openDealsCount += 1;
      openPipelineValue += Number(d.value) || 0;
    }
    if (d.stage === "won" && d.won_at && new Date(d.won_at) >= monthStart) {
      wonThisMonthCount += 1;
      wonThisMonthValue += Number(d.value) || 0;
    }
  }

  return {
    totalAccounts: accs.length,
    crrAccounts: accs.filter((a) => a.department === "crr").length,
    nbdAccounts: accs.filter((a) => a.department === "nbd").length,
    openLeads: lds.filter((l) => l.status !== "converted" && l.status !== "unqualified").length,
    openDealsCount,
    openPipelineValue,
    wonThisMonthValue,
    wonThisMonthCount,
    stageCounts,
  };
}

// ── DEALS (pipeline) ────────────────────────────────────────

export async function getDeals(): Promise<DealWithNames[]> {
  const sb = await db();
  const [{ data }, names, accMap] = await Promise.all([
    sb.from("crm_deals").select("*").order("updated_at", { ascending: false }),
    userNameMap(sb),
    accountNameMap(sb),
  ]);
  const rows = (data ?? []) as Deal[];
  return rows.map((d) => ({
    ...d,
    owner_name: d.owner_id ? names.get(d.owner_id) ?? null : null,
    account_name: d.account_id ? accMap.get(d.account_id) ?? null : null,
  }));
}

// ── LEADS ───────────────────────────────────────────────────

export async function getLeads(): Promise<LeadWithNames[]> {
  const sb = await db();
  const [{ data }, names] = await Promise.all([
    sb.from("crm_leads").select("*").order("created_at", { ascending: false }),
    userNameMap(sb),
  ]);
  const rows = (data ?? []) as Lead[];
  return rows.map((l) => ({
    ...l,
    assigned_name: l.assigned_to ? names.get(l.assigned_to) ?? null : null,
  }));
}

// ── ACCOUNTS ────────────────────────────────────────────────

export async function getAccounts(): Promise<AccountWithNames[]> {
  const sb = await db();
  const [{ data }, names, { data: deals }] = await Promise.all([
    sb.from("crm_accounts").select("*").order("name"),
    userNameMap(sb),
    sb.from("crm_deals").select("account_id, stage"),
  ]);
  const rows = (data ?? []) as Account[];
  const dealRows = (deals ?? []) as Pick<Deal, "account_id" | "stage">[];

  const openByAccount = new Map<string, number>();
  const openStages = new Set(["new", "qualified", "quoted", "negotiation"]);
  dealRows.forEach((d) => {
    if (d.account_id && openStages.has(d.stage)) {
      openByAccount.set(d.account_id, (openByAccount.get(d.account_id) ?? 0) + 1);
    }
  });

  return rows.map((a) => ({
    ...a,
    owner_name: a.owner_id ? names.get(a.owner_id) ?? null : null,
    open_deals: openByAccount.get(a.id) ?? 0,
  }));
}

export type AccountDetail = {
  account: AccountWithNames;
  contacts: Contact[];
  deals: DealWithNames[];
  activities: ActivityWithNames[];
};

export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  const sb = await db();
  const { data: accountRow } = await sb.from("crm_accounts").select("*").eq("id", id).single();
  const account = accountRow as Account | null;
  if (!account) return null;

  const [names, { data: contacts }, { data: deals }, { data: activities }] = await Promise.all([
    userNameMap(sb),
    sb.from("crm_contacts").select("*").eq("account_id", id).order("is_primary", { ascending: false }),
    sb.from("crm_deals").select("*").eq("account_id", id).order("updated_at", { ascending: false }),
    sb.from("crm_activities").select("*").eq("account_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    account: {
      ...account,
      owner_name: account.owner_id ? names.get(account.owner_id) ?? null : null,
      open_deals: 0,
    },
    contacts: (contacts ?? []) as Contact[],
    deals: ((deals ?? []) as Deal[]).map((d) => ({
      ...d,
      owner_name: d.owner_id ? names.get(d.owner_id) ?? null : null,
      account_name: account.name,
    })),
    activities: ((activities ?? []) as Activity[]).map((a) => ({
      ...a,
      owner_name: a.owner_id ? names.get(a.owner_id) ?? null : null,
      account_name: account.name,
    })),
  };
}

// ── ACTIVITIES ──────────────────────────────────────────────

export async function getActivities(): Promise<ActivityWithNames[]> {
  const sb = await db();
  const [{ data }, names, accMap] = await Promise.all([
    sb
      .from("crm_activities")
      .select("*")
      .order("done", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false }),
    userNameMap(sb),
    accountNameMap(sb),
  ]);
  const rows = (data ?? []) as Activity[];
  return rows.map((a) => ({
    ...a,
    owner_name: a.owner_id ? names.get(a.owner_id) ?? null : null,
    account_name: a.account_id ? accMap.get(a.account_id) ?? null : null,
  }));
}
