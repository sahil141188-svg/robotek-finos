/**
 * Bank Account Drill-Down — Module 8 Layer 3
 *
 * Shows full transaction history for a single account with running balance,
 * monthly inflow/outflow summary, and category breakdown.
 * RULE 2: Three-layer drill — Dashboard → Bank Summary → Account Ledger
 *
 * FIX N1/N8: Previously used BANK_ACCOUNTS (static empty []) — always 404.
 * Now fetches account and transactions from Supabase by accountId.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { TransactionTable } from "@/components/banking/transaction-table";
import { CATEGORY_META, type TxnCategory, fmtAmt } from "@/lib/bank-data";
import {
  fetchBankAccounts,
  fetchBankAccountStatements,
} from "@/lib/supabase/banking-queries";
import {
  ArrowLeft, TrendingUp, TrendingDown, CreditCard,
  Building2, Landmark, Calendar,
} from "lucide-react";

// Force dynamic rendering — account list is user-specific and changes on import
export const dynamic = "force-dynamic";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  current: "Current Account",
  savings: "Savings Account",
  od:      "Overdraft Account",
  cc:      "Credit Card",
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function AccountDrillPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  // ── Fetch account from DB ──────────────────────────────────────────────────
  const allAccounts = await fetchBankAccounts();
  const account = allAccounts.find((a) => a.id === accountId);
  if (!account) notFound();

  // ── Fetch transactions from DB (all, up to 1000) ──────────────────────────
  const rawStatements = await fetchBankAccountStatements(accountId, 1000);

  // Convert DB format (paisa) → display format (rupees) for TransactionTable
  const transactions = rawStatements.map((stmt) => ({
    id:           stmt.id,
    account_id:   stmt.bank_account_id,
    txn_date:     String(stmt.transaction_date),
    value_date:   stmt.value_date || "",
    description:  stmt.description,
    debit:        (stmt.debit  || 0) / 100,
    credit:       (stmt.credit || 0) / 100,
    balance:      (stmt.balance || 0) / 100,
    category:     (stmt.category as TxnCategory) || "other_debit",
    reference:    stmt.reference || null,
    counterparty: stmt.counterparty || null,
  }));

  // ── Balances (paisa → rupees) ──────────────────────────────────────────────
  const opening = (account.opening_balance || 0) / 100;
  const closing = (account.closing_balance || 0) / 100;
  const change  = closing - opening;
  const changePct = opening > 0 ? Math.round((change / opening) * 100) : 0;

  // ── Build monthly summary from actual transaction dates ────────────────────
  // Group transactions into the two most-recent months in the data
  const monthMap = new Map<string, { label: string; inflow: number; outflow: number; count: number }>();
  for (const t of transactions) {
    const d = new Date(t.txn_date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    const existing = monthMap.get(key) ?? { label, inflow: 0, outflow: 0, count: 0 };
    monthMap.set(key, {
      label,
      inflow:  existing.inflow  + t.credit,
      outflow: existing.outflow + t.debit,
      count:   existing.count   + 1,
    });
  }
  // Show last 2 months (most recent first)
  const monthlySummary = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 2)
    .map(([, v]) => v);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catMap: Partial<Record<TxnCategory, { in: number; out: number; count: number }>> = {};
  for (const t of transactions) {
    const c = catMap[t.category] ?? { in: 0, out: 0, count: 0 };
    c.in    += t.credit;
    c.out   += t.debit;
    c.count += 1;
    catMap[t.category] = c;
  }
  const catBreakdown = Object.entries(catMap)
    .map(([cat, v]) => ({ cat: cat as TxnCategory, ...v! }))
    .sort((a, b) => (b.in + b.out) - (a.in + a.out));

  const periodLabel = account.period_start && account.period_end
    ? `${account.period_start} – ${account.period_end}`
    : "All transactions";

  return (
    <>
      <Header
        title={account.account_name}
        breadcrumbs={[
          { label: "Dashboard",       href: "/dashboard" },
          { label: "Bank Statements", href: "/dashboard/banking" },
          { label: `${account.bank_name} ···${account.account_number_last4}` },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl space-y-5">
        <Link
          href="/dashboard/banking"
          className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Bank Statements
        </Link>

        {/* Account header */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-gray-light flex items-center justify-center shrink-0">
                {account.account_type === "od" || account.account_type === "cc"
                  ? <CreditCard className="w-6 h-6 text-brand-gray-mid" />
                  : account.account_type === "savings"
                  ? <Landmark  className="w-6 h-6 text-brand-gray-mid" />
                  : <Building2 className="w-6 h-6 text-brand-gray-mid" />
                }
              </div>
              <div>
                <h1 className="text-lg font-bold text-brand-black">{account.account_name}</h1>
                <p className="text-sm text-brand-gray-mid">
                  {account.bank_name} · {ACCOUNT_TYPE_LABEL[account.account_type] || "Account"} · A/C ···{account.account_number_last4}
                </p>
              </div>
            </div>
            {account.is_primary && (
              <span className="text-xs font-semibold bg-brand-red/10 text-brand-red px-2.5 py-1 rounded-full">
                Primary Account
              </span>
            )}
          </div>

          {/* Balance strip */}
          <div className="flex flex-wrap gap-6 pt-3 border-t border-border">
            <div>
              <p className="text-xs text-brand-gray-mid">Opening Balance</p>
              <p className="text-lg font-bold text-brand-black">{fmtAmt(opening)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-gray-mid">Closing Balance</p>
              <p className="text-lg font-bold text-brand-black">{fmtAmt(closing)}</p>
            </div>
            <div className={`flex items-center gap-1.5 ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
              {change >= 0
                ? <TrendingUp  className="w-4 h-4" />
                : <TrendingDown className="w-4 h-4" />}
              <div>
                <p className="text-xs text-brand-gray-mid">Net Change</p>
                <p className="text-lg font-bold">
                  {change >= 0 ? "+" : ""}{fmtAmt(Math.abs(change))} ({change >= 0 ? "+" : ""}{changePct}%)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly summary tiles */}
        {monthlySummary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthlySummary.map(({ label, inflow, outflow, count }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-brand-gray-mid" />
                  <p className="text-sm font-semibold text-brand-black">{label}</p>
                  <span className="text-xs text-brand-gray-mid ml-auto">{count} txns</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-brand-gray-mid mb-0.5">Inflow</p>
                    <p className="text-sm font-bold text-green-700">{inflow > 0 ? fmtAmt(inflow) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-gray-mid mb-0.5">Outflow</p>
                    <p className="text-sm font-bold text-red-700">{outflow > 0 ? fmtAmt(outflow) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-gray-mid mb-0.5">Net</p>
                    <p className={`text-sm font-bold ${inflow - outflow >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {inflow - outflow >= 0 ? "+" : ""}{fmtAmt(Math.abs(inflow - outflow))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-3">Transaction Category Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {catBreakdown.map(({ cat, in: inAmt, out: outAmt, count }) => {
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-brand-gray-light/50">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-brand-gray-mid">{count}×</span>
                    </div>
                    <div className="text-right">
                      {inAmt  > 0 && <p className="text-xs font-medium text-green-700">+{fmtAmt(inAmt)}</p>}
                      {outAmt > 0 && <p className="text-xs font-medium text-red-700">−{fmtAmt(outAmt)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full transaction list */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-black">All Transactions</h3>
            <span className="text-xs text-brand-gray-mid">
              {transactions.length} entries · {periodLabel}
            </span>
          </div>
          <div className="p-4">
            {transactions.length > 0 ? (
              <TransactionTable transactions={transactions} showBalance={true} />
            ) : (
              <p className="text-sm text-brand-gray-mid text-center py-8">
                No transactions found for this account.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
