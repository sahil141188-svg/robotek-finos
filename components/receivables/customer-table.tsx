"use client";

/**
 * CustomerTable — sortable/filterable AR customer list with aging columns.
 * RULE 1: Every customer name is clickable → /dashboard/receivables/[customerId]
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, AlertTriangle, MessageSquare, Search, X } from "lucide-react";
import {
  SAMPLE_CUSTOMERS, customerTotal, customerOverdue, fmtAmt, fmtD,
  type SampleCustomer,
} from "@/lib/receivables-data";
import { ExportButtons } from "@/components/ui/export-buttons";
import { downloadExcel, printAsPDF } from "@/lib/export-utils";

type SortKey = "name" | "total" | "overdue" | "ag0to30" | "ag31to60" | "ag61to90" | "ag90plus";
type Filter  = "All" | "Overdue" | "Critical";

interface Props {
  customers: SampleCustomer[];
}

export function CustomerTable({ customers }: Props) {
  const [filter, setFilter]   = useState<Filter>("All");
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overdue");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === "Overdue")  list = list.filter((c) => customerOverdue(c) > 0);
    if (filter === "Critical") list = list.filter((c) => c.ag90plus > 0 || c.ag61to90 > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.gstin ?? "").toLowerCase().includes(q) ||
      (c.contact_person ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sortKey === "name")    { return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      let av = 0, bv = 0;
      if (sortKey === "total")   { av = customerTotal(a);  bv = customerTotal(b); }
      if (sortKey === "overdue") { av = customerOverdue(a); bv = customerOverdue(b); }
      if (sortKey === "ag0to30")   { av = a.ag0to30;   bv = b.ag0to30; }
      if (sortKey === "ag31to60")  { av = a.ag31to60;  bv = b.ag31to60; }
      if (sortKey === "ag61to90")  { av = a.ag61to90;  bv = b.ag61to90; }
      if (sortKey === "ag90plus")  { av = a.ag90plus;  bv = b.ag90plus; }
      return sortAsc ? av - bv : bv - av;
    });
  }, [customers, filter, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filterCounts = {
    All:      customers.length,
    Overdue:  customers.filter((c) => customerOverdue(c) > 0).length,
    Critical: customers.filter((c) => c.ag90plus > 0 || c.ag61to90 > 0).length,
  };

  // ── Export handlers ──────────────────────────────────────────────────────────
  function handleExcelExport() {
    const rows = filtered.map((c) => ({
      "Customer":          c.name,
      "Segment":           c.segment,
      "0–30 Days":         c.ag0to30   > 0 ? c.ag0to30   : "",
      "31–60 Days":        c.ag31to60  > 0 ? c.ag31to60  : "",
      "61–90 Days":        c.ag61to90  > 0 ? c.ag61to90  : "",
      "90+ Days":          c.ag90plus  > 0 ? c.ag90plus  : "",
      "Total (₹)":         customerTotal(c),
      "Overdue (₹)":       customerOverdue(c),
      "Last Payment Date": fmtD(c.last_payment_date ?? null),
    }));
    downloadExcel(rows, "AR_Aging_Report", "AR Aging",
      [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
    );
  }

  function handlePDFExport() {
    const rows = filtered.map((c) => `
      <tr>
        <td>${c.name}</td>
        <td>${c.segment}</td>
        <td class="num">${c.ag0to30  > 0 ? fmtAmt(c.ag0to30)  : "—"}</td>
        <td class="num">${c.ag31to60 > 0 ? fmtAmt(c.ag31to60) : "—"}</td>
        <td class="num">${c.ag61to90 > 0 ? fmtAmt(c.ag61to90) : "—"}</td>
        <td class="num">${c.ag90plus > 0 ? fmtAmt(c.ag90plus) : "—"}</td>
        <td class="num"><strong>${fmtAmt(customerTotal(c))}</strong></td>
      </tr>`).join("");
    const totals = `<tfoot><tr>
      <td colspan="2" style="font-weight:700">Total (${filtered.length} customers)</td>
      <td class="num">${fmtAmt(filtered.reduce((s, c) => s + c.ag0to30, 0))}</td>
      <td class="num">${fmtAmt(filtered.reduce((s, c) => s + c.ag31to60, 0))}</td>
      <td class="num">${fmtAmt(filtered.reduce((s, c) => s + c.ag61to90, 0))}</td>
      <td class="num">${fmtAmt(filtered.reduce((s, c) => s + c.ag90plus, 0))}</td>
      <td class="num">${fmtAmt(filtered.reduce((s, c) => s + customerTotal(c), 0))}</td>
    </tr></tfoot>`;
    printAsPDF(`
      <h1>Accounts Receivable — Aging Report</h1>
      <p class="subtitle">Filter: ${filter} · ${filtered.length} customers · Exported ${new Date().toLocaleDateString("en-IN")}</p>
      <style>.num { text-align: right; }</style>
      <table>
        <thead><tr>
          <th>Customer</th><th>City</th>
          <th style="text-align:right">0–30d</th><th style="text-align:right">31–60d</th>
          <th style="text-align:right">61–90d</th><th style="text-align:right">90+d</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>${totals}
      </table>`, "AR Aging Report — Robotek FinOS");
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-brand-gray-light">
        <div className="flex items-center gap-1">
          {(["All", "Overdue", "Critical"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                filter === f
                  ? f === "Critical" ? "bg-red-600 text-white" : f === "Overdue" ? "bg-orange-500 text-white" : "bg-brand-red text-white"
                  : "text-brand-gray-mid hover:text-brand-black"
              }`}
            >
              {f} ({filterCounts[f]})
            </button>
          ))}
        </div>
        {/* Search box */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-brand-gray-mid absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer / GSTIN / phone / email…"
            className="w-full text-xs border border-border rounded-lg pl-8 pr-7 py-1.5 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-brand-gray-mid">{filtered.length} customers</span>
        <ExportButtons onExcelClick={handleExcelExport} onPDFClick={handlePDFExport} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/60">
              <SortTh label="Customer"    sortKey="name"     current={sortKey} asc={sortAsc} onSort={toggleSort} align="left" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-gray-mid whitespace-nowrap">Segment</th>
              <SortTh label="0–30 Days"  sortKey="ag0to30"  current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="31–60 Days" sortKey="ag31to60" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="61–90 Days" sortKey="ag61to90" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="90+ Days"   sortKey="ag90plus" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="Total"      sortKey="total"    current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-right text-xs font-medium text-brand-gray-mid whitespace-nowrap">Last Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => {
              const total      = customerTotal(c);
              const overdue    = customerOverdue(c);
              const isCritical = c.ag90plus > 0;
              const isOverdue  = c.ag31to60 > 0 || c.ag61to90 > 0;
              const hasNotes   = !!c.collection_notes;

              return (
                <tr key={c.id} className={`hover:bg-brand-gray-light/40 transition-colors ${isCritical ? "bg-red-50/40" : isOverdue ? "bg-amber-50/30" : ""}`}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {(isCritical || isOverdue) && (
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isCritical ? "text-red-500" : "text-amber-500"}`} />
                      )}
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/receivables/${c.id}`}
                          className="font-medium text-brand-black hover:text-brand-red transition-colors"
                        >
                          {c.name}
                        </Link>
                        {hasNotes && (
                          <span title={c.collection_notes ?? ""}>
                            <MessageSquare className="w-3 h-3 text-brand-gray-mid shrink-0" />
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-brand-gray-mid whitespace-nowrap">{c.segment}</td>
                  <AgingCell value={c.ag0to30}  level="safe" />
                  <AgingCell value={c.ag31to60} level="warn" />
                  <AgingCell value={c.ag61to90} level="danger" />
                  <AgingCell value={c.ag90plus} level="critical" />
                  <td className="px-3 py-3 text-right font-semibold text-brand-black whitespace-nowrap">
                    {total > 0 ? fmtAmt(total) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-brand-gray-mid whitespace-nowrap">
                    <div>{fmtD(c.last_payment_date ?? null)}</div>
                    {c.last_payment_amount && (
                      <div className="text-[10px] text-green-600">{fmtAmt(c.last_payment_amount)}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          <tfoot>
            <tr className="border-t-2 border-border bg-brand-gray-light font-semibold">
              <td colSpan={2} className="px-3 py-2.5 text-xs text-brand-gray-mid uppercase tracking-wide">
                Total ({filtered.length} customers)
              </td>
              <AgingCell value={filtered.reduce((s, c) => s + c.ag0to30, 0)}   level="safe"     bold />
              <AgingCell value={filtered.reduce((s, c) => s + c.ag31to60, 0)}  level="warn"     bold />
              <AgingCell value={filtered.reduce((s, c) => s + c.ag61to90, 0)}  level="danger"   bold />
              <AgingCell value={filtered.reduce((s, c) => s + c.ag90plus, 0)}  level="critical" bold />
              <td className="px-3 py-2.5 text-right text-brand-black">
                {fmtAmt(filtered.reduce((s, c) => s + customerTotal(c), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SortTh({ label, sortKey, current, asc, onSort, align = "right" }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean;
  onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-medium text-brand-gray-mid whitespace-nowrap cursor-pointer hover:text-brand-black`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === "right" && <ArrowUpDown className={`w-3 h-3 ${current === sortKey ? "text-brand-red" : ""}`} />}
        {label}
        {align === "left"  && <ArrowUpDown className={`w-3 h-3 ${current === sortKey ? "text-brand-red" : ""}`} />}
      </span>
    </th>
  );
}

function AgingCell({ value, level, bold }: {
  value: number; level: "safe" | "warn" | "danger" | "critical"; bold?: boolean;
}) {
  const colorClass = value === 0 ? "text-brand-gray-mid/50"
    : level === "critical" ? "text-red-700 font-bold"
    : level === "danger"   ? "text-red-600"
    : level === "warn"     ? "text-amber-700"
    : "text-brand-black";

  return (
    <td className={`px-3 py-3 text-right whitespace-nowrap text-sm ${colorClass} ${bold ? "font-semibold" : ""}`}>
      {value > 0 ? fmtAmt(value) : "—"}
    </td>
  );
}
