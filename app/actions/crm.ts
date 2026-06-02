"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmDealStage, CrmLeadStatus } from "@/types/database";

type Result = { error: string | null };

/** Returns the current auth user id, or null if not signed in. */
async function currentUserId(): Promise<string | null> {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(formData: FormData, key: string): number {
  const v = formData.get(key);
  const n = v === null ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── LEADS ───────────────────────────────────────────────────

export async function createLead(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const name = str(formData, "name");
  if (!name) return { error: "Lead name is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_leads").insert({
    name,
    company: str(formData, "company"),
    source: str(formData, "source"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    est_value: num(formData, "est_value"),
    assigned_to: str(formData, "assigned_to"),
    notes: str(formData, "notes"),
    created_by: uid,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

export async function updateLeadStatus(id: string, status: CrmLeadStatus): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/leads");
  return { error: null };
}

/**
 * Convert a qualified lead into a CRM account (NBD) + an opening deal,
 * then mark the lead as converted. This is the start of the NBD pipeline.
 */
export async function convertLead(id: string): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const supabase = (await createClient()) as any;
  const { data: lead, error: leadErr } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", id)
    .single();
  if (leadErr || !lead) return { error: leadErr?.message ?? "Lead not found" };
  if (lead.converted_account_id) return { error: "Lead is already converted" };

  // 1. Create the account in the NBD department.
  const { data: account, error: accErr } = await supabase
    .from("crm_accounts")
    .insert({
      name: lead.company ?? lead.name,
      department: "nbd",
      status: "prospect",
      owner_id: lead.assigned_to,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      state: lead.state,
      created_by: uid,
    })
    .select("id")
    .single();
  if (accErr || !account) return { error: accErr?.message ?? "Could not create account" };

  // 2. Open a deal so it shows up in the pipeline immediately.
  await supabase.from("crm_deals").insert({
    title: `${lead.company ?? lead.name} — opening deal`,
    account_id: account.id,
    department: "nbd",
    stage: "qualified",
    value: lead.est_value,
    probability: 30,
    owner_id: lead.assigned_to,
    source: lead.source,
    created_by: uid,
  });

  // 3. Mark the lead converted.
  await supabase
    .from("crm_leads")
    .update({
      status: "converted",
      converted_account_id: account.id,
      converted_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os/accounts");
  revalidatePath("/dashboard/sales-os/pipeline");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

// ── ACCOUNTS ────────────────────────────────────────────────

export async function createAccount(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const name = str(formData, "name");
  if (!name) return { error: "Account name is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_accounts").insert({
    name,
    type: (str(formData, "type") as never) ?? "dealer",
    department: (str(formData, "department") as never) ?? "nbd",
    status: (str(formData, "status") as never) ?? "prospect",
    owner_id: str(formData, "owner_id"),
    gstin: str(formData, "gstin"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    address: str(formData, "address"),
    notes: str(formData, "notes"),
    created_by: uid,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/accounts");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

export async function addContact(formData: FormData): Promise<Result> {
  const account_id = str(formData, "account_id");
  const name = str(formData, "name");
  if (!account_id) return { error: "Missing account" };
  if (!name) return { error: "Contact name is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_contacts").insert({
    account_id,
    name,
    designation: str(formData, "designation"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    is_primary: formData.get("is_primary") === "on",
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/sales-os/accounts/${account_id}`);
  return { error: null };
}

// ── DEALS (pipeline) ────────────────────────────────────────

export async function createDeal(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const title = str(formData, "title");
  if (!title) return { error: "Deal title is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_deals").insert({
    title,
    account_id: str(formData, "account_id"),
    department: (str(formData, "department") as never) ?? "nbd",
    stage: (str(formData, "stage") as never) ?? "new",
    value: num(formData, "value"),
    owner_id: str(formData, "owner_id"),
    expected_close: str(formData, "expected_close"),
    source: str(formData, "source"),
    notes: str(formData, "notes"),
    created_by: uid,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/pipeline");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

/**
 * Move a deal to a new stage. The DB trigger handles the NBD→CRR account
 * handoff and won_at/lost_at stamping when entering 'won'/'lost'.
 */
export async function moveDealStage(
  id: string,
  stage: CrmDealStage,
  lostReason?: string
): Promise<Result> {
  const supabase = (await createClient()) as any;
  const update: { stage: CrmDealStage; lost_reason?: string } = { stage };
  if (stage === "lost" && lostReason) update.lost_reason = lostReason;

  const { error } = await supabase.from("crm_deals").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/pipeline");
  revalidatePath("/dashboard/sales-os/accounts");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

// ── ACTIVITIES ──────────────────────────────────────────────

export async function logActivity(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const subject = str(formData, "subject");
  if (!subject) return { error: "Activity subject is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_activities").insert({
    type: (str(formData, "type") as never) ?? "call",
    subject,
    body: str(formData, "body"),
    due_at: str(formData, "due_at"),
    owner_id: str(formData, "owner_id") ?? uid,
    account_id: str(formData, "account_id"),
    deal_id: str(formData, "deal_id"),
    lead_id: str(formData, "lead_id"),
    created_by: uid,
  });

  if (error) return { error: error.message };
  const accountId = str(formData, "account_id");
  if (accountId) revalidatePath(`/dashboard/sales-os/accounts/${accountId}`);
  revalidatePath("/dashboard/sales-os/activities");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

export async function toggleActivityDone(id: string, done: boolean): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from("crm_activities")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/activities");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

/** Reschedule (snooze) a follow-up to a new due date. */
export async function rescheduleActivity(id: string, dueAt: string): Promise<Result> {
  if (!dueAt) return { error: "Pick a new date" };
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from("crm_activities")
    .update({ due_at: dueAt, done: false, done_at: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/activities");
  return { error: null };
}

/**
 * Complete a follow-up AND immediately schedule the next one against the same
 * lead/deal/account — keeps the NBD journey's follow-up chain unbroken.
 */
export async function completeAndScheduleNext(
  id: string,
  nextDueAt: string,
  nextSubject?: string
): Promise<Result> {
  if (!nextDueAt) return { error: "Pick a date for the next follow-up" };
  const uid = await currentUserId();
  const supabase = (await createClient()) as any;

  const { data: act } = await supabase.from("crm_activities").select("*").eq("id", id).single();
  if (!act) return { error: "Follow-up not found" };

  await supabase
    .from("crm_activities")
    .update({ done: true, done_at: new Date().toISOString() })
    .eq("id", id);

  const { error } = await supabase.from("crm_activities").insert({
    type: act.type,
    subject: nextSubject?.trim() || `Follow-up: ${act.subject}`,
    due_at: nextDueAt,
    owner_id: act.owner_id ?? uid,
    account_id: act.account_id,
    deal_id: act.deal_id,
    lead_id: act.lead_id,
    created_by: uid,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/sales-os/activities");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}
