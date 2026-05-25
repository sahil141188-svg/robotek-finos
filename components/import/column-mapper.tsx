"use client";

/**
 * ColumnMapper — Step 2 of the import wizard.
 * Shows the auto-detected column mapping and lets the user correct it.
 * Also shows the first 5 raw rows as a preview beneath the mapping.
 */

import { CheckCircle, AlertCircle, HelpCircle, AlertTriangle } from "lucide-react";
import type { ColumnMapping, RawRow } from "@/lib/import-utils";

const BASE_SCHEMA_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean; hint: string; skipModules?: string[] }[] = [
  { key: "transaction_date", label: "Transaction Date",  required: true,  hint: "Date of the voucher / transaction"                          },
  { key: "voucher_number",   label: "Voucher Number",    required: false, hint: "Voucher / Invoice / Bill number"                             },
  { key: "voucher_type",     label: "Voucher Type",      required: false, hint: "Sales, Purchase, Receipt, Payment…"                         },
  { key: "ledger_name",      label: "Ledger / Party",    required: true,  hint: "Name of the account or party", skipModules: ["compliance"]  },
  { key: "dr_amount",        label: "Debit Amount",      required: false, hint: "Debit column (leave blank if merged)"                        },
  { key: "cr_amount",        label: "Credit Amount",     required: false, hint: "Credit column (leave blank if merged)"                       },
  { key: "narration",        label: "Narration",         required: false, hint: "Description / remarks"                                       },
];

interface ColumnMapperProps {
  headers: string[];
  mapping: ColumnMapping;
  previewRows: RawRow[];
  onChange: (mapping: ColumnMapping) => void;
  /** Current import module — affects which fields are required (Bug #3). */
  module?: string;
  /** Explicit date format to use when parsing ambiguous date strings (Bug #4). */
  dateFormat?: string;
  /** Callback when user changes the date format selector. */
  onDateFormatChange?: (format: string) => void;
}

export function ColumnMapper({
  headers,
  mapping,
  previewRows,
  onChange,
  module = "transactions",
  dateFormat = "DD-MM-YYYY",
  onDateFormatChange,
}: ColumnMapperProps) {
  const NONE = "__none__";

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onChange({ ...mapping, [field]: value === NONE ? null : value });
  };

  // Bug #3 fix: compute required flag per-row taking module into account
  const SCHEMA_FIELDS = BASE_SCHEMA_FIELDS.map((f) => ({
    ...f,
    required: f.required && !(f.skipModules?.includes(module)),
  }));

  const mapped = Object.values(mapping).filter(Boolean).length;
  const total  = SCHEMA_FIELDS.length;

  return (
    <div className="space-y-5">
      {/* Bug #4 fix: Date format selector */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
        <span className="text-xs font-medium text-blue-900 shrink-0">Date format in your file:</span>
        <select
          value={dateFormat}
          onChange={(e) => onDateFormatChange?.(e.target.value)}
          className="text-xs border border-blue-300 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red text-brand-black"
        >
          <option value="DD-MM-YYYY">DD-MM-YYYY — Indian / Busy (01-04-2025)</option>
          <option value="MM-DD-YYYY">MM-DD-YYYY — US format (04-01-2025)</option>
          <option value="auto">Auto-detect</option>
        </select>
        <span className="text-[10px] text-blue-700 ml-auto shrink-0">Busy exports use DD-MM-YYYY</span>
      </div>
      {/* Status bar */}
      <div className="flex items-center gap-3 bg-brand-gray-light rounded-xl px-4 py-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-brand-black">
            {mapped} of {total} columns mapped
            {mapped >= 3 && (
              <span className="ml-2 text-green-600">· Minimum requirements met</span>
            )}
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${(mapped / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-gray-mid shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          Auto-detected from Busy format
        </div>
      </div>

      {/* ⚠️ Critical warning: both amount columns unmapped → all rows will fail */}
      {!mapping.dr_amount && !mapping.cr_amount && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            <strong>No amount column mapped — all rows will fail validation.</strong>
            {" "}Map your file&apos;s amount column to <strong>Debit Amount</strong> or{" "}
            <strong>Credit Amount</strong> in the table below. Common Busy column names:{" "}
            <span className="font-mono bg-red-100 px-1 rounded">Amount</span>,{" "}
            <span className="font-mono bg-red-100 px-1 rounded">Debit</span>,{" "}
            <span className="font-mono bg-red-100 px-1 rounded">Credit</span>,{" "}
            <span className="font-mono bg-red-100 px-1 rounded">Net Amount</span>.
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-gray-light/60">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-brand-gray-mid w-1/3">
                Schema Field
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-brand-gray-mid w-1/3">
                Your File Column
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-brand-gray-mid">
                Sample Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SCHEMA_FIELDS.map(({ key, label, required, hint }) => {
              const selectedCol = mapping[key];
              const sampleVal = selectedCol && previewRows[0] ? previewRows[0][selectedCol] : null;
              const isMapped = Boolean(selectedCol);

              return (
                <tr key={key} className="hover:bg-brand-gray-light/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isMapped ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : required ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-brand-gray-mid shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-brand-black">{label}</p>
                        <p className="text-[10px] text-brand-gray-mid">{hint}</p>
                      </div>
                      {required && (
                        <span className="text-[10px] text-red-500 font-medium ml-auto shrink-0">required</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedCol ?? NONE}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white
                                 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red
                                 text-brand-black"
                    >
                      <option value={NONE}>— not mapped —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-brand-gray-mid font-mono">
                      {sampleVal !== null && sampleVal !== undefined
                        ? String(sampleVal).slice(0, 40)
                        : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Raw preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-brand-gray-light border-b border-border">
          <p className="text-xs font-medium text-brand-black">
            Raw File Preview — first {previewRows.length} rows
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-gray-light/40">
              <tr>
                {headers.slice(0, 8).map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 font-medium text-brand-gray-mid whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                {headers.length > 8 && (
                  <th className="text-left px-3 py-2 text-brand-gray-mid">
                    +{headers.length - 8} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.slice(0, 5).map((row, i) => (
                <tr key={i} className="hover:bg-brand-gray-light/20">
                  {headers.slice(0, 8).map((h) => (
                    <td
                      key={h}
                      className="px-3 py-2 text-brand-black whitespace-nowrap max-w-[160px] truncate"
                    >
                      {row[h] != null ? String(row[h]) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
