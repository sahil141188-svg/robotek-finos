/**
 * Bank Statement Dashboard — Module 8
 *
 * Shows all bank accounts, total liquidity, weekly cashflow chart,
 * outflow breakdown, and recent transactions across all accounts.
 * RULE 1: Every account card links to /dashboard/banking/[accountId]
 * RULE 5: Indian number format (Lakhs / Crores)
 *
 * NOTE: Now fetches real imported bank data from database instead of sample data.
 */

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { CashflowChart } from "@/components/banking/cashflow-chart";
import { TransactionTable } from "@/components/banking/transaction-table";
import { fmtAmt } from "@/lib/bank-data";
import {
  fetchBankAccounts,
  fetchRecentBankStatements,
  calculateBankingSummary,
  fetchCashflowStats,
} from "@/lib/supabase/banking-queries";
import type { TxnCategory } from "@/lib/bank-data";
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

export default async function BankingPage() {
  // Fetch real data from database
  const bankAccounts = await fetchBankAccounts();
  const recentStatements = await fetchRecentBankStatements(15);
  const { total_liquidity, total_accounts, net_change } = await calculateBankingSummary(bankAccounts);

  // Current FY period: Apr 1 to today
  const today = new Date();
  const fyStart = today.getMonth() >= 3
    ? `${today.getFullYear()}-04-01`
    : `${today.getFullYear() - 1}-04-01`;
  const fyEnd = today.toISOString().split("T")[0];
  const { total_inflow, total_outflow, weekly, outflow_by_category } =
    await fetchCashflowStats(fyStart, fyEnd);

  // Convert database statements to transaction format for display
  const recentTxns = recentStatements.map((stmt) => {
    const categoryMap: Record<string, TxnCategory> = {
      "customer_receipt": "customer_receipt",
      "vendor_payment": "vendor_payment",
      "payroll": "payroll",
      "tax_payment": "tax_payment",
      "bank_charges": "bank_charges",
      "interest_income": "interest_income",
      "inter_account_transfer": "inter_account_transfer",
      "other_debit": "other_debit",
      "other_credit": "other_credit",
    };
    const category: TxnCategory = (stmt.category && categoryMap[stmt.category]) || "other_debit";

    return {
      id: stmt.id,
      account_id: stmt.bank_account_id,
      txn_date: String(stmt.transaction_date),
      value_date: stmt.value_date || "",
      description: stmt.description,
      debit: (stmt.debit || 0) / 100,  // Convert from paisa
      credit: (stmt.credit || 0) / 100,
      balance: (stmt.balance || 0) / 100,
      category,
      reference: stmt.reference || null,
      counterparty: stmt.counterparty || null,
    };
  });

  // Total outflow for percentage calc
  const totalOutflow = outflow_by_category.reduce((s, c) => s + c.total_out, 0);

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
            label="Total Liquidity" value={fmtAmt(total_liquidity)}
            sub={`${total_accounts} account${total_accounts !== 1 ? "s" : ""}`}
            className="bg-white border-border"
          />
          <KpiTile
            icon={<TrendingDown className="w-5 h-5 text-red-600" />}
            label="Net Change" value={fmtAmt(Math.abs(net_change))}
            sub={net_change >= 0 ? "increase since opening" : "decrease since opening"}
            className={net_change >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}
            valueClass={net_change >= 0 ? "text-green-700" : "text-red-700"}
          />
          <KpiTile
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            label={`Total Inflow (${fyStart.slice(0,7).replace("-","/")})`}
            value={fmtAmt(total_inflow / 100)}
            sub="customer receipts + interest"
            className="bg-green-50 border-green-200"
            valueClass="text-green-700"
          />
          <KpiTile
            icon={<Banknote className="w-5 h-5 text-red-600" />}
            label={`Total Outflow (${fyStart.slice(0,7).replace("-","/")})`}
            value={fmtAmt(total_outflow / 100)}
            sub="vendors, payroll, taxes"
            className="bg-red-50 border-red-200"
            valueClass="text-red-700"
          />
        </div>

        {/* ── Account cards ─────────────────────────────────────────── */}
        {bankAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-brand-gray-mid mb-2">No bank accounts imported yet</p>
            <p className="text-xs text-brand-gray-mid">Import a bank statement to see your accounts and transactions here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {bankAccounts.map((acct) => {
              const Icon = ACCOUNT_TYPE_ICON[acct.account_type] ?? Landmark;
              const opening = (acct.opening_balance || 0) / 100;
              const closing = (acct.closing_balance || 0) / 100;
              const change = closing - opening;
              const changePct = opening > 0 ? Math.round((change / opening) * 100) : 0;
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
                          {ACCOUNT_TYPE_LABEL[acct.account_type] || "Unknown"} ···{acct.account_number_last4}
                        </p>
                      </div>
                    </div>
                    {acct.is_primary && (
                      <span className="text-[9px] font-semibold bg-brand-red/10 text-brand-red px-1.5 py-0.5 rounded-full">PRIMARY</span>
                    )}
                  </div>

                  <p className="text-xs text-brand-gray-mid mb-0.5">Closing Balance</p>
                  <p className="text-xl font-bold text-brand-black">{fmtAmt(closing)}</p>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className={`flex items-center gap-1 text-xs ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {change >= 0
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />}
                      {change >= 0 ? "+" : ""}{changePct}% since {acct.period_start ? acct.period_start.split('-')[2] : "period start"}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-brand-gray-mid group-hover:text-brand-red transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Cash flow chart ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-brand-black mb-1">Weekly Cash Flow — All Accounts</h3>
          <p className="text-xs text-brand-gray-mid mb-4">
            {fyStart.slice(0,10)} – {fyEnd}
          </p>
          {weekly.length > 0 ? (
            <CashflowChart data={weekly} />
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-brand-gray-mid">
              No transactions yet — import a bank statement to see cash flow
            </div>
          )}
        </div>

        {/* ── Outflow breakdown + Recent transactions ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Outflow by category */}
          <div className="bg-white rounded-xl border border-border p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-brand-black mb-4">Outflow Breakdown</h3>
            {outflow_by_category.length > 0 ? (
              <div className="space-y-3">
                {outflow_by_category.map((cat) => {
                  const pct = totalOutflow > 0 ? Math.round((cat.total_out / totalOutflow) * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-brand-gray-mid">{cat.label}</span>
                        <span className="font-semibold text-brand-black">{fmtAmt(cat.total_out / 100)}</span>
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
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-brand-gray-mid text-center">
                No outflow data yet.<br />Import a bank statement to see breakdown.
              </div>
            )}
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
