"use server";

/**
 * Sales OS — product & quotation actions.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmQuoteStatus } from "@/types/database";

type Result = { error: string | null };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function num(fd: FormData, k: string): number {
  const n = Number(fd.get(k));
  return Number.isFinite(n) ? n : 0;
}

// ── PRODUCTS ────────────────────────────────────────────────

export async function createProduct(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };
  const name = str(formData, "name");
  if (!name) return { error: "Product name is required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_products").insert({
    name,
    sku: str(formData, "sku"),
    category: str(formData, "category"),
    hsn: str(formData, "hsn"),
    unit: str(formData, "unit") ?? "pcs",
    unit_price: num(formData, "unit_price"),
    gst_rate: formData.get("gst_rate") !== null ? num(formData, "gst_rate") : 18,
    created_by: uid,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/products");
  return { error: null };
}

export async function toggleProduct(id: string, isActive: boolean): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_products").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/products");
  return { error: null };
}

// ── QUOTES ──────────────────────────────────────────────────

export type QuoteItemInput = {
  product_id?: string | null;
  description: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
};

export async function createQuote(input: {
  account_id?: string | null;
  deal_id?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: QuoteItemInput[];
}): Promise<{ error: string | null; id?: string }> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };

  const items = (input.items ?? []).filter((i) => i.description?.trim() && i.qty > 0);
  if (items.length === 0) return { error: "Add at least one line item" };

  // Compute totals.
  let subtotal = 0, taxTotal = 0;
  const computed = items.map((it, idx) => {
    const lineSub = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    const lineTax = lineSub * ((Number(it.gst_rate) || 0) / 100);
    subtotal += lineSub;
    taxTotal += lineTax;
    return {
      product_id: it.product_id ?? null,
      description: it.description.trim(),
      qty: Number(it.qty) || 0,
      unit_price: Number(it.unit_price) || 0,
      gst_rate: Number(it.gst_rate) || 0,
      line_subtotal: Math.round(lineSub * 100) / 100,
      line_tax: Math.round(lineTax * 100) / 100,
      line_total: Math.round((lineSub + lineTax) * 100) / 100,
      sort_order: idx,
    };
  });
  const total = Math.round((subtotal + taxTotal) * 100) / 100;

  const supabase = (await createClient()) as any;

  // Quote number: Q-YYYYMM-NNNN based on current count.
  const { count } = await supabase.from("crm_quotes").select("id", { count: "exact", head: true });
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const quoteNumber = `Q-${ym}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: quote, error } = await supabase
    .from("crm_quotes")
    .insert({
      quote_number: quoteNumber,
      account_id: input.account_id ?? null,
      deal_id: input.deal_id ?? null,
      status: "draft",
      subtotal: Math.round(subtotal * 100) / 100,
      tax_total: Math.round(taxTotal * 100) / 100,
      total,
      valid_until: input.valid_until || null,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      owner_id: uid,
      created_by: uid,
    })
    .select("id")
    .single();
  if (error || !quote) return { error: error?.message ?? "Could not create quote" };

  const { error: itemsErr } = await supabase
    .from("crm_quote_items")
    .insert(computed.map((c) => ({ ...c, quote_id: quote.id })));
  if (itemsErr) return { error: itemsErr.message };

  revalidatePath("/dashboard/sales-os/quotes");
  return { error: null, id: quote.id };
}

export async function setQuoteStatus(id: string, status: CrmQuoteStatus): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_quotes").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/quotes");
  revalidatePath(`/dashboard/sales-os/quotes/${id}`);
  return { error: null };
}
