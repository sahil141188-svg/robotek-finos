"use client";

/**
 * VendorTable — sortable/filterable AP vendor list with aging columns.
 * RULE 1: Every vendor name is clickable → /dashboard/payables/[vendorId]
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import {
  SAMPLE_VENDORS, vendorTotal, vendorOverdue, fmtAmt, fmtD,
  type SampleVendor,
} from "@/lib/payables-data";

type SortKey = "name" | "total" | "overdue" | "ag0to30" | "ag31to60" | "ag61to90" | "ag90plus";
type Filter  = "All" | "Overdue" | "Critical";

interface Props {
  vendors: SampleVendor[];
}

export function VendorTable({ vendors }: Props) {
  const [filter, setFilter]     = useState<Filter>("All");
  const [sortKey, setSortKey]   = useState<SortKey>("overdue");
  const [sortAsc, setSortAsc]   = useState(false);

  const filtered = useMemo(() => {
    let list = vendors;
    if (filter === "Overdue")  list = list.filter((v) => vendorOverdue(v) > 0);
    if (filter === "Critical") list = list.filter((v) => v.ag90plus > 0 || v.ag61to90 > 0);
    return [...list].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "name")    { return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      if (sortKey === "total")   { av = vendorTotal(a);  bv = vendorTotal(b); }
      if (sortKey === "overdue") { av = vendorOverdue(a); bv = vendorOverdue(b); }
      if (sortKey === "ag0to30")   { av = a.ag0to30;   bv = b.ag0to30; }
      if (sortKey === "ag31to60")  { av = a.ag31to60;  bv = b.ag31to60; }
      if (sortKey === "ag61to90")  { av = a.ag61to90;  bv = b.ag61to90; }
      if (sortKey === "ag90plus")  { av = a.ag90plus;  bv = b.ag90plus; }
      return sortAsc ? av - bv : bv - av;
    });
  }, [vendors, filter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filterCounts = {
    All:      vendors.length,
    Overdue:  vendors.filter((v) => vendorOverdue(v) > 0).length,
    Critical: vendors.filter((v) => v.ag90plus > 0 || v.ag61to90 > 0).length,
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-brand-gray-light">
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
        <span className="ml-auto text-xs text-brand-gray-mid">{filtered.length} vendors</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/60">
              <SortTh label="Vendor" sortKey="name"    current={sortKey} asc={sortAsc} onSort={toggleSort} align="left" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-brand-gray-mid whitespace-nowrap">Category</th>
              <SortTh label="0–30 Days"  sortKey="ag0to30"  current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="31–60 Days" sortKey="ag31to60" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="61–90 Days" sortKey="ag61to90" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="90+ Days"   sortKey="ag90plus" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="Total"      sortKey="total"    current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-right text-xs font-medium text-brand-gray-mid whitespace-nowrap">Last Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((v) => {
              const total   = vendorTotal(v);
              const overdue = vendorOverdue(v);
              const isCritical = v.ag90plus > 0;
              const isOverdue  = v.ag31to60 > 0 || v.ag61to90 > 0;

              return (
                <tr key={v.id} className={`hover:bg-brand-gray-light/40 transition-colors ${isCritical ? "bg-red-50/40" : isOverdue ? "bg-amber-50/30" : ""}`}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {(isCritical || isOverdue) && (
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isCritical ? "text-red-500" : "text-amber-500"}`} />
                      )}
                      <Link
                        href={`/dashboard/payables/${v.id}`}
                        className="font-medium text-brand-black hover:text-brand-red transition-colors"
                      >
                        {v.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-brand-gray-mid whitespace-nowrap">{v.category}</td>
                  <AgingCell value={v.ag0to30}  level="safe" />
                  <AgingCell value={v.ag31to60} level="warn" />
                  <AgingCell value={v.ag61to90} level="danger" />
                  <AgingCell value={v.ag90plus} level="critical" />
                  <td className="px-3 py-3 text-right font-semibold text-brand-black whitespace-nowrap">
                    {total > 0 ? fmtAmt(total) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-brand-gray-mid whitespace-nowrap">
                    <div>{fmtD(v.last_payment_date)}</div>
                    {v.last_payment_amount && (
                      <div className="text-[10px] text-green-600">{fmtAmt(v.last_payment_amount)}</div>
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
                Total ({filtered.length} vendors)
              </td>
              <AgingCell value={filtered.reduce((s, v) => s + v.ag0to30, 0)}   level="safe"     bold />
              <AgingCell value={filtered.reduce((s, v) => s + v.ag31to60, 0)}  level="warn"     bold />
              <AgingCell value={filtered.reduce((s, v) => s + v.ag61to90, 0)}  level="danger"   bold />
              <AgingCell value={filtered.reduce((s, v) => s + v.ag90plus, 0)}  level="critical" bold />
              <td className="px-3 py-2.5 text-right text-brand-black">
                {fmtAmt(filtered.reduce((s, v) => s + vendorTotal(v), 0))}
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
    <th className={`px-3 py-2.5 text-${align} text-xs font-medium text-brand-gray-mid whitespace-nowrap cursor-pointer hover:text-brand-black`}
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {align === "right" && <ArrowUpDown className={`w-3 h-3 ${current === sortKey ? "text-brand-red" : ""}`} />}
        {label}
        {align === "left" && <ArrowUpDown className={`w-3 h-3 ${current === sortKey ? "text-brand-red" : ""}`} />}
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
