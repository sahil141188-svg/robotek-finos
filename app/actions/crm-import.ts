"use server";

/**
 * NBD lead importer — takes rows already mapped to NBD field keys (the client
 * does the column mapping) and inserts them into crm_leads.
 *
 * Dedupe: skips a row if its enquiry_no already exists, or (no enquiry_no) if
 * its phone (last 10 digits) already matches an existing lead.
 * Unassigned rows are auto-assigned to the least-loaded NBD member.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmLeadStatus, CrmLeadType } from "@/types/database";

/** A row from the client, keyed by NBD field name. */
export type ImportRow = Record<string, string>;

export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: number;
  messages: string[];
};

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function clean(v: string | undefined | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function last10(phone: string | null): string {
  return phone ? phone.replace(/\D/g, "").slice(-10) : "";
}

/** Map their free-text enquiry/customer type to our lead_type. */
function toLeadType(enquiryType: string | null): CrmLeadType {
  const t = (enquiryType ?? "").toLowerCase();
  if (t.includes("corp") || t.includes("oem") || t.includes("brand")) return "corporate";
  return "channel_partner";
}

/** Map their free-text "Stages/Status" to our lead status enum. */
function toStatus(ext: string | null): CrmLeadStatus {
  const t = (ext ?? "").toLowerCase();
  if (!t) return "new";
  if (t.includes("qualif")) return "qualified";
  if (t.includes("convert") || t.includes("bill") || t.includes("won") || t.includes("sales funnel")) return "converted";
  if (t.includes("lost") || t.includes("close") || t.includes("not interest") || t.includes("dead")) return "unqualified";
  return "contacted";
}

/** Parse a numeric amount from text like "₹41,400" / "50K" / "1.5 LAC". */
function toAmount(v: string | null): number | null {
  if (!v) return null;
  const s = v.toLowerCase().replace(/[, ₹]/g, "");
  const m = s.match(/([\d.]+)\s*(k|lac|lakh|cr|crore)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  if (m[2] === "k") n *= 1_000;
  else if (m[2] === "lac" || m[2] === "lakh") n *= 100_000;
  else if (m[2] === "cr" || m[2] === "crore") n *= 10_000_000;
  return Math.round(n);
}

/** Parse dd/mm/yyyy (their format) or ISO into YYYY-MM-DD. */
function toDate(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().split(/[ T]/)[0];
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let [, d, mo, y] = dmy;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

async function pickNbdAssignee(supabase: any): Promise<string | null> {
  const { data: members } = await supabase.from("users").select("id").eq("crm_department", "nbd").eq("is_active", true);
  const ids = (members ?? []).map((m: { id: string }) => m.id);
  if (ids.length === 0) return null;
  const { data: open } = await supabase.from("crm_leads").select("assigned_to").neq("status", "converted").neq("status", "unqualified");
  const load = new Map<string, number>();
  ids.forEach((id: string) => load.set(id, 0));
  (open ?? []).forEach((l: { assigned_to: string | null }) => { if (l.assigned_to && load.has(l.assigned_to)) load.set(l.assigned_to, (load.get(l.assigned_to) ?? 0) + 1); });
  let best = ids[0], min = Infinity;
  for (const id of ids) { const c = load.get(id) ?? 0; if (c < min) { min = c; best = id; } }
  return best;
}

export async function importLeads(rows: ImportRow[]): Promise<ImportResult> {
  const uid = await currentUserId();
  if (!uid) return { inserted: 0, skipped: 0, errors: 0, messages: ["Not authenticated"] };
  if (!rows?.length) return { inserted: 0, skipped: 0, errors: 0, messages: ["No rows to import"] };

  const supabase = (await createClient()) as any;

  // Preload existing keys for dedupe.
  const { data: existing } = await supabase.from("crm_leads").select("enquiry_no, phone");
  const seenEnq = new Set<string>();
  const seenPhone = new Set<string>();
  (existing ?? []).forEach((e: { enquiry_no: string | null; phone: string | null }) => {
    if (e.enquiry_no) seenEnq.add(e.enquiry_no.trim().toLowerCase());
    const p = last10(e.phone); if (p.length === 10) seenPhone.add(p);
  });

  // Try to match sheet sales-person names → real users.
  const { data: users } = await supabase.from("users").select("id, full_name");
  const userByName = new Map<string, string>();
  (users ?? []).forEach((u: { id: string; full_name: string }) => userByName.set(u.full_name.trim().toLowerCase(), u.id));

  const fallbackAssignee = await pickNbdAssignee(supabase);

  const result: ImportResult = { inserted: 0, skipped: 0, errors: 0, messages: [] };
  const toInsert: Record<string, unknown>[] = [];

  for (const r of rows) {
    const name = clean(r.name);
    const enquiryNo = clean(r.enquiry_no);
    const phone = clean(r.phone);
    if (!name && !enquiryNo) { result.skipped++; continue; }

    // Dedupe
    const enqKey = enquiryNo?.toLowerCase();
    const phoneKey = last10(phone);
    if (enqKey && seenEnq.has(enqKey)) { result.skipped++; continue; }
    if (!enqKey && phoneKey.length === 10 && seenPhone.has(phoneKey)) { result.skipped++; continue; }
    if (enqKey) seenEnq.add(enqKey);
    if (phoneKey.length === 10) seenPhone.add(phoneKey);

    const assignedName = clean(r.assigned_name);
    const matchedUser = assignedName ? userByName.get(assignedName.toLowerCase()) ?? null : null;

    toInsert.push({
      name: name ?? enquiryNo,
      company: clean(r.company),
      phone,
      email: clean(r.email),
      city: clean(r.city),
      state: clean(r.state),
      source: clean(r.source),
      enquiry_no: enquiryNo,
      enquiry_type: clean(r.enquiry_type),
      lead_type: toLeadType(clean(r.enquiry_type)),
      status: toStatus(clean(r.external_status)),
      external_status: clean(r.external_status),
      filled_by: clean(r.filled_by),
      sc_name: clean(r.sc_name),
      assigned_name: assignedName,
      assigned_to: matchedUser ?? fallbackAssignee,
      product_interest: clean(r.product_interest),
      existing_brand: clean(r.existing_brand),
      monthly_turnover: clean(r.monthly_turnover),
      investment_amount: clean(r.investment_amount),
      est_value: toAmount(clean(r.investment_amount)) ?? 0,
      priority: clean(r.priority),
      lead_time_days: clean(r.lead_time_days) ? parseInt(r.lead_time_days, 10) || null : null,
      first_billing_date: toDate(clean(r.first_billing_date)),
      first_billing_amount: toAmount(clean(r.first_billing_amount)),
      dream_customer: /^(yes|y|true|1)$/i.test(clean(r.dream_customer) ?? ""),
      whatsapp_link: clean(r.whatsapp_link),
      visit_date: toDate(clean(r.visit_date)),
      notes: clean(r.notes),
      created_by: uid,
    });
  }

  // Insert in batches of 200.
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await supabase.from("crm_leads").insert(batch);
    if (error) {
      result.errors += batch.length;
      result.messages.push(error.message);
    } else {
      result.inserted += batch.length;
    }
  }

  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os");
  if (result.messages.length === 0) result.messages.push(`Imported ${result.inserted}, skipped ${result.skipped} duplicates.`);
  return result;
}
