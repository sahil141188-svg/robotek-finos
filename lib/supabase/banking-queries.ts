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
