"use client";

/**
 * TransactionTable — filterable list of bank transactions with category badges.
 * Used on both the main banking dashboard (recent txns) and account drill-down.
 */

import { useState, useMemo } from "react";
import { CATEGORY_META, fmtAmt, fmtD, type BankTransaction, type TxnCategory } from "@/lib/bank-data";
import { Search } from "lucide-react";

const CATEGORY_FILTERS: { value: TxnCategory | "all"; label: string }[] = [
  { value: "all",                    label: "All" },
  { value: "customer_receipt",       label: "Receipts" },
  { value: "vendor_payment",         label: "Vendor Pmts" },
  { value: "payroll",                label: "Payroll" },
  { value: "tax_payment",            label: "Tax" },
  { value: "inter_account_transfer", label: "Transfers" },
  { value: "bank_charges",           label: "Charges" },
  { value: "interest_income",        label: "Interest" },
];

interface Props {
  transactions: BankTransaction[];
  showBalance?: boolean;    // show running balance column (account drill-down)
  limit?:       number;     // if set, truncate after N rows (main dashboard)
}

export function TransactionTable({ transactions, showBalance = false, limit }: Props) {
  const [catFilter, setCatFilter]   = useState<TxnCategory | "all">("all");
  const [search,    setSearch]      = useState("");

  const filtered = useMemo(() => {
    let list = transactions;
    if (catFilter !== "all") list = list.filter((t) => t.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        (t.counterparty?.toLowerCase().includes(q) ?? false) ||
        (t.reference?.toLowerCase().includes(q) ?? false)
      );
    }
    return limit ? list.slice(0, limit) : list;
  }, [transactions, catFilter, search, limit]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray-mid" />
          <input
            type="text"
            placeholder="Search narration, counterparty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCatFilter(value)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all font-medium ${
                catFilter === value
                  ? "bg-brand-red text-white"
                  : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/60">
              <th className="px-3 py-2 text-left text-xs font-medium text-brand-gray-mid">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brand-gray-mid">Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-brand-gray-mid hidden sm:table-cell">Category</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-gray-mid">Debit</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-brand-gray-mid">Credit</th>
              {showBalance && (
                <th className="px-3 py-2 text-right text-xs font-medium text-brand-gray-mid hidden md:table-cell">Balance</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showBalance ? 6 : 5} className="px-3 py-8 text-center text-sm text-brand-gray-mid">
                  No transactions match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((txn) => {
                const meta = CATEGORY_META[txn.category];
                return (
                  <tr key={txn.id} className="hover:bg-brand-gray-light/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-brand-gray-mid whitespace-nowrap">{fmtD(txn.txn_date)}</td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="text-xs font-medium text-brand-black truncate">{txn.description}</p>
                      {txn.counterparty && (
                        <p className="text-[10px] text-brand-gray-mid truncate">{txn.counterparty}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-red-700 whitespace-nowrap">
                      {txn.debit > 0 ? fmtAmt(txn.debit) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium text-green-700 whitespace-nowrap">
                      {txn.credit > 0 ? fmtAmt(txn.credit) : "—"}
                    </td>
                    {showBalance && (
                      <td className="px-3 py-2.5 text-right text-xs text-brand-gray-mid whitespace-nowrap hidden md:table-cell">
                        {fmtAmt(txn.balance)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {limit && filtered.length === limit && (
        <p className="text-xs text-brand-gray-mid text-center pt-1">
          Showing latest {limit} transactions · open account to see all
        </p>
      )}
    </div>
  );
}
