/**
 * Imports & Duties — statutory + logistics cost tracker.
 *
 * Surfaces what's buried in the generic Expense Tracker:
 *   - Custom Duty paid per month
 *   - Input GST (claimable as ITC) vs Output GST (owed to govt)
 *     and the net liability per month
 *   - Freight / cargo / forwarding / clearing charges, with top vendors
 *   - TDS deducted
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { fetchDutiesSummary, type DutyCategory } from "@/lib/supabase/duties-queries";
import { fmtAmt } from "@/lib/payables-data";
import { Ship, Receipt, ArrowDownToLine, ArrowUpToLine, Percent, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<DutyCategory, { label: string; chip: string }> = {
  custom_duty: { label: "Custom Duty",  chip: "bg-amber-100 text-amber-800 border-amber-200" },
  input_gst:   { label: "Input GST",    chip: "bg-green-100 text-green-800 border-green-200" },
  output_gst:  { label: "Output GST",   chip: "bg-blue-100 text-blue-800 border-blue-200" },
  freight:     { label: "Freight",      chip: "bg-purple-100 text-purple-800 border-purple-200" },
  tds:         { label: "TDS",          chip: "bg-red-100 text-red-800 border-red-200" },
};

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function trendChip(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return "—";
  if (prev === 0) return "new";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs last`;
}

export default async function DutiesPage() {
  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const duties    = await fetchDutiesSummary(supabase, companyId);

  const isEmpty = duties.monthly.every((m) =>
    m.customDuty === 0 && m.freight === 0 && m.inputGst === 0 && m.outputGst === 0 && m.tds === 0
  );

  const maxMonth = Math.max(1, ...duties.monthly.map((m) =>
    Math.max(m.customDuty, m.freight, m.inputGst, m.outputGst, m.tds)
  ));

  return (
    <>
      <Header
        title="Imports & Duties"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Imports & Duties" }]}
        showImport
        importModule="transactions"
      />

      <main className="flex-1 p-6 space-y-5 max-w-6xl">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            icon={<Ship className="w-5 h-5 text-amber-600" />}
            label="Custom Duty MTD"
            value={fmtAmt(duties.customDutyMTD)}
            sub={trendChip(duties.customDutyMTD, duties.customDutyPrev)}
          />
          <KpiTile
            icon={<Truck className="w-5 h-5 text-purple-600" />}
            label="Freight & Cargo MTD"
            value={fmtAmt(duties.freightMTD)}
            sub={trendChip(duties.freightMTD, duties.freightPrev)}
          />
          <KpiTile
            icon={<ArrowDownToLine className="w-5 h-5 text-green-600" />}
            label="Input GST (ITC)"
            value={fmtAmt(duties.inputGstMTD)}
            sub={`claimable · ${trendChip(duties.inputGstMTD, duties.inputGstPrev)}`}
          />
          <KpiTile
            icon={<ArrowUpToLine className="w-5 h-5 text-blue-600" />}
            label="Output GST"
            value={fmtAmt(duties.outputGstMTD)}
            sub={`collected · ${trendChip(duties.outputGstMTD, duties.outputGstPrev)}`}
          />
          <KpiTile
            icon={<Percent className="w-5 h-5 text-brand-red" />}
            label="Net GST liability"
            value={fmtAmt(duties.netGstMTD)}
            sub={duties.netGstMTD >= 0 ? "owed to govt" : "refund due"}
            valueClass={duties.netGstMTD >= 0 ? "text-brand-black" : "text-green-700"}
          />
          <KpiTile
            icon={<Receipt className="w-5 h-5 text-red-600" />}
            label="TDS deducted"
            value={fmtAmt(duties.tdsMTD)}
            sub={trendChip(duties.tdsMTD, duties.tdsPrev)}
          />
        </div>

        {isEmpty && (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center">
            <p className="text-sm font-semibold text-brand-black">No import / duty entries found for this scope.</p>
            <p className="text-xs text-brand-gray-mid mt-1">
              Make sure the Day Book includes vouchers touching ledgers like Custom Duty Payable, CGST,
              SGST, IGST, Clearing Charge, Maersk, Godara, etc.
            </p>
          </div>
        )}

        {/* 6-month trend matrix */}
        {!isEmpty && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Monthly trend — last 6 months</h3>
              <p className="text-[11px] text-brand-gray-mid">All figures in INR</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-brand-gray-light/50 text-xs text-brand-gray-mid">
                    <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-brand-gray-light/50">Category</th>
                    {duties.monthly.map((m, i) => (
                      <th key={i} className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${i === duties.monthly.length - 1 ? "text-brand-red" : ""}`}>
                        {m.period.slice(0, 8)}{i === duties.monthly.length - 1 ? " ●" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Row label="Custom Duty"       cells={duties.monthly.map((m) => m.customDuty)} />
                  <Row label="Freight & Cargo"   cells={duties.monthly.map((m) => m.freight)} />
                  <Row label="Input GST (ITC)"   cells={duties.monthly.map((m) => m.inputGst)}  textClass="text-green-700" />
                  <Row label="Output GST"        cells={duties.monthly.map((m) => m.outputGst)} textClass="text-blue-700" />
                  <Row label="Net GST liability" cells={duties.monthly.map((m) => m.netGst)}   bold />
                  <Row label="TDS deducted"      cells={duties.monthly.map((m) => m.tds)}      textClass="text-red-700" />
                </tbody>
              </table>
            </div>

            {/* Visual bars */}
            <div className="px-5 py-4 border-t border-border bg-brand-gray-light/20 space-y-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-brand-gray-mid mb-1">Visual — Custom Duty + Freight</p>
              {duties.monthly.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-brand-gray-mid">{m.period.slice(0, 6)}</span>
                  <div className="flex-1 flex gap-1">
                    <div className="flex-1 h-2 bg-brand-gray-light rounded-full overflow-hidden" title="Custom Duty">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(m.customDuty / maxMonth) * 100}%` }} />
                    </div>
                    <div className="flex-1 h-2 bg-brand-gray-light rounded-full overflow-hidden" title="Freight">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${(m.freight / maxMonth) * 100}%` }} />
                    </div>
                  </div>
                  <span className="tabular-nums w-32 text-right text-[10px]">
                    <span className="text-amber-700">D: {fmtAmt(m.customDuty)}</span> ·
                    <span className="text-purple-700"> F: {fmtAmt(m.freight)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top freight vendors */}
        {duties.topFreightVendors.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-brand-black">Top freight / cargo vendors — current month</h3>
              <span className="text-[10px] text-brand-gray-mid">Maersk, Godara, ANKITA, etc.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-brand-gray-mid border-b border-border">
                    <th className="px-2 py-2 text-left font-medium">Vendor / Ledger</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                    <th className="px-2 py-2 text-right font-medium w-16">% of total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {duties.topFreightVendors.map((v) => {
                    const pct = duties.freightMTD > 0 ? Math.round((v.amount / duties.freightMTD) * 100) : 0;
                    return (
                      <tr key={v.vendor} className="hover:bg-brand-gray-light/40">
                        <td className="px-2 py-2.5 text-brand-black">{v.vendor}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-medium">{fmtAmt(v.amount)}</td>
                        <td className="px-2 py-2.5 text-right text-brand-gray-mid tabular-nums">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {duties.recent.length > 0 && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Recent duty / freight / GST transactions</h3>
              <span className="text-xs text-brand-gray-mid">latest {duties.recent.length}</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-brand-gray-light/95">
                  <tr className="text-left text-xs text-brand-gray-mid border-b border-border">
                    <th className="px-3 py-2 font-medium w-20">Date</th>
                    <th className="px-3 py-2 font-medium w-24">Vch No</th>
                    <th className="px-3 py-2 font-medium">Ledger</th>
                    <th className="px-3 py-2 font-medium w-28">Category</th>
                    <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {duties.recent.map((t, i) => (
                    <tr key={i} className="hover:bg-brand-gray-light/40">
                      <td className="px-3 py-2 text-xs text-brand-gray-mid">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-brand-gray-mid">{t.voucher_number ?? "—"}</td>
                      <td className="px-3 py-2 text-brand-black">{t.ledger_name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CATEGORY_META[t.category].chip}`}>
                          {CATEGORY_META[t.category].label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtAmt(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-brand-gray-light/40 rounded-xl border border-border p-4 text-[11px] text-brand-gray-mid leading-relaxed">
          <p className="font-semibold text-brand-black mb-1">How this is computed</p>
          <p>
            <strong>Custom Duty</strong>: any ledger matching <code>Custom Duty / Customs / Import Duty / BCD</code>.{" "}
            <strong>Input GST</strong>: DR side of CGST / SGST / IGST / UTGST ledgers (claimable as ITC).{" "}
            <strong>Output GST</strong>: CR side of the same ledgers + any &quot;GST Payable / Output GST&quot; ledger.{" "}
            <strong>Freight</strong>: ledgers matching <code>freight / cargo / forwarding / clearing / transportation / shipping</code>,
            plus known forwarders (Maersk, Godara, ANKITA, CMA CGM, Hapag, MSC, DHL, FedEx, etc.).
            Net GST liability = Output − Input.
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
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-brand-gray-mid truncate">{sub}</p>
    </div>
  );
}

function Row({ label, cells, bold, textClass }: {
  label: string; cells: number[]; bold?: boolean; textClass?: string;
}) {
  return (
    <tr className={`${bold ? "font-bold bg-brand-gray-light/40" : ""}`}>
      <td className="px-3 py-2 font-medium text-brand-black sticky left-0 bg-white">{label}</td>
      {cells.map((v, i) => (
        <td key={i} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${v > 0 ? (textClass ?? "text-brand-black") : "text-brand-gray-mid/40"}`}>
          {v !== 0 ? fmtAmt(v) : "—"}
        </td>
      ))}
    </tr>
  );
}
