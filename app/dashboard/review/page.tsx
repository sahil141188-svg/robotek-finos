import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SCORECARD = [
  { metric: "Revenue (Apr–May)",       value: "₹1.84 Cr",  vs: "+12% vs last year",  trend: "up" },
  { metric: "COGS",                    value: "₹1.12 Cr",  vs: "+8% vs last year",   trend: "up" },
  { metric: "Gross Margin",            value: "39.1%",      vs: "+2.1pp vs last year", trend: "up" },
  { metric: "Accounts Payable",        value: "₹46.5 L",   vs: "+6% vs last month",  trend: "down" },
  { metric: "Accounts Receivable",     value: "₹68.4 L",   vs: "+4% vs last month",  trend: "down" },
  { metric: "Compliance Score",        value: "8 / 10",     vs: "2 items pending",    trend: "neutral" },
];

export default async function ReviewPage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Review Engine"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Review Engine" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <FileText className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Full Review Engine — coming on Day 10–11</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Weekly, monthly and quarterly scorecards with trend arrows, board-ready PDF export,
              and comparison against prior periods. Drill from any metric to source transactions.
            </p>
          </div>
        </div>

        {/* Scorecard grid */}
        <div>
          <h3 className="text-sm font-semibold text-brand-black mb-3">FY 2025–26 Scorecard (Sample)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCORECARD.map(({ metric, value, vs, trend }) => (
              <div key={metric} className="rounded-xl border border-border bg-white p-5">
                <p className="text-xs text-brand-gray-mid">{metric}</p>
                <p className="text-2xl font-bold text-brand-black mt-1">{value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {trend === "up"      && <TrendingUp   className="w-3.5 h-3.5 text-green-600" />}
                  {trend === "down"    && <TrendingDown  className="w-3.5 h-3.5 text-red-500" />}
                  {trend === "neutral" && <Minus         className="w-3.5 h-3.5 text-brand-gray-mid" />}
                  <span className={`text-xs ${
                    trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-brand-gray-mid"
                  }`}>{vs}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
