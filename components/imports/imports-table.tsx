"use client";

/**
 * ImportsTable — interactive table for /dashboard/imports.
 *
 * Shows all file imports with delete confirmation dialog.
 * Calls deleteImport() server action on confirmation.
 */

import { useState, useTransition } from "react";
import { deleteImport } from "@/app/actions/imports";
import type { ImportRecord } from "@/app/actions/imports";
import {
  Trash2, FileText, FileSpreadsheet, AlertTriangle,
  CheckCircle2, Clock, XCircle, ChevronRight,
} from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  bank_statement:  "Bank Statement",
  banking:         "Bank Statement",   // legacy alias
  transactions:    "Transactions",
  payables:        "Payables",
  receivables:     "Receivables",
  compliance:      "Compliance",
};

const MODULE_HREF: Record<string, string> = {
  bank_statement: "/dashboard/banking",
  banking:        "/dashboard/banking",  // legacy alias
  transactions:   "/dashboard",
  payables:       "/dashboard/payables",
  receivables:    "/dashboard/receivables",
  compliance:     "/dashboard/compliance",
};

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

interface Props {
  imports: ImportRecord[];
}

export function ImportsTable({ imports }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmRecord = imports.find((i) => i.id === confirmId);

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
      } catch (err: any) {
        setError(err.message || "Failed to delete import");
      } finally {
        setDeletingId(null);
      }
    });
  }

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

      {/* Table */}
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
            {imports.map((imp) => {
              const isDeleting = deletingId === imp.id;
              const href = MODULE_HREF[imp.module] ?? "/dashboard";
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
                      href={href}
                      className="inline-flex items-center gap-1 text-brand-red hover:underline"
                    >
                      {MODULE_LABELS[imp.module] ?? imp.module}
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

      {/* Confirmation dialog */}
      {confirmId && confirmRecord && (
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
                <span className="font-medium">{MODULE_LABELS[confirmRecord.module] ?? confirmRecord.module}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-mid">Rows</span>
                <span className="font-medium">{confirmRecord.rows_imported.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {confirmRecord.module === "bank_statement"
                ? "All bank accounts and transactions from this import will be permanently deleted."
                : "All transactions linked to this import will be permanently deleted."}
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
      )}
    </>
  );
}
