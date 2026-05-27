/**
 * Customer 360 — group-level customer directory.
 *
 * Shows every unique customer across the group with their outstanding
 * per company AND combined total. Designed for payment follow-up:
 * when you call "Sunny Mobile Accessories" you immediately see they
 * owe ₹3L to Robotek AND ₹2L to Aggarwal = ₹5L total.
 *
 * Customers trading with multiple group companies float to the top.
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { fetchCrossCompanyParties } from "@/lib/supabase/cross-company-parties";
import { CustomerCRMTable } from "@/components/crm/customer-crm-table";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();
  const rows     = await fetchCrossCompanyParties(supabase, "customer");

  // Pull the list of active companies (for the column headers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companiesData } = await (supabase as any)
    .from("companies")
    .select("id, short_name, color_class")
    .eq("status", "active")
    .order("sort_order");
  const companies = (companiesData ?? []) as Array<{ id: string; short_name: string; color_class: string }>;

  const multiCompany   = rows.filter((r) => r.companiesCount > 1);
  const totalRows      = rows.length;
  const totalOutstanding = rows.reduce((s, r) => s + r.totalOutstanding, 0);
  const totalOverdue     = rows.reduce((s, r) => s + r.totalOverdue, 0);

  return (
    <>
      <Header
        title="Customers — Group 360°"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Customers (Group)" }]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-5 max-w-7xl">
        {/* Top tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={<Users className="w-5 h-5 text-brand-red" />}
            label="Unique customers"
            value={String(totalRows)}
            sub={`across ${companies.length} group companies`} />
          <KpiTile icon={<Users className="w-5 h-5 text-amber-600" />}
            label="Multi-company customers"
            value={String(multiCompany.length)}
            sub="trading with ≥ 2 group entities" />
          <KpiTile icon={<Users className="w-5 h-5 text-blue-600" />}
            label="Group AR"
            value={fmtAmt(totalOutstanding)}
            sub="total outstanding" />
          <KpiTile icon={<Users className="w-5 h-5 text-red-600" />}
            label="Group AR overdue"
            value={fmtAmt(totalOverdue)}
            sub={totalOutstanding > 0 ? `${Math.round((totalOverdue/totalOutstanding)*100)}% of outstanding` : "—"}
            valueClass="text-red-700" />
        </div>

        {totalRows === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center">
            <p className="text-sm font-semibold text-brand-black">No customer AR across the group.</p>
            <p className="text-xs text-brand-gray-mid mt-1">Import sales / day-book data to populate.</p>
          </div>
        ) : (
          <CustomerCRMTable rows={rows} companies={companies} />
        )}

        <div className="bg-brand-gray-light/40 rounded-xl border border-border p-4 text-[11px] text-brand-gray-mid leading-relaxed">
          <p className="font-semibold text-brand-black mb-1">How matching works</p>
          <p>
            Customers are merged across companies by a case-insensitive,
            punctuation-stripped name match (also strips Pvt Ltd / LLP / our
            "(Yuval)" suffix workaround). If you spot a row that should be
            split (different real entities with similar names) or merged (same
            entity stored under slightly different names), tell me and I'll
            tighten the rule.
          </p>
        </div>
      </main>
    </>
  );
}

function KpiTile({ icon, label, value, sub, valueClass = "text-brand-black" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center gap-2">{icon}<p className="text-xs font-medium text-brand-gray-mid">{label}</p></div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid truncate">{sub}</p>
    </div>
  );
}

// Server-component-friendly amount formatter (mirrors lib/payables-data.fmtAmt)
function fmtAmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
