"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmDealStage, CrmLeadStatus, CrmActivityType, CrmLeadType } from "@/types/database";
import { DRIP_SEQUENCES, renderDrip } from "@/lib/crm/drip";

type Result = { error: string | null };

/**
 * Schedule a lead's drip sequence as dated WhatsApp messages and mark the
 * lead's drip active. Bodies are rendered now so the cron just sends them.
 * Assumes the caller already checked the lead isn't mid-drip.
 */
async function enrollDrip(
  supabase: any,
  lead: { id: string; name: string; company: string | null; lead_type: CrmLeadType | null },
  uid: string | null
): Promise<void> {
  const type: CrmLeadType = lead.lead_type ?? "channel_partner";
  const seq = DRIP_SEQUENCES[type] ?? [];
  if (seq.length === 0) return;

  const base = new Date();
  const rows = seq.map((s) => {
    const d = new Date(base);
    d.setDate(d.getDate() + s.day);
    return {
      lead_id: lead.id,
      sequence: type,
      step_no: s.step,
      channel: "whatsapp",
      scheduled_for: d.toISOString().slice(0, 10), // YYYY-MM-DD
      body: renderDrip(s.body, { name: lead.name, company: lead.company }),
      status: "pending",
      created_by: uid,
    };
  });

  await supabase.from("crm_drip_messages").insert(rows);
  await supabase
    .from("crm_leads")
    .update({ drip_status: "active", drip_started_at: new Date().toISOString() })
    .eq("id", lead.id);
}

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

/**
 * Pick the NBD team member with the fewest open (non-converted) leads, so new
 * unassigned leads are spread evenly. Returns null if no NBD members exist.
 */
async function pickNbdAssignee(supabase: any): Promise<string | null> {
  const { data: members } = await supabase
    .from("users")
    .select("id")
    .eq("crm_department", "nbd")
    .eq("is_active", true);
  const ids = (members ?? []).map((m: { id: string }) => m.id);
  if (ids.length === 0) return null;

  const { data: openLeads } = await supabase
    .from("crm_leads")
    .select("assigned_to")
    .neq("status", "converted")
    .neq("status", "unqualified");

  const load = new Map<string, number>();
  ids.forEach((id: string) => load.set(id, 0));
  (openLeads ?? []).forEach((l: { assigned_to: string | null }) => {
    if (l.assigned_to && load.has(l.assigned_to)) load.set(l.assigned_to, (load.get(l.assigned_to) ?? 0) + 1);
  });

  let best = ids[0];
  let min = Infinity;
  for (const id of ids) {
    const c = load.get(id) ?? 0;
    if (c < min) { min = c; best = id; }
  }
  return best;
}

/**
 * Returns a warning string if the phone already exists on a lead or account,
 * else null. Matches on the last 10 digits.
 */
async function findPhoneDuplicate(supabase: any, phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const last10 = phone.replace(/\D/g, "").slice(-10);
  if (last10.length < 10) return null;

  const { data: dupLead } = await supabase.from("crm_leads").select("name").ilike("phone", `%${last10}%`).limit(1);
  if (dupLead && dupLead.length) return `A lead with this phone already exists (${dupLead[0].name}). Please check before adding a duplicate.`;

  const { data: dupAcc } = await supabase.from("crm_accounts").select("name").ilike("phone", `%${last10}%`).limit(1);
  if (dupAcc && dupAcc.length) return `This phone already belongs to an account (${dupAcc[0].name}).`;

  return null;
}

// ── LEADS ───────────────────────────────────────────────────

export async function createLead(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const name = str(formData, "name");
  if (!name) return { error: "Lead name is required" };

  const supabase = (await createClient()) as any;

  // Duplicate detection by phone (across leads + accounts).
  const dup = await findPhoneDuplicate(supabase, str(formData, "phone"));
  if (dup) return { error: dup };

  // Round-robin / least-loaded auto-assignment when no owner is chosen.
  let assignedTo = str(formData, "assigned_to");
  if (!assignedTo) assignedTo = await pickNbdAssignee(supabase);

  const { error } = await supabase.from("crm_leads").insert({
    name,
    lead_type: (str(formData, "lead_type") as never) ?? "channel_partner",
    company: str(formData, "company"),
    source: str(formData, "source"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    est_value: num(formData, "est_value"),
    assigned_to: assignedTo,
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

  // Auto-enroll into the drip sequence when a lead is qualified (once).
  if (status === "qualified") {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, name, company, lead_type, drip_status")
      .eq("id", id)
      .single();
    if (lead && lead.drip_status === "none") {
      const uid = await currentUserId();
      await enrollDrip(supabase, lead, uid);
    }
  }

  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

/** Manually start a lead's drip sequence (if not already active). */
export async function startDrip(leadId: string): Promise<Result> {
  const uid = await currentUserId();
  const supabase = (await createClient()) as any;
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, name, company, lead_type, drip_status")
    .eq("id", leadId)
    .single();
  if (!lead) return { error: "Lead not found" };
  if (lead.drip_status === "active") return { error: "Drip is already running for this lead" };

  await enrollDrip(supabase, lead, uid);
  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os");
  return { error: null };
}

/**
 * Distribute all unassigned (open) leads among the active NBD Sales
 * Coordinators. If a lead's imported assigned_name matches an SC's name, it
 * goes to them; the rest are spread round-robin.
 */
export async function distributeLeads(): Promise<{ error: string | null; assigned: number }> {
  const supabase = (await createClient()) as any;
  const { data: scs } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("crm_department", "nbd")
    .eq("crm_team_role", "sales_coordinator")
    .eq("is_active", true)
    .order("full_name");
  const list = (scs ?? []) as { id: string; full_name: string }[];
  if (list.length === 0) return { error: "No NBD Sales Coordinators found. Create Sandhya & Alka in Admin first.", assigned: 0 };

  const byName = new Map(list.map((u) => [u.full_name.trim().toLowerCase(), u.id]));

  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, assigned_name")
    .is("assigned_to", null)
    .neq("status", "converted")
    .neq("status", "unqualified");
  const rows = (leads ?? []) as { id: string; assigned_name: string | null }[];
  if (rows.length === 0) return { error: null, assigned: 0 };

  const assignMap = new Map<string, string[]>();
  let rr = 0;
  for (const l of rows) {
    let target = l.assigned_name ? byName.get(l.assigned_name.trim().toLowerCase()) ?? null : null;
    if (!target) { target = list[rr % list.length].id; rr++; }
    if (!assignMap.has(target)) assignMap.set(target, []);
    assignMap.get(target)!.push(l.id);
  }

  let assigned = 0;
  for (const [uid, ids] of assignMap) {
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      const { error } = await supabase.from("crm_leads").update({ assigned_to: uid }).in("id", chunk);
      if (!error) assigned += chunk.length;
    }
  }

  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os");
  return { error: null, assigned };
}

/** Set a lead's tags (deduped, trimmed, capped). */
export async function setLeadTags(id: string, tags: string[]): Promise<Result> {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 12);
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_leads").update({ tags: clean }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/leads");
  return { error: null };
}

/** Stop a lead's drip: cancel all still-pending messages. */
export async function stopDrip(leadId: string): Promise<Result> {
  const supabase = (await createClient()) as any;
  await supabase
    .from("crm_drip_messages")
    .update({ status: "cancelled" })
    .eq("lead_id", leadId)
    .eq("status", "pending");
  await supabase.from("crm_leads").update({ drip_status: "stopped" }).eq("id", leadId);
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

  // Duplicate detection by phone.
  const phone = str(formData, "phone");
  if (phone) {
    const last10 = phone.replace(/\D/g, "").slice(-10);
    if (last10.length >= 10) {
      const { data: dupAcc } = await supabase.from("crm_accounts").select("name").ilike("phone", `%${last10}%`).limit(1);
      if (dupAcc && dupAcc.length) return { error: `An account with this phone already exists (${dupAcc[0].name}).` };
    }
  }

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

/**
 * Quick-schedule a follow-up linked to a deal / lead / account, from inline
 * shortcuts on the pipeline cards and lead rows. Owner = current user.
 */
export async function scheduleFollowup(input: {
  subject: string;
  dueAt: string;
  type?: CrmActivityType;
  dealId?: string | null;
  leadId?: string | null;
  accountId?: string | null;
}): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };
  if (!input.subject?.trim()) return { error: "Subject is required" };
  if (!input.dueAt) return { error: "Pick a date" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_activities").insert({
    type: input.type ?? "call",
    subject: input.subject.trim(),
    due_at: input.dueAt,
    owner_id: uid,
    deal_id: input.dealId ?? null,
    lead_id: input.leadId ?? null,
    account_id: input.accountId ?? null,
    created_by: uid,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/sales-os/pipeline");
  revalidatePath("/dashboard/sales-os/leads");
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
