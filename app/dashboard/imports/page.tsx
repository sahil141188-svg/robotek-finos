/**
 * Imports Manager — /dashboard/imports
 *
 * Shows every file ever uploaded to FinOS: file name, module, date,
 * uploader, rows, status. CEO/CFO/Accounts can delete any import
 * (bank statements + related accounts/transactions are removed too).
 * RULE 1: Clicking a row will link to the relevant module dashboard.
 */

import { Header } from "@/components/layout/header";
import { getAllImports } from "@/app/actions/imports";
import { ImportsTable } from "@/components/imports/imports-table";
import { Upload } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const imports = await getAllImports();

  return (
    <>
      <Header
        title="Imported Data"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Imported Data" },
        ]}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-5xl">

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total Imports" value={imports.length} />
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
          <StatTile
            label="Rows Imported"
            value={imports.reduce((s, i) => s + (i.rows_imported || 0), 0).toLocaleString("en-IN")}
          />
        </div>

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
              <span className="text-xs text-brand-gray-mid">{imports.length} records</span>
            </div>
            <ImportsTable imports={imports} />
          </div>
        )}

        <p className="text-xs text-brand-gray-mid">
          ⚠️ Deleting an import permanently removes all associated data (bank accounts, transactions, etc.).
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
