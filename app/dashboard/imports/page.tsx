/**
 * Imports Manager — /dashboard/imports
 *
 * Central place to view, audit, and delete every file imported into FinOS.
 * Supports all modules: Sales/Purchase, Payables, Receivables, Bank, Compliance.
 * CEO/CFO/Accounts can delete any import — associated data is removed too.
 */

import { Header } from "@/components/layout/header";
import { getAllImports } from "@/app/actions/imports";
import { ImportsTable } from "@/components/imports/imports-table";
import { Upload } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const imports = await getAllImports();

  // Per-module counts for summary tiles
  const bankCount        = imports.filter((i) => i.module === "banking" || i.module === "bank_statement").length;
  const txnCount         = imports.filter((i) => i.module === "transactions").length;
  const payablesCount    = imports.filter((i) => i.module === "payables").length;
  const receivablesCount = imports.filter((i) => i.module === "receivables").length;
  const complianceCount  = imports.filter((i) => i.module === "compliance").length;
  const totalRows        = imports.reduce((s, i) => s + (i.rows_imported || 0), 0);

  return (
    <>
      <Header
        title="Imported Data"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Imported Data" },
        ]}
        showImport
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-5xl">

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total Imports"     value={imports.length} />
          <StatTile label="Rows in Database"  value={totalRows.toLocaleString("en-IN")} />
          <StatTile
            label="Completed"
            value={imports.filter((i) => i.status === "completed").length}
            color="green"
          />
          <StatTile
            label="Failed"
            value={imports.filter((i) => i.status === "failed").length}
            color="red"
          />
        </div>

        {/* Module breakdown */}
        {imports.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <ModuleTile emoji="📒" label="Sales / Purchase" count={txnCount}         href="/dashboard" />
            <ModuleTile emoji="📤" label="Payables"         count={payablesCount}    href="/dashboard/payables" />
            <ModuleTile emoji="📥" label="Receivables"      count={receivablesCount} href="/dashboard/receivables" />
            <ModuleTile emoji="🏦" label="Bank"             count={bankCount}        href="/dashboard/banking" />
            <ModuleTile emoji="📋" label="Compliance"       count={complianceCount}  href="/dashboard/compliance" />
          </div>
        )}

        {/* Table or empty state */}
        {imports.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center space-y-3">
            <Upload className="w-10 h-10 text-brand-gray-mid mx-auto" />
            <p className="text-sm font-medium text-brand-black">No data imported yet</p>
            <p className="text-xs text-brand-gray-mid">
              Go to any module and click "Import / Update Data" to upload your first file.
            </p>
            <Link
              href="/dashboard/import"
              className="inline-block mt-2 px-4 py-2 bg-brand-red text-white text-xs rounded-lg font-medium hover:bg-brand-maroon transition-colors"
            >
              Go to Import
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">All Imports</h3>
              <Link
                href="/dashboard/import"
                className="text-xs text-brand-red hover:underline font-medium"
              >
                + Import new file
              </Link>
            </div>
            <ImportsTable imports={imports} />
          </div>
        )}

        <p className="text-xs text-brand-gray-mid">
          ⚠️ Deleting an import permanently removes all associated data.
          Bank imports remove bank accounts + all transactions. Other imports remove only the rows from that file.
          This action cannot be undone.
        </p>
      </main>
    </>
  );
}

function StatTile({
  label, value, color,
}: {
  label: string;
  value: string | number;
  color?: "green" | "red";
}) {
  const valueClass =
    color === "green" ? "text-green-700" :
    color === "red"   ? "text-red-600"   :
    "text-brand-black";

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-1">
      <p className="text-xs text-brand-gray-mid">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ModuleTile({
  emoji, label, count, href,
}: {
  emoji: string; label: string; count: number; href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-3 flex flex-col gap-0.5 transition-all ${
        count > 0
          ? "bg-white border-border hover:border-brand-red/40 hover:shadow-sm"
          : "bg-brand-gray-light/50 border-border opacity-60"
      }`}
    >
      <span className="text-xl">{emoji}</span>
      <p className="text-[11px] text-brand-gray-mid leading-tight">{label}</p>
      <p className="text-lg font-bold text-brand-black">{count}</p>
      <p className="text-[10px] text-brand-gray-mid">import{count !== 1 ? "s" : ""}</p>
    </Link>
  );
}
