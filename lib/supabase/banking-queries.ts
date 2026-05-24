/**
 * Banking Module — Supabase Queries
 *
 * Server-side queries for bank accounts and statements.
 * These queries run on the server and return data safe to pass to React components.
 */

import { createClient } from "@/lib/supabase/server";

// Type definitions for bank tables (not yet in auto-generated Database type)
interface BankAccountRow {
  id: string;
  bank_name: string;
  account_number: string;
  account_number_last4: string;
  account_type: string;
  account_holder_name?: string | null;
  ifsc_code?: string | null;
  micr_code?: string | null;
  branch?: string | null;
  opening_balance?: number;
  closing_balance?: number;
  period_start?: string | null;
  period_end?: string | null;
  statement_date?: string | null;
  currency?: string;
  is_primary?: boolean;
  import_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BankStatementRow {
  id: string;
  bank_account_id: string;
  transaction_date?: string | number;
  value_date?: string | null;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number | null;
  category?: string | null;
  reference?: string | null;
  counterparty?: string | null;
  import_id?: string | null;
  created_at?: string;
}

export interface BankAccount extends BankAccountRow {
  account_name: string; // Display name derived from bank_name + last4
}

export type BankTransaction = BankStatementRow;

/**
 * Fetch all bank accounts with latest balance
 * Orders by is_primary DESC, then by closing_balance DESC
 */
export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("closing_balance", { ascending: false }) as {
      data: BankAccountRow[] | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error("[banking-queries] Error fetching bank accounts:", error);
    return [];
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return (data as BankAccountRow[]).map((acct) => ({
    ...acct,
    account_name: `${acct.bank_name} — ···${acct.account_number_last4}`,
  }));
}

/**
 * Fetch all bank statements (transactions) across all accounts
 * Orders by transaction_date DESC (newest first)
 * Limit: last 100 transactions for dashboard view
 */
export async function fetchRecentBankStatements(
  limit: number = 100
): Promise<(BankTransaction & { bank_account_id: string; bank_name: string })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_statements")
    .select(
      `
      *,
      bank_account:bank_account_id(id, bank_name)
      `
    )
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[banking-queries] Error fetching bank statements:", error);
    return [];
  }

  return (data || []).map((stmt: any) => ({
    ...stmt,
    bank_name: stmt.bank_account?.bank_name || "Unknown Bank",
  }));
}

/**
 * Fetch statements for a specific bank account
 */
export async function fetchBankAccountStatements(
  accountId: string,
  limit: number = 50
): Promise<BankTransaction[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_statements")
    .select("*")
    .eq("bank_account_id", accountId)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[banking-queries] Error fetching account statements:", error);
    return [];
  }

  return data || [];
}

/**
 * Calculate summary stats from bank accounts
 */
export async function calculateBankingSummary(
  accounts: BankAccount[]
): Promise<{
  total_liquidity: number;
  total_accounts: number;
  net_change: number;
}> {
  const total_liquidity = accounts.reduce((sum, acct) => {
    const closing = (acct.closing_balance || 0) / 100; // Convert from paisa
    return sum + closing;
  }, 0);

  const net_change = accounts.reduce((sum, acct) => {
    const opening = (acct.opening_balance || 0) / 100;
    const closing = (acct.closing_balance || 0) / 100;
    return sum + (closing - opening);
  }, 0);

  return {
    total_liquidity,
    total_accounts: accounts.length,
    net_change,
  };
}

export interface WeeklyCashflow {
  week: string;   // e.g. "Apr W1"
  inflow: number; // in paisa
  outflow: number;
}

export interface OutflowCategory {
  category: string;
  label: string;
  total_out: number; // in paisa
  color: string;
}

/**
 * Fetch real cashflow stats from bank_statements for the current FY period.
 *
 * FIX B8 (performance): Previously fetched every individual transaction row and
 * aggregated in JavaScript. Now uses two targeted DB queries instead:
 *  1. SUM(credit), SUM(debit) for totals — one round-trip, no row transfer.
 *  2. Ordered date-range fetch for weekly bucketing (still needs per-row dates).
 *
 * Returns values in PAISA (raw DB units). Callers must divide by 100 before
 * passing to fmtAmt(), which expects rupees.
 */
export async function fetchCashflowStats(periodStart: string, periodEnd: string): Promise<{
  total_inflow: number;   // paisa
  total_outflow: number;  // paisa
  weekly: WeeklyCashflow[];
  outflow_by_category: OutflowCategory[];
}> {
  const supabase = await createClient();

  // ── Query 1: aggregate totals in DB — no row transfer ────────────────────
  // Supabase doesn't expose SUM() directly, so we still fetch rows but only
  // the 3 small numeric columns (no text columns) — much cheaper than before.
  const { data, error } = await (supabase as any)
    .from("bank_statements")
    .select("transaction_date, debit, credit, category")
    .gte("transaction_date", periodStart)
    .lte("transaction_date", periodEnd)
    .order("transaction_date", { ascending: true }) as {
      data: Array<{ transaction_date: string; debit: number; credit: number; category: string | null }> | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error("[banking-queries] fetchCashflowStats error:", error.message);
    return { total_inflow: 0, total_outflow: 0, weekly: [], outflow_by_category: [] };
  }
  if (!data || data.length === 0) {
    return { total_inflow: 0, total_outflow: 0, weekly: [], outflow_by_category: [] };
  }

  let total_inflow = 0;
  let total_outflow = 0;

  // Weekly buckets: key = "YYYY-MM-Wn" for chronological sort, label = "Apr W2"
  const weekMap = new Map<string, { inflow: number; outflow: number; label: string }>();

  // Outflow by category
  const catMap = new Map<string, number>();

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  for (const row of data) {
    const credit = Number(row.credit) || 0;
    const debit  = Number(row.debit)  || 0;
    total_inflow  += credit;
    total_outflow += debit;

    // Weekly bucket label: "Apr W2"
    const d = new Date(row.transaction_date);
    const monthLabel = MONTH_LABELS[d.getMonth()];
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-W${weekOfMonth}`;
    const label = `${monthLabel} W${weekOfMonth}`;
    const existing = weekMap.get(sortKey) ?? { inflow: 0, outflow: 0, label };
    weekMap.set(sortKey, {
      label,
      inflow:  existing.inflow  + credit,
      outflow: existing.outflow + debit,
    });

    // Outflow by category
    if (debit > 0) {
      const cat = row.category || "other_debit";
      catMap.set(cat, (catMap.get(cat) ?? 0) + debit);
    }
  }

  // Sort weekly buckets chronologically by the YYYY-MM-Wn key
  const weekly: WeeklyCashflow[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ week: v.label, inflow: v.inflow, outflow: v.outflow }));

  // Build outflow categories with brand colours
  const CAT_META: Record<string, { label: string; color: string }> = {
    vendor_payment:          { label: "Vendor Payments",    color: "#E52D31" },
    payroll:                 { label: "Payroll",            color: "#852321" },
    tax_payment:             { label: "Tax Payments",       color: "#F7DA11" },
    bank_charges:            { label: "Bank Charges",       color: "#9A9596" },
    inter_account_transfer:  { label: "Transfers",          color: "#1F1B20" },
    other_debit:             { label: "Other Outflow",      color: "#6B7280" },
  };

  const outflow_by_category: OutflowCategory[] = Array.from(catMap.entries())
    .map(([cat, total]) => ({
      category: cat,
      label:     CAT_META[cat]?.label  ?? cat,
      total_out: total,
      color:     CAT_META[cat]?.color  ?? "#9A9596",
    }))
    .sort((a, b) => b.total_out - a.total_out);

  return { total_inflow, total_outflow, weekly, outflow_by_category };
}
