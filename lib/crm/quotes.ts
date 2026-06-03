/**
 * Sales OS — products & quotations data access (server-only).
 * Same any-cast convention as lib/crm/queries.ts.
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Product = Database["public"]["Tables"]["crm_products"]["Row"];
type Quote = Database["public"]["Tables"]["crm_quotes"]["Row"];
type QuoteItem = Database["public"]["Tables"]["crm_quote_items"]["Row"];
type Account = Database["public"]["Tables"]["crm_accounts"]["Row"];

async function db(): Promise<any> {
  return (await createClient()) as any;
}

export async function getProducts(activeOnly = false): Promise<Product[]> {
  const sb = await db();
  let q = sb.from("crm_products").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []) as Product[];
}

export type QuoteWithNames = Quote & { account_name: string | null; owner_name: string | null };

export async function getQuotes(): Promise<QuoteWithNames[]> {
  const sb = await db();
  const [{ data }, { data: accs }, { data: users }] = await Promise.all([
    sb.from("crm_quotes").select("*").order("created_at", { ascending: false }),
    sb.from("crm_accounts").select("id, name"),
    sb.from("users").select("id, full_name"),
  ]);
  const accMap = new Map<string, string>();
  ((accs ?? []) as { id: string; name: string }[]).forEach((a) => accMap.set(a.id, a.name));
  const userMap = new Map<string, string>();
  ((users ?? []) as { id: string; full_name: string }[]).forEach((u) => userMap.set(u.id, u.full_name));
  return ((data ?? []) as Quote[]).map((q) => ({
    ...q,
    account_name: q.account_id ? accMap.get(q.account_id) ?? null : null,
    owner_name: q.owner_id ? userMap.get(q.owner_id) ?? null : null,
  }));
}

export type QuoteDetail = {
  quote: QuoteWithNames;
  items: QuoteItem[];
  account: Account | null;
};

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const sb = await db();
  const { data: quote } = await sb.from("crm_quotes").select("*").eq("id", id).single();
  if (!quote) return null;

  const [{ data: items }, accRes, userRes] = await Promise.all([
    sb.from("crm_quote_items").select("*").eq("quote_id", id).order("sort_order"),
    quote.account_id ? sb.from("crm_accounts").select("*").eq("id", quote.account_id).single() : Promise.resolve({ data: null }),
    quote.owner_id ? sb.from("users").select("full_name").eq("id", quote.owner_id).single() : Promise.resolve({ data: null }),
  ]);

  const account = (accRes?.data ?? null) as Account | null;
  return {
    quote: {
      ...(quote as Quote),
      account_name: account?.name ?? null,
      owner_name: (userRes?.data as { full_name?: string } | null)?.full_name ?? null,
    },
    items: (items ?? []) as QuoteItem[],
    account,
  };
}

/** Data needed by the quote builder: active products + accounts. */
export async function getQuoteFormData() {
  const sb = await db();
  const [{ data: products }, { data: accounts }] = await Promise.all([
    sb.from("crm_products").select("*").eq("is_active", true).order("name"),
    sb.from("crm_accounts").select("id, name").order("name"),
  ]);
  return {
    products: (products ?? []) as Product[],
    accounts: (accounts ?? []) as { id: string; name: string }[],
  };
}
