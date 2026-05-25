"use client";

/**
 * ValidationSummary — Step 3 of the import wizard.
 * Shows the outcome of row validation:
 *   - Error count (will be skipped)
 *   - Warning count (will be imported with flags)
 *   - Duplicate voucher numbers detected in this file
 *   - The first 20 mapped rows as a preview of what will be imported
 */

import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import type { ValidationResult, MappedRow } from "@/lib/import-utils";

interface ValidationSummaryProps {
  result: ValidationResult;
  totalRows: number;
  fileName: string;
}

export function ValidationSummary({ result, totalRows, fileName }: ValidationSummaryProps) {
  const { valid, errors, warnings, duplicates } = result;

  // Auto-expand error list when there are 0 valid rows so the user immediately
  // sees WHY everything failed (e.g. "Both debit and credit are zero") instead
  // of having to manually click the collapsed error panel.
  const [showErrors, setShowErrors] = useState(valid.length === 0 && errors.length > 0);
  const [showPreview, setShowPreview] = useState(valid.length > 0);
  const willImport  = valid.length;
  const willSkip    = errors.length;
  const withWarning = warnings.length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          bg="bg-green-50 border-green-200"
          label="Will Import"
          value={willImport}
          sub="valid rows"
        />
        <SummaryCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          bg={willSkip > 0 ? "bg-red-50 border-red-200" : "bg-brand-gray-light border-border"}
          label="Will Skip"
          value={willSkip}
          sub="error rows"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          bg={withWarning > 0 ? "bg-amber-50 border-amber-200" : "bg-brand-gray-light border-border"}
          label="Warnings"
          value={withWarning}
          sub="rows with flags"
        />
        <SummaryCard
          icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
          bg={duplicates.length > 0 ? "bg-blue-50 border-blue-200" : "bg-brand-gray-light border-border"}
          label="In-File Dupes"
          value={duplicates.length}
          sub="voucher numbers"
        />
      </div>

      {/* Source file info */}
      <div className="rounded-xl border border-border bg-white px-4 py-3 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-brand-gray-mid shrink-0" />
        <p className="text-xs text-brand-gray-mid">
          <span className="font-medium text-brand-black">{fileName}</span> ·{" "}
          {totalRows} rows parsed · {willImport} will be written to the database
        </p>
      </div>

      {/* Diagnostic banner when ALL rows fail — show the specific reason */}
      {valid.length === 0 && errors.length > 0 && (() => {
        const firstError = errors[0];
        const isAmountError = errors.every((e) => e.field === "amount");
        const isLedgerError = errors.every((e) => e.field === "ledger_name");
        const isDateError   = errors.every((e) => e.field === "transaction_date");
        return (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 space-y-1">
              <p className="font-semibold">Why all {errors.length} rows failed:</p>
              {isAmountError && (
                <p>
                  <strong>No amount column is mapped.</strong> Go back to Step 2 and map your
                  file&apos;s amount column (e.g. &quot;Amount&quot;, &quot;Debit&quot;, &quot;Credit&quot;, &quot;Net Amount&quot;) to{" "}
                  <strong>Debit Amount</strong> or <strong>Credit Amount</strong>.
                </p>
              )}
              {isLedgerError && (
                <p>
                  <strong>Ledger / Party column is missing.</strong> Map the party or ledger
                  name column in Step 2.
                </p>
              )}
              {isDateError && (
                <p>
                  <strong>Date column could not be parsed.</strong> Go back to Step 2 and check
                  the Date Format setting matches your file (try &quot;DD-MM-YYYY&quot; for Busy exports).
                </p>
              )}
              {!isAmountError && !isLedgerError && !isDateError && (
                <p>First error: Row {firstError.row} — {firstError.message}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Errors collapsible */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between px-4 py-3 bg-brand-gray-light hover:bg-brand-gray-light/70 transition-colors text-left"
          >
            <p className="text-xs font-semibold text-brand-black">
              {errors.length} error{errors.length !== 1 ? "s" : ""}
              {warnings.length > 0 &&
                ` · ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`}
              {" — "}
              <span className="font-normal text-brand-gray-mid">
                rows with errors will be skipped; warnings will still import
              </span>
            </p>
            {showErrors ? (
              <ChevronUp className="w-4 h-4 text-brand-gray-mid" />
            ) : (
              <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
            )}
          </button>

          {showErrors && (
            <div className="divide-y divide-border max-h-56 overflow-y-auto">
              {[...errors, ...warnings].slice(0, 50).map((e, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-2.5 ${
                    e.severity === "error" ? "bg-red-50/50" : "bg-amber-50/50"
                  }`}
                >
                  {e.severity === "error" ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <p className="text-xs text-brand-black">
                    <span className="font-medium">Row {e.row}</span>
                    {" · "}
                    <span className="text-brand-gray-mid">{e.field}</span>
                    {" — "}
                    {e.message}
                  </p>
                </div>
              ))}
              {errors.length + warnings.length > 50 && (
                <div className="px-4 py-2.5 text-xs text-brand-gray-mid">
                  +{errors.length + warnings.length - 50} more…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview of valid rows */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between px-4 py-3 bg-brand-gray-light hover:bg-brand-gray-light/70 transition-colors text-left"
        >
          <p className="text-xs font-semibold text-brand-black">
            Preview — first 20 rows that will be imported
          </p>
          {showPreview ? (
            <ChevronUp className="w-4 h-4 text-brand-gray-mid" />
          ) : (
            <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
          )}
        </button>

        {showPreview && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-brand-gray-light/40">
                <tr>
                  {["Date", "Voucher No", "Type", "Ledger / Party", "DR ₹", "CR ₹", "FY"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2 font-medium text-brand-gray-mid whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {valid.slice(0, 20).map((row: MappedRow, i: number) => (
                  <tr key={i} className="hover:bg-brand-gray-light/20">
                    <td className="px-4 py-2 whitespace-nowrap">{row.transaction_date}</td>
                    <td className="px-4 py-2 font-mono">{row.voucher_number ?? "—"}</td>
                    <td className="px-4 py-2">{row.voucher_type}</td>
                    <td className="px-4 py-2 max-w-[160px] truncate">{row.ledger_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.dr_amount > 0 ? row.dr_amount.toFixed(2) : ""}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-600">
                      {row.cr_amount > 0 ? row.cr_amount.toFixed(2) : ""}
                    </td>
                    <td className="px-4 py-2 text-brand-gray-mid">{row.financial_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {valid.length > 20 && (
              <p className="px-4 py-2.5 text-xs text-brand-gray-mid border-t border-border">
                +{valid.length - 20} more rows will be imported…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  bg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${bg}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-brand-gray-mid">{label}</span>
      </div>
      <p className="text-2xl font-bold text-brand-black tabular-nums">{value}</p>
      <p className="text-[10px] text-brand-gray-mid">{sub}</p>
    </div>
  );
}
