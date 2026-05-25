/**
 * Consolidated Group Dashboard — All 10 Robotek Companies
 *
 * Shows group-level totals (revenue, AP, AR, cash, P&L, compliance)
 * plus a per-company comparison table. CEO and CFO only.
 */

import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getCompanies } from "@/app/actions/companies";
import { COMPANIES } from "@/lib/companies-data";
import { fmtAmt } from "@/lib/bank-data";
import {
  TrendingUp, TrendingDown, Wallet, ShieldCheck,
  Users, Building2, ArrowRight,
} from "lucide-react";
import Link from "next/link";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "text-green-700 bg-green-50 border-green-200" :
    score >= 75 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                  "text-red-700 bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score}
    </span>
  );
}

function KpiTile({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-brand-gray-mid leading-tight">{label}</p>
        <p className="text-xl font-bold text-brand-black mt-0.5">{value}</p>
        {sub && <p className="text-xs text-brand-gray-mid mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** Formats a score bar as a coloured horizontal strip */
function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-green-500" :
    score >= 75 ? "bg-yellow-400" :
                  "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-brand-gray-light overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right">{score}</span>
    </div>
  );
}

export default async function ConsolidatedDashboardPage() {
  const { profile } = await requireAuth();

  // Only CEO and CFO can view the consolidated group dashboard
  if (profile.role !== "ceo" && profile.role !== "cfo") {
    redirect("/dashboard");
  }

  // Fetch live companies from DB; fall back to static list if table isn't set up yet
  const dbCompanies = await getCompanies();
  const allCompanies = dbCompanies.length > 0 ? dbCompanies : COMPANIES;

  // Compute group totals from whichever source we have
  // Only average compliance score over active companies that actually have data (score > 0)
  // — dormant / empty companies would otherwise drag the average down to near-zero
  const activeWithData = allCompanies.filter(c => c.status === "active" && c.compliance_score > 0);
  const GROUP_TOTALS = {
    monthly_revenue:  allCompanies.reduce((s, c) => s + c.monthly_revenue,  0),
    ap_outstanding:   allCompanies.reduce((s, c) => s + c.ap_outstanding,   0),
    ar_outstanding:   allCompanies.reduce((s, c) => s + c.ar_outstanding,   0),
    cash_balance:     allCompanies.reduce((s, c) => s + c.cash_balance,     0),
    net_pl_monthly:   allCompanies.reduce((s, c) => s + c.net_pl_monthly,   0),
    compliance_score: activeWithData.length
      ? Math.round(activeWithData.reduce((s, c) => s + c.compliance_score, 0) / activeWithData.length)
      : 0,
    employee_count:   allCompanies.reduce((s, c) => s + c.employee_count,   0),
  };

  const net    = GROUP_TOTALS.net_pl_monthly;
  const netPct = GROUP_TOTALS.monthly_revenue
    ? Math.round((net / GROUP_TOTALS.monthly_revenue) * 100)
    : 0;

  return (
    <>
      <Header
        title="Group Consolidated Dashboard"
        breadcrumbs={[
          { label: "Dashboard",     href: "/dashboard" },
          { label: "All Companies" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl space-y-6">
        {/* Group badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-red/10 border border-brand-red/20 rounded-lg px-3 py-1.5">
            <Building2 className="w-4 h-4 text-brand-red" />
            <span className="text-sm font-semibold text-brand-red">Robotek Group</span>
            <span className="text-xs text-brand-gray-mid">— {allCompanies.length} companies · {GROUP_TOTALS.employee_count.toLocaleString("en-IN")} employees</span>
          </div>
        </div>

        {/* Group KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="Group Revenue (May)"
            value={fmtAmt(GROUP_TOTALS.monthly_revenue)}
            sub={`All ${allCompanies.length} companies`}
            icon={TrendingUp}
            color="bg-brand-red"
          />
          <KpiTile
            label="Net P&L (May)"
            value={net >= 0 ? `+${fmtAmt(net)}` : `-${fmtAmt(Math.abs(net))}`}
            sub={`${netPct}% margin`}
            icon={net >= 0 ? TrendingUp : TrendingDown}
            color={net >= 0 ? "bg-green-600" : "bg-red-600"}
          />
          <KpiTile
            label="AP Outstanding"
            value={fmtAmt(GROUP_TOTALS.ap_outstanding)}
            sub="Vendor payments due"
            icon={TrendingDown}
            color="bg-red-600"
          />
          <KpiTile
            label="AR Outstanding"
            value={fmtAmt(GROUP_TOTALS.ar_outstanding)}
            sub="Customer collections"
            icon={TrendingUp}
            color="bg-blue-600"
          />
          <KpiTile
            label="Group Cash"
            value={fmtAmt(GROUP_TOTALS.cash_balance)}
            sub="Across all bank accounts"
            icon={Wallet}
            color="bg-teal-600"
          />
          <KpiTile
            label="Avg Compliance"
            value={`${GROUP_TOTALS.compliance_score}%`}
            sub="Group average score"
            icon={ShieldCheck}
            color="bg-indigo-600"
          />
        </div>

        {/* Per-company comparison table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-gray-mid" />
              <h2 className="text-sm font-semibold text-brand-black">Company-wise Breakdown</h2>
            </div>
            <span className="text-xs text-brand-gray-mid">{allCompanies.length} entities</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-brand-gray-light/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brand-gray-mid w-52">Company</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-brand-gray-mid">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-brand-gray-mid">Net P&L</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-brand-gray-mid">AP Due</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-brand-gray-mid">AR Due</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-brand-gray-mid">Cash</th>
                  <th className="px-4 py-3 text-xs font-semibold text-brand-gray-mid w-36">Compliance</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-brand-gray-mid">Staff</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allCompanies.map((co) => (
                  <tr key={co.id} className="hover:bg-brand-gray-light/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${co.color_class}`}>
                          <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-brand-black leading-tight">{co.short_name}</p>
                          {co.status === "dormant" && (
                            <span className="text-[10px] text-brand-gray-mid">Dormant</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs font-medium text-brand-black">{fmtAmt(co.monthly_revenue)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className={`text-xs font-medium ${co.net_pl_monthly >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {co.net_pl_monthly >= 0 ? "+" : ""}{fmtAmt(co.net_pl_monthly)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs font-medium text-red-700">{fmtAmt(co.ap_outstanding)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs font-medium text-blue-700">{fmtAmt(co.ar_outstanding)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs font-medium text-brand-black">{fmtAmt(co.cash_balance)}</p>
                    </td>
                    <td className="px-4 py-3 w-36">
                      <ScoreBar score={co.compliance_score} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="text-xs text-brand-gray-mid">{co.employee_count.toLocaleString("en-IN")}</p>
                    </td>
                    <td className="px-3 py-3">
                      <ArrowRight className="w-3.5 h-3.5 text-brand-gray-mid opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-border bg-brand-gray-light/60">
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-brand-black">Group Total</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-brand-black">{fmtAmt(GROUP_TOTALS.monthly_revenue)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className={`text-xs font-bold ${GROUP_TOTALS.net_pl_monthly >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {GROUP_TOTALS.net_pl_monthly >= 0 ? "+" : "-"}{fmtAmt(Math.abs(GROUP_TOTALS.net_pl_monthly))}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-red-700">{fmtAmt(GROUP_TOTALS.ap_outstanding)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-blue-700">{fmtAmt(GROUP_TOTALS.ar_outstanding)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-bold text-brand-black">{fmtAmt(GROUP_TOTALS.cash_balance)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-brand-black">Avg:</span>
                      <ScoreBadge score={GROUP_TOTALS.compliance_score} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className="text-xs font-bold text-brand-black">{GROUP_TOTALS.employee_count.toLocaleString("en-IN")}</p>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-border">
            {allCompanies.map((co) => (
              <div key={co.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${co.color_class}`}>
                    <Building2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-black">{co.short_name}</p>
                    <p className="text-xs text-brand-gray-mid">{co.city}</p>
                  </div>
                  <ScoreBadge score={co.compliance_score} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-brand-gray-mid">Revenue</p>
                    <p className="text-xs font-bold text-brand-black">{fmtAmt(co.monthly_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-gray-mid">AP Due</p>
                    <p className="text-xs font-bold text-red-700">{fmtAmt(co.ap_outstanding)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-gray-mid">Cash</p>
                    <p className="text-xs font-bold text-brand-black">{fmtAmt(co.cash_balance)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Company health grid */}
        <div>
          <h2 className="text-sm font-semibold text-brand-black mb-3">Company Health Snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allCompanies.map((co) => {
              const margin = co.monthly_revenue > 0
                ? Math.round((co.net_pl_monthly / co.monthly_revenue) * 100)
                : 0;
              // DSO = AR Outstanding / (Monthly Revenue / 30)  — rough days-sales-outstanding
              // Zero-revenue companies show "—" rather than a misleading 0-day green metric
              const arTurnover = co.monthly_revenue > 0
                ? Math.round((co.ar_outstanding / co.monthly_revenue) * 30)
                : null;
              return (
                <div
                  key={co.id}
                  className="bg-white rounded-xl border border-border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${co.color_class}`}>
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-black leading-tight">{co.short_name}</p>
                        <p className="text-[10px] text-brand-gray-mid">{co.type}</p>
                      </div>
                    </div>
                    {co.status === "dormant" ? (
                      <span className="text-[10px] font-medium bg-brand-gray-light text-brand-gray-mid px-2 py-0.5 rounded-full">Dormant</span>
                    ) : (
                      <span className="text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-brand-gray-light/50 px-3 py-2">
                      <p className="text-brand-gray-mid text-[10px]">Revenue (May)</p>
                      <p className="font-bold text-brand-black">{fmtAmt(co.monthly_revenue)}</p>
                    </div>
                    <div className="rounded-lg bg-brand-gray-light/50 px-3 py-2">
                      <p className="text-brand-gray-mid text-[10px]">Net Margin</p>
                      <p className={`font-bold ${margin >= 10 ? "text-green-700" : margin >= 5 ? "text-yellow-700" : "text-red-700"}`}>
                        {margin}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-brand-gray-light/50 px-3 py-2">
                      <p className="text-brand-gray-mid text-[10px]">Cash Balance</p>
                      <p className="font-bold text-brand-black">{fmtAmt(co.cash_balance)}</p>
                    </div>
                    <div className="rounded-lg bg-brand-gray-light/50 px-3 py-2">
                      <p className="text-brand-gray-mid text-[10px]">DSO (approx)</p>
                      {arTurnover === null ? (
                        <p className="font-bold text-brand-gray-mid">No data</p>
                      ) : (
                        <p className={`font-bold ${arTurnover <= 30 ? "text-green-700" : arTurnover <= 45 ? "text-yellow-700" : "text-red-700"}`}>
                          {arTurnover} days
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-brand-gray-mid mb-1">
                      <span>Compliance Score</span>
                      <span>{co.compliance_score}/100</span>
                    </div>
                    <ScoreBar score={co.compliance_score} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigate to individual company */}
        <div className="bg-brand-gray-light/50 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-brand-gray-mid">
            Select a company from the sidebar switcher to view its individual dashboard, AP/AR, bank statements, and compliance calendar.
          </p>
        </div>
      </main>
    </>
  );
}
