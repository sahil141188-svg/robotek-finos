"use client";

/**
 * CustomerCRMTable — group-level customer list.
 *
 * One row per unique customer. A column per group company shows
 * outstanding (with overdue chip when 31+ days). Total column on the
 * right. Search, sort (by total / overdue / # companies), and a
 * "Multi-company only" toggle to surface CRM-priority rows.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtAmt } from "@/lib/payables-data";
import type { CrossCompanyPartyRow } from "@/lib/supabase/cross-company-parties";
import { Search, X, Phone, Mail, ArrowUpDown, Building2 } from "lucide-react";

interface Props {
  rows: CrossCompanyPartyRow[];
  companies: Array<{ id: string; short_name: string; color_class: string }>;
}

type SortKey = "total" | "overdue" | "companies" | "name";

export function CustomerCRMTable({ rows, companies }: Props) {
  const [search, setSearch]         = useState("");
  const [multiOnly, setMultiOnly]   = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey]       = useState<SortKey>("companies");
  const [sortAsc, setSortAsc]       = useState(false);

  const filtered = useMemo(() => {
    let list = rows;
    if (multiOnly)   list = list.filter((r) => r.companiesCount > 1);
    if (overdueOnly) list = list.filter((r) => r.totalOverdue > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) =>
      r.displayName.toLowerCase().includes(q) ||
      (r.bestPhone ?? "").toLowerCase().includes(q) ||
      (r.bestEmail ?? "").toLowerCase().includes(q) ||
      r.perCompany.some((p) => p.partyName.toLowerCase().includes(q))
    );
    return [...list].sort((a, b) => {
      if (sortKey === "name") return sortAsc ? a.displayName.localeCompare(b.displayName) : b.displayName.localeCompare(a.displayName);
      let av = 0, bv = 0;
      if (sortKey === "total")     { av = a.totalOutstanding; bv = b.totalOutstanding; }
      if (sortKey === "overdue")   { av = a.totalOverdue;     bv = b.totalOverdue;     }
      if (sortKey === "companies") {
        av = a.companiesCount * 1e15 + a.totalOutstanding;
        bv = b.companiesCount * 1e15 + b.totalOutstanding;
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [rows, search, multiOnly, overdueOnly, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-brand-gray-light">
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gray-mid cursor-pointer">
          <input type="checkbox" checked={multiOnly} onChange={(e) => setMultiOnly(e.target.checked)} className="rounded" />
          Multi-company only
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gray-mid cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded" />
          Overdue only
        </label>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-brand-gray-mid absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer / phone / email…"
            className="w-full text-xs border border-border rounded-lg pl-8 pr-7 py-1.5 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-brand-gray-mid">{filtered.length} customers</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand-gray-light/95 z-10">
            <tr className="border-b border-border text-xs text-brand-gray-mid">
              <SortTh label="Customer (firm)" k="name" current={sortKey} asc={sortAsc} onSort={toggleSort} align="left" wide />
              <th className="px-3 py-2.5 text-left font-medium w-44">Contact</th>
              {companies.map((c) => (
                <th key={c.id} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  <div className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${c.color_class}`} />
                  {c.short_name}
                </th>
              ))}
              <SortTh label="Group total" k="total" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="Overdue" k="overdue" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="# Cos" k="companies" current={sortKey} asc={sortAsc} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.normalisedName} className={`hover:bg-brand-gray-light/40 ${r.companiesCount > 1 ? "bg-amber-50/30" : ""}`}>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-brand-black">{r.displayName}</div>
                  {r.companiesCount > 1 && (
                    <div className="text-[10px] text-amber-700 inline-flex items-center gap-1 mt-0.5">
                      <Building2 className="w-2.5 h-2.5" /> in {r.companiesCount} group companies
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="space-y-0.5">
                    {r.bestPhone ? (
                      <div className="text-xs flex items-center gap-1 text-brand-black">
                        <Phone className="w-3 h-3 text-brand-gray-mid shrink-0" /> {r.bestPhone}
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-700">No phone</div>
                    )}
                    {r.bestEmail && (
                      <div className="text-[10px] text-brand-gray-mid inline-flex items-center gap-1 truncate max-w-[10rem]">
                        <Mail className="w-3 h-3 shrink-0" /> {r.bestEmail}
                      </div>
                    )}
                  </div>
                </td>
                {companies.map((c) => {
                  const entry = r.perCompany.find((p) => p.companyId === c.id);
                  if (!entry) {
                    return <td key={c.id} className="px-3 py-2.5 text-right text-brand-gray-mid/40 tabular-nums">—</td>;
                  }
                  return (
                    <td key={c.id} className="px-3 py-2.5 text-right tabular-nums">
                      <Link href={`/dashboard/receivables/${entry.partyId}`} className="hover:underline">
                        <div className="text-brand-black font-medium">{fmtAmt(entry.outstanding)}</div>
                        {entry.overdue > 0 && (
                          <div className="text-[10px] text-red-700">{fmtAmt(entry.overdue)} ovd · {entry.daysOverdue}d</div>
                        )}
                      </Link>
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-brand-black bg-brand-gray-light/40">
                  {fmtAmt(r.totalOutstanding)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.totalOverdue > 0
                    ? <span className="text-red-700 font-semibold">{fmtAmt(r.totalOverdue)}</span>
                    : <span className="text-brand-gray-mid">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`text-xs font-bold ${r.companiesCount > 1 ? "text-amber-700" : "text-brand-gray-mid"}`}>
                    {r.companiesCount}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={companies.length + 5} className="px-6 py-8 text-center text-xs text-brand-gray-mid">No customers match these filters.</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-brand-gray-light font-bold sticky bottom-0">
                <td className="px-3 py-2.5">Total ({filtered.length})</td>
                <td />
                {companies.map((c) => {
                  const colTotal = filtered.reduce((s, r) => s + (r.perCompany.find((p) => p.companyId === c.id)?.outstanding ?? 0), 0);
                  return <td key={c.id} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{colTotal > 0 ? fmtAmt(colTotal) : "—"}</td>;
                })}
                <td className="px-3 py-2.5 text-right tabular-nums text-brand-red whitespace-nowrap">
                  {fmtAmt(filtered.reduce((s, r) => s + r.totalOutstanding, 0))}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-700 whitespace-nowrap">
                  {fmtAmt(filtered.reduce((s, r) => s + r.totalOverdue, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function SortTh({ label, k, current, asc, onSort, align = "right", wide = false }: {
  label: string; k: SortKey; current: SortKey; asc: boolean;
  onSort: (k: SortKey) => void; align?: "left" | "right"; wide?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-${align} text-xs font-medium text-brand-gray-mid whitespace-nowrap cursor-pointer hover:text-brand-black ${wide ? "min-w-[14rem]" : ""}`}
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {align === "right" && <ArrowUpDown className={`w-3 h-3 ${current === k ? "text-brand-red" : ""}`} />}
        {label}
        {align === "left" && <ArrowUpDown className={`w-3 h-3 ${current === k ? "text-brand-red" : ""}`} />}
      </span>
    </th>
  );
}
