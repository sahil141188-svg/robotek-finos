/**
 * Bank Account Drill-Down — Module 8 Layer 3
 *
 * Shows full transaction history for a single account with running balance,
 * monthly inflow/outflow summary, and category breakdown.
 * RULE 2: Three-layer drill — Dashboard → Bank Summary → Account Ledger
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { TransactionTable } from "@/components/banking/transaction-table";
import {
  BANK_ACCOUNTS, getAccountTransactions, fmtAmt, fmtD,
  CATEGORY_META, type TxnCategory,
} from "@/lib/bank-data";
import {
  ArrowLeft, TrendingUp, TrendingDown, CreditCard,
  Building2, Landmark, Calendar,
} from "lucide-react";

export async function generateStaticParams() {
  return BANK_ACCOUNTS.map((a) => ({ accountId: a.id }));
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  current: "Current Account",
  savings: "Savings Account",
  od:      "Overdraft Account",
  cc:      "Credit Card",
};

export default async function AccountDrillPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const account = BANK_ACCOUNTS.find((a) => a.id === accountId);
  if (!account) notFound();

  const transactions = getAccountTransactions(account.id);
  const change       = account.current_balance - account.opening_balance;
  const changePct    = Math.round((change / account.opening_balance) * 100);

  // Monthly summary
  const aprTxns = transactions.filter((t) => t.txn_date.startsWith("2026-04"));
  const mayTxns = transactions.filter((t) => t.txn_date.startsWith("2026-05"));
  const monthlySummary = [
    {
      month:   "April 2026",
      inflow:  aprTxns.reduce((s, t) => s + t.credit, 0),
      outflow: aprTxns.reduce((s, t) => s + t.debit,  0),
      count:   aprTxns.length,
    },
    {
      month:   "May 2026 (MTD)",
      inflow:  mayTxns.reduce((s, t) => s + t.credit, 0),
      outflow: mayTxns.reduce((s, t) => s + t.debit,  0),
      count:   mayTxns.length,
    },
  ];

  // Category breakdown
  const catMap: Partial<Record<TxnCategory, { in: number; out: number; count: number }>> = {};
  transactions.forEach((t) => {
    const c = catMap[t.category] ?? { in: 0, out: 0, count: 0 };
    c.in    += t.credit;
    c.out   += t.debit;
    c.count += 1;
    catMap[t.category] = c;
  });
  const catBreakdown = Object.entries(catMap)
    .map(([cat, v]) => ({ cat: cat as TxnCategory, ...v! }))
    .sort((a, b) => (b.in + b.out) - (a.in + a.out));

  return (
    <>
      <Header
        title={account.account_name}
        breadcrumbs={[
          { label: "Dashboard",      href: "/dashboard" },
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
                  ? <Landmark className="w-6 h-6 text-brand-gray-mid" />
                  : <Building2 className="w-6 h-6 text-brand-gray-mid" />
                }
              </div>
              <div>
                <h1 className="text-lg font-bold text-brand-black">{account.account_name}</h1>
                <p className="text-sm text-brand-gray-mid">
                  {account.bank_name} · {ACCOUNT_TYPE_LABEL[account.account_type]} · A/C ···{account.account_number_last4}
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
              <p className="text-xs text-brand-gray-mid">Opening Balance (Apr 1)</p>
              <p className="text-lg font-bold text-brand-black">{fmtAmt(account.opening_balance)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-gray-mid">Current Balance (May 22)</p>
              <p className="text-lg font-bold text-brand-black">{fmtAmt(account.current_balance)}</p>
            </div>
            {account.od_limit && (
              <div>
                <p className="text-xs text-brand-gray-mid">OD Limit</p>
                <p className="text-lg font-bold text-brand-black">{fmtAmt(account.od_limit)}</p>
              </div>
            )}
            <div className={`flex items-center gap-1.5 ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
              {change >= 0
                ? <TrendingUp className="w-4 h-4" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {monthlySummary.map(({ month, inflow, outflow, count }) => (
            <div key={month} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-brand-gray-mid" />
                <p className="text-sm font-semibold text-brand-black">{month}</p>
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

        {/* Category breakdown */}
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

        {/* Full transaction list */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-black">All Transactions</h3>
            <span className="text-xs text-brand-gray-mid">{transactions.length} entries · Apr–May 2026</span>
          </div>
          <div className="p-4">
            <TransactionTable transactions={transactions} showBalance={true} />
          </div>
        </div>
      </main>
    </>
  );
}
