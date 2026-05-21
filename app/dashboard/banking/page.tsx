/**
 * Bank Statement Dashboard — Module 8
 *
 * Shows all bank accounts, total liquidity, weekly cashflow chart,
 * outflow breakdown, and recent transactions across all accounts.
 * RULE 1: Every account card links to /dashboard/banking/[accountId]
 * RULE 5: Indian number format (Lakhs / Crores)
 */

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { CashflowChart } from "@/components/banking/cashflow-chart";
import { TransactionTable } from "@/components/banking/transaction-table";
import {
  BANK_ACCOUNTS, BANK_TRANSACTIONS, WEEKLY_CASHFLOW,
  OUTFLOW_CATEGORIES, fmtAmt, fmtD,
} from "@/lib/bank-data";
import {
  Landmark, TrendingUp, TrendingDown, ArrowRight,
  CreditCard, Banknote, Building2,
} from "lucide-react";

const ACCOUNT_TYPE_ICON: Record<string, React.ElementType> = {
  current: Building2,
  savings: Landmark,
  od:      CreditCard,
  cc:      CreditCard,
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  current: "Current Account",
  savings: "Savings Account",
  od:      "OD Account",
  cc:      "Credit Card",
};

export default function BankingPage() {
  const totalLiquidity   = BANK_ACCOUNTS.reduce((s, a) => s + a.current_balance, 0);
  const totalOpening     = BANK_ACCOUNTS.reduce((s, a) => s + a.opening_balance, 0);
  const netChange        = totalLiquidity - totalOpening;

  // Recent transactions across all accounts (sorted by date, newest first)
  const recentTxns = [...BANK_TRANSACTIONS]
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date))
    .slice(0, 15);

  // Total outflow this period
  const totalOutflow = OUTFLOW_CATEGORIES.reduce((s, c) => s + c.total_out, 0);

  return (
    <>
      <Header
        title="Bank Statements"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bank Statements" },
        ]}
        showImport
        importModule="banking"
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-6xl">

        {/* ── KPI tiles ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            icon={<Landmark className="w-5 h-5 text-brand-red" />}
            label="Total Liquidity" value={fmtAmt(totalLiquidity)}
            sub={`${BANK_ACCOUNTS.length} accounts`}
            className="bg-white border-border"
          />
          <KpiTile
            icon={<TrendingDown className="w-5 h-5 text-red-600" />}
            label="Net Change (Apr–May)" value={fmtAmt(Math.abs(netChange))}
            sub={netChange >= 0 ? "increase" : "decrease from Apr 1"}
            className={netChange >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}
            valueClass={netChange >= 0 ? "text-green-700" : "text-red-700"}
          />
          <KpiTile
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            label="Total Inflow (Apr–May)"
            value={fmtAmt(WEEKLY_CASHFLOW.reduce((s, w) => s + w.inflow, 0))}
            sub="customer receipts + interest"
            className="bg-green-50 border-green-200"
            valueClass="text-green-700"
          />
          <KpiTile
            icon={<Banknote className="w-5 h-5 text-red-600" />}
            label="Total Outflow (Apr–May)"
            value={fmtAmt(WEEKLY_CASHFLOW.reduce((s, w) => s + w.outflow, 0))}
            sub="vendors, payroll, taxes"
            className="bg-red-50 border-red-200"
            valueClass="text-red-700"
          />
        </div>

        {/* ── Account cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BANK_ACCOUNTS.map((acct) => {
            const Icon       = ACCOUNT_TYPE_ICON[acct.account_type] ?? Landmark;
            const change     = acct.current_balance - acct.opening_balance;
            const changePct  = Math.round((change / acct.opening_balance) * 100);
            return (
              <Link
                key={acct.id}
                href={`/dashboard/banking/${acct.id}`}
                className="bg-white rounded-xl border border-border p-4 hover:border-brand-red/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-brand-gray-light flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-brand-gray-mid" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-brand-black leading-tight">{acct.bank_name}</p>
                      <p className="text-[10px] text-brand-gray-mid">
                        {ACCOUNT_TYPE_LABEL[acct.account_type]} ···{acct.account_number_last4}
                      </p>
                    </div>
                  </div>
                  {acct.is_primary && (
                    <span className="text-[9px] font-semibold bg-brand-red/10 text-brand-red px-1.5 py-0.5 rounded-full">PRIMARY</span>
                  )}
                </div>

                <p className="text-xs text-brand-gray-mid mb-0.5">Current Balance</p>
                <p className="text-xl font-bold text-brand-black">{fmtAmt(acct.current_balance)}</p>

                {acct.od_limit && (
                  <p className="text-[10px] text-brand-gray-mid mt-0.5">OD limit: {fmtAmt(acct.od_limit)}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className={`flex items-center gap-1 text-xs ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {change >= 0
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />}
                    {change >= 0 ? "+" : ""}{changePct}% since Apr 1
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-gray-mid group-hover:text-brand-red transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Cash flow chart ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-brand-black mb-1">Weekly Cash Flow — All Accounts</h3>
          <p className="text-xs text-brand-gray-mid mb-4">Apr 1 – May 22, 2026</p>
          <CashflowChart data={WEEKLY_CASHFLOW} />
        </div>

        {/* ── Outflow breakdown + Recent transactions ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Outflow by category */}
          <div className="bg-white rounded-xl border border-border p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-brand-black mb-4">Outflow Breakdown</h3>
            <div className="space-y-3">
              {OUTFLOW_CATEGORIES.map((cat) => {
                const pct = Math.round((cat.total_out / totalOutflow) * 100);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-brand-gray-mid">{cat.label}</span>
                      <span className="font-semibold text-brand-black">{fmtAmt(cat.total_out)}</span>
                    </div>
                    <div className="h-2 bg-brand-gray-light rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <p className="text-[10px] text-brand-gray-mid mt-0.5 text-right">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-xl border border-border overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Recent Transactions</h3>
              <span className="text-xs text-brand-gray-mid">All accounts · latest 15</span>
            </div>
            <div className="p-4">
              <TransactionTable transactions={recentTxns} showBalance={false} />
            </div>
          </div>

        </div>
      </main>
    </>
  );
}

function KpiTile({ icon, label, value, sub, className, valueClass = "text-brand-black" }: {
  icon: React.ReactNode; label: string; value: string;
  sub: string; className?: string; valueClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-medium text-brand-gray-mid leading-tight">{label}</p>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid">{sub}</p>
    </div>
  );
}
