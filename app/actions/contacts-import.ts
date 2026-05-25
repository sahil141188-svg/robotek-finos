"use server";

/**
 * Bulk contacts import — match firm names against existing customers /
 * vendors and update their phone / email / contact_person fields.
 *
 *   listAllContacts()         — every customer + vendor for the current
 *                                company, returned together so the UI can
 *                                show them in a single sortable list.
 *   previewContactImport()    — given parsed rows, returns matched +
 *                                unmatched lists (no DB writes).
 *   commitContactImport()     — apply the previewed updates.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";

export type ContactKind = "customer" | "vendor";

export type ContactRow = {
  id: string;
  kind: ContactKind;
  name: string;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  gstin: string | null;
};

export type ImportRow = {
  name: string;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  gstin?: string | null;
};

export type ImportPreview = {
  matched: Array<{
    sourceRow: ImportRow;
    matchedTo: ContactRow;
    fieldChanges: Array<{ field: "phone" | "email" | "contact_person"; from: string | null; to: string | null }>;
  }>;
  unmatched: ImportRow[];
  noChange: ImportRow[];
};

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}
function normalisePhone(s: string): string {
  return s.replace(/[^\d+]/g, "");
}

// ── Listing ─────────────────────────────────────────────────────────────────

export async function listAllContacts(): Promise<{ contacts: ContactRow[]; companyId: string | null }> {
  const supabase = await createClient();
  const companyId = await getSelectedCompanyId();
  if (!companyId) return { contacts: [], companyId: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: customers }, { data: vendors }] = await Promise.all([
    (supabase as any).from("customers").select("id, name, phone, email, contact_person, gstin").eq("company_id", companyId).eq("is_active", true),
    (supabase as any).from("vendors").select("id, name, phone, email, contact_person, gstin").eq("company_id", companyId).eq("is_active", true),
  ]);

  const rows: ContactRow[] = [
    ...((customers ?? []) as Omit<ContactRow, "kind">[]).map((r) => ({ ...r, kind: "customer" as ContactKind })),
    ...((vendors   ?? []) as Omit<ContactRow, "kind">[]).map((r) => ({ ...r, kind: "vendor"   as ContactKind })),
  ];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { contacts: rows, companyId };
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function previewContactImport(rows: ImportRow[]): Promise<ImportPreview> {
  const { contacts } = await listAllContacts();

  // Build lookup maps
  const byName  = new Map<string, ContactRow>();
  const byGstin = new Map<string, ContactRow>();
  for (const c of contacts) {
    byName.set(normaliseName(c.name), c);
    if (c.gstin) byGstin.set(c.gstin.trim().toUpperCase(), c);
  }

  const preview: ImportPreview = { matched: [], unmatched: [], noChange: [] };

  for (const row of rows) {
    if (!row.name?.trim()) continue;
    const matched =
      (row.gstin && byGstin.get(row.gstin.trim().toUpperCase())) ||
      byName.get(normaliseName(row.name));

    if (!matched) {
      preview.unmatched.push(row);
      continue;
    }

    const changes: ImportPreview["matched"][0]["fieldChanges"] = [];
    const newPhone  = row.phone?.trim() || null;
    const newEmail  = row.email?.trim() || null;
    const newPerson = row.contact_person?.trim() || null;

    if (newPhone && normalisePhone(newPhone) !== normalisePhone(matched.phone ?? "")) {
      changes.push({ field: "phone", from: matched.phone, to: newPhone });
    }
    if (newEmail && (newEmail.toLowerCase() !== (matched.email ?? "").toLowerCase())) {
      changes.push({ field: "email", from: matched.email, to: newEmail });
    }
    if (newPerson && newPerson !== (matched.contact_person ?? "")) {
      changes.push({ field: "contact_person", from: matched.contact_person, to: newPerson });
    }

    if (changes.length === 0) preview.noChange.push(row);
    else preview.matched.push({ sourceRow: row, matchedTo: matched, fieldChanges: changes });
  }

  return preview;
}

// ── Commit ──────────────────────────────────────────────────────────────────

export async function commitContactImport(rows: ImportRow[]): Promise<{
  updatedCustomers: number;
  updatedVendors: number;
  unmatched: number;
  noChange: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { updatedCustomers: 0, updatedVendors: 0, unmatched: 0, noChange: 0, errors: ["Not authenticated"] };

  const preview = await previewContactImport(rows);
  const errors: string[] = [];
  let updatedCustomers = 0;
  let updatedVendors   = 0;

  for (const m of preview.matched) {
    const patch: Record<string, string | null> = {};
    for (const c of m.fieldChanges) patch[c.field] = c.to;
    const table = m.matchedTo.kind === "customer" ? "customers" : "vendors";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).update(patch).eq("id", m.matchedTo.id);
    if (error) {
      errors.push(`${m.matchedTo.name}: ${error.message}`);
      continue;
    }
    if (m.matchedTo.kind === "customer") updatedCustomers++;
    else updatedVendors++;
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard/payables");
  revalidatePath("/dashboard/receivables");

  return {
    updatedCustomers,
    updatedVendors,
    unmatched: preview.unmatched.length,
    noChange:  preview.noChange.length,
    errors,
  };
}

// ── Per-row update (kept for inline edit on the contacts page) ──────────────

export async function updateContact(input: {
  id: string;
  kind: ContactKind;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const patch: Record<string, string | null> = {};
  if (input.phone !== undefined)          patch.phone          = input.phone || null;
  if (input.email !== undefined)          patch.email          = input.email || null;
  if (input.contact_person !== undefined) patch.contact_person = input.contact_person || null;

  const table = input.kind === "customer" ? "customers" : "vendors";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/reminders");
  return { ok: true };
}
