import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Upload, FileSpreadsheet, FileText, Info } from "lucide-react";

export default async function ImportPage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Import / Update Data"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Import Data" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <Info className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Data Import Engine — coming on Day 3</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Upload Busy Accounting Software exports (.xlsx, .xls, .csv) or scanned PDFs.
              The engine auto-detects column structure, previews the mapping, detects duplicates,
              and rolls back within 24 hours if needed.
            </p>
          </div>
        </div>

        {/* Supported formats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: FileSpreadsheet, label: "Excel / CSV", desc: ".xlsx · .xls · .csv", color: "bg-green-50 text-green-700" },
            { icon: FileText,        label: "PDF (Digital)", desc: "Digital PDF exports", color: "bg-blue-50 text-blue-700" },
            { icon: FileText,        label: "PDF (Scanned)", desc: "OCR for scanned bills", color: "bg-purple-50 text-purple-700" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm text-brand-black">{label}</p>
                <p className="text-xs text-brand-gray-mid">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Drop zone placeholder */}
        <div className="rounded-xl border-2 border-dashed border-border bg-white p-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-xl bg-brand-red/10 flex items-center justify-center">
            <Upload className="w-7 h-7 text-brand-red" />
          </div>
          <p className="text-sm font-medium text-brand-black">Drop your Busy export file here</p>
          <p className="text-xs text-brand-gray-mid">Full import engine with preview + duplicate detection ships on Day 3</p>
        </div>

      </main>
    </>
  );
}
