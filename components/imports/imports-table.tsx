"use client";

/**
 * ImportsTable — interactive table for /dashboard/imports.
 *
 * Shows all file imports with:
 *   - Module filter tabs (All / Transactions / Payables / Receivables / Bank / Compliance)
 *   - Per-row delete with confirmation dialog
 *   - Module-specific delete warning text
 * Calls deleteImport() server action on confirmation.
 */

import { useState, useTransition } from "react";
import { deleteImport } from "@/app/actions/imports";
import type { ImportRecord } from "@/app/actions/imports";
import {
  Trash2, FileText, FileSpreadsheet, AlertTriangle,
  CheckCircle2, Clock, XCircle, ChevronRight,
} from "lucide-react";

// ─── Module metadata ──────────────────────────────────────────────────────────

const MODULE_META: Record<string, { label: string; href: string; icon: string; deleteMsg: string }> = {
  bank_statement: {
    label:     "Bank Statement",
    href:      "/dashboard/banking",
    icon:      "🏦",
    deleteMsg: "All bank accounts and bank transactions from this import will be permanently deleted.",
  },
  banking: {
    label:     "Bank Statement",
    href:      "/dashboard/banking",
    icon:      "🏦",
    deleteMsg: "All bank accounts and bank transactions from this import will be permanently deleted.",
  },
  transactions: {
    label:     "Sales / Purchase",
    href:      "/dashboard",
    icon:      "📒",
    deleteMsg: "All sales and purchase vouchers from this import will be permanently deleted.",
  },
  payables: {
    label:     "Accounts Payable",
    href:      "/dashboard/payables",
    icon:      "📤",
    deleteMsg: "All vendor payable records from this import will be permanently deleted.",
  },
  receivables: {
    label:     "Accounts Receivable",
    href:      "/dashboard/receivables",
    icon:      "📥",
    deleteMsg: "All customer receivable records from this import will be permanently deleted.",
  },
  compliance: {
    label:     "Compliance / Tax",
    href:      "/dashboard/compliance",
    icon:      "📋",
    deleteMsg: "All compliance / tax payment records from this import will be permanently deleted.",
  },
};

function getMeta(module: string) {
  return MODULE_META[module] ?? {
    label:     module,
    href:      "/dashboard",
    icon:      "📄",
    deleteMsg: "All data from this import will be permanently deleted.",
  };
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all",          label: "All" },
  { key: "transactions", label: "Sales / Purchase" },
  { key: "payables",     label: "Payables" },
  { key: "receivables",  label: "Receivables" },
  { key: "banking",      label: "Bank" },       // matches both "banking" and "bank_statement"
  { key: "compliance",   label: "Compliance" },
] as const;

type FilterKey = typeof FILTER_TABS[number]["key"];

function matchesFilter(imp: ImportRecord, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "banking") return imp.module === "banking" || imp.module === "bank_statement";
  return imp.module === filter;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Done
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
      <Clock className="w-3 h-3" /> {status}
    </span>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type === "pdf") return <FileText className="w-4 h-4 text-red-500" />;
  return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  imports: ImportRecord[];
}

export function ImportsTable({ imports }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const confirmRecord = imports.find((i) => i.id === confirmId);
  const filtered      = imports.filter((i) => matchesFilter(i, activeFilter));

  function handleDeleteClick(id: string) {
    setConfirmId(id);
    setError(null);
  }

  function handleConfirm() {
    if (!confirmId) return;
    setDeletingId(confirmId);
    setConfirmId(null);

    startTransition(async () => {
      try {
        await deleteImport(confirmId);
      } catch (err: unknown) {
        setError((err as Error).message || "Failed to delete import");
      } finally {
        setDeletingId(null);
      }
    });
  }

  // Count per filter tab (excluding "all")
  const countFor = (key: FilterKey) => imports.filter((i) => matchesFilter(i, key)).length;

  return (
    <>
      {/* Error toast */}
      {error && (
        <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-5 pt-4 pb-0 flex items-center gap-1 flex-wrap border-b border-border">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === "all" ? imports.length : countFor(tab.key);
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-brand-red text-brand-red"
                  : "border-transparent text-brand-gray-mid hover:text-brand-black"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? "bg-brand-red/10 text-brand-red" : "bg-brand-gray-light text-brand-gray-mid"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center text-xs text-brand-gray-mid">
          No imports found for this module yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-brand-gray-mid font-medium">File</th>
                <th className="text-left px-3 py-3 text-brand-gray-mid font-medium">Module</th>
                <th className="text-left px-3 py-3 text-brand-gray-mid font-medium hidden sm:table-cell">Uploaded</th>
                <th className="text-left px-3 py-3 text-brand-gray-mid font-medium hidden sm:table-cell">By</th>
                <th className="text-right px-3 py-3 text-brand-gray-mid font-medium">Rows</th>
                <th className="text-center px-3 py-3 text-brand-gray-mid font-medium">Status</th>
                <th className="text-center px-3 py-3 text-brand-gray-mid font-medium">FY</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((imp) => {
                const isDeleting = deletingId === imp.id;
                const meta = getMeta(imp.module);
                return (
                  <tr
                    key={imp.id}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isDeleting ? "opacity-40 pointer-events-none" : "hover:bg-brand-gray-light/40"
                    }`}
                  >
                    {/* File name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileIcon type={imp.file_type} />
                        <span className="font-medium text-brand-black truncate max-w-[180px]" title={imp.file_name}>
                          {imp.file_name}
                        </span>
                      </div>
                    </td>

                    {/* Module */}
                    <td className="px-3 py-3">
                      <a
                        href={meta.href}
                        className="inline-flex items-center gap-1 text-brand-red hover:underline"
                      >
                        <span>{meta.icon}</span>
                        {meta.label}
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 text-brand-gray-mid hidden sm:table-cell">
                      {new Date(imp.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                      {" "}
                      {new Date(imp.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>

                    {/* Uploader */}
                    <td className="px-3 py-3 text-brand-gray-mid hidden sm:table-cell">
                      {imp.uploader_name}
                    </td>

                    {/* Rows */}
                    <td className="px-3 py-3 text-right font-semibold text-brand-black">
                      {imp.rows_imported.toLocaleString("en-IN")}
                      {imp.rows_failed > 0 && (
                        <span className="text-red-500 ml-1">(-{imp.rows_failed})</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={imp.status} />
                    </td>

                    {/* FY */}
                    <td className="px-3 py-3 text-center text-brand-gray-mid">
                      {imp.financial_year}
                    </td>

                    {/* Delete */}
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDeleteClick(imp.id)}
                        disabled={isDeleting || isPending}
                        title="Delete this import"
                        className="p-1.5 rounded-lg text-brand-gray-mid hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmId && confirmRecord && (() => {
        const meta = getMeta(confirmRecord.module);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-brand-black">Delete this import?</p>
                  <p className="text-xs text-brand-gray-mid mt-0.5">This cannot be undone</p>
                </div>
              </div>

              <div className="bg-brand-gray-light rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-brand-gray-mid">File</span>
                  <span className="font-medium text-brand-black truncate max-w-[220px]">{confirmRecord.file_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-mid">Module</span>
                  <span className="font-medium">{meta.icon} {meta.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-mid">Rows imported</span>
                  <span className="font-medium">{confirmRecord.rows_imported.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-mid">Financial year</span>
                  <span className="font-medium">{confirmRecord.financial_year}</span>
                </div>
              </div>

              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                ⚠️ {meta.deleteMsg}
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmId(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-border text-sm font-medium text-brand-black hover:bg-brand-gray-light transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
