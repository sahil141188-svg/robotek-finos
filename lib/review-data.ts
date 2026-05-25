/**
 * Review Engine — Types and Utilities
 * Sample scorecard data removed. Upload data via Import to populate.
 */

export type PeriodTab = "weekly" | "monthly" | "quarterly";
export type TrendDir  = "up" | "down" | "neutral";

export type MetricRow = {
  id:             string;
  label:          string;
  value:          string;
  raw:            number;
  change_pct:     number | null;
  change_label:   string;
  good_direction: "up" | "down" | "none";
  drill_href?:    string;
  note?:          string;
};

export type ScorecardSection = {
  title:   string;
  metrics: MetricRow[];
};

export type ScorecardData = {
  period_label:      string;
  as_of:             string;
  health_score:      number;
  health_label:      string;
  health_color:      string;
  executive_summary: string;
  sections:          ScorecardSection[];
};

function getWeekEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthLabel(): string {
  const today      = new Date();
  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  const dayOfMonth  = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return `${monthNames[today.getMonth()]} ${today.getFullYear()} (MTD — ${dayOfMonth} of ${daysInMonth} days)`;
}

function getQuarterLabel(): string {
  const today      = new Date();
  const aprilStart = new Date(today.getFullYear(), 3, 1);
  return today < aprilStart ? "Previous Quarter" : "Q1 FY 2026-27 (Apr–Jun, in progress)";
}

// Empty scorecards — sections will populate once real data is imported
const EMPTY_SECTIONS: ScorecardSection[] = [
  {
    title: "No data yet",
    metrics: [
      {
        id: "no_data", label: "Import your data to see scorecard metrics",
        value: "—", raw: 0, change_pct: null, change_label: "",
        good_direction: "none", drill_href: "/dashboard/import",
      },
    ],
  },
];

export const SCORECARD_DATA: Record<PeriodTab, ScorecardData> = {
  weekly: {
    period_label:      `Week ending ${getWeekEndDate()}`,
    as_of:             getWeekEndDate(),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your weekly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
  monthly: {
    period_label:      getMonthLabel(),
    as_of:             new Date().toISOString().slice(0, 10),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your monthly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
  quarterly: {
    period_label:      getQuarterLabel(),
    as_of:             new Date().toISOString().slice(0, 10),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your quarterly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
};

// ─── Live scorecard builder ───────────────────────────────────────────────────

/**
 * Build a ScorecardData record from live DashboardKPI figures (Bug #13 fix).
 * All three period tabs get the same MTD/YTD data (we have one period of data).
 * Imported here in the server component and passed as a prop to ReviewContent.
 */
export function buildScorecardFromKPI(kpi: {
  revenue:      { current: number; vs_last_month_pct: number };
  cogs:         { current: number; vs_last_month_pct: number };
  gross_margin: { current: number; vs_last_month_pct: number };
  cash:         { current: number; vs_last_month_pct: number };
  ap:           { total: number; overdue: number };
  ar:           { total: number; overdue: number };
  tax:          { total: number };
  opex:         { current: number; vs_last_month_pct: number };
}): Record<PeriodTab, ScorecardData> {
  const today = new Date().toISOString().slice(0, 10);

  /** Format rupees in Indian format (values in raw rupees from DB) */
  function fmtL(n: number): string {
    if (!isFinite(n) || Math.abs(n) < 0.005) return "—";
    if (n < 0) return `−${fmtL(-n)}`;
    const lakhs = n / 100_000;
    if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
    if (lakhs >= 1)   return `₹${lakhs.toFixed(2)} L`;
    return `₹${(n / 1000).toFixed(0)} K`;
  }

  /** Derive health score from KPIs (0–100) */
  function computeHealthScore(): number {
    let score = 100;
    if (kpi.revenue.vs_last_month_pct < 0)   score -= 10;
    if (kpi.revenue.vs_last_month_pct < -10)  score -= 5;
    const apOverduePct = kpi.ap.total > 0 ? (kpi.ap.overdue / kpi.ap.total) * 100 : 0;
    if (apOverduePct > 30) score -= 15; else if (apOverduePct > 15) score -= 8;
    const arOverduePct = kpi.ar.total > 0 ? (kpi.ar.overdue / kpi.ar.total) * 100 : 0;
    if (arOverduePct > 30) score -= 12; else if (arOverduePct > 20) score -= 6;
    if (kpi.tax.total > 1_500_000) score -= 8; else if (kpi.tax.total > 800_000) score -= 4;
    return Math.max(0, Math.min(100, score));
  }

  const healthScore  = computeHealthScore();
  const healthLabel  = healthScore >= 85 ? "Strong" : healthScore >= 70 ? "Moderate" : healthScore >= 50 ? "At Risk" : "Critical";
  const healthColor  = healthScore >= 85 ? "bg-green-500" : healthScore >= 70 ? "bg-amber-400" : "bg-red-500";

  const gmPct = kpi.gross_margin.current;

  const sections: ScorecardSection[] = [
    {
      title: "Revenue & Margin",
      metrics: [
        {
          id: "revenue_mtd", label: "Revenue MTD",
          value: fmtL(kpi.revenue.current), raw: kpi.revenue.current,
          change_pct: Math.round(kpi.revenue.vs_last_month_pct),
          change_label: "vs last month",
          good_direction: "up", drill_href: "/dashboard/drill/revenue",
        },
        {
          id: "cogs_mtd", label: "COGS MTD",
          value: fmtL(kpi.cogs.current), raw: kpi.cogs.current,
          change_pct: Math.round(kpi.cogs.vs_last_month_pct),
          change_label: "vs last month",
          good_direction: "down", drill_href: "/dashboard/drill/cogs",
        },
        {
          id: "gross_margin", label: "Gross Margin",
          value: gmPct > 0 ? `${gmPct.toFixed(1)}%` : "—", raw: gmPct,
          change_pct: Math.round(kpi.gross_margin.vs_last_month_pct),
          change_label: "pp vs last month",
          good_direction: "up", drill_href: "/dashboard/drill/gross-margin",
        },
      ],
    },
    {
      title: "Cash & Operations",
      metrics: [
        {
          id: "cash_balance", label: "Cash Balance",
          value: fmtL(kpi.cash.current), raw: kpi.cash.current,
          change_pct: Math.round(kpi.cash.vs_last_month_pct),
          change_label: "vs last month",
          good_direction: "up", drill_href: "/dashboard/banking",
        },
        {
          id: "opex_mtd", label: "OpEx MTD",
          value: fmtL(kpi.opex.current), raw: kpi.opex.current,
          change_pct: Math.round(kpi.opex.vs_last_month_pct),
          change_label: "vs last month",
          good_direction: "down", drill_href: "/dashboard/drill/opex",
        },
      ],
    },
    {
      title: "AP / AR Health",
      metrics: [
        {
          id: "ap_total", label: "AP Outstanding",
          value: fmtL(kpi.ap.total), raw: kpi.ap.total,
          change_pct: null, change_label: "Accounts Payable",
          good_direction: "down", drill_href: "/dashboard/payables",
          note: kpi.ap.overdue > 0 ? `${fmtL(kpi.ap.overdue)} overdue` : undefined,
        },
        {
          id: "ar_total", label: "AR Outstanding",
          value: fmtL(kpi.ar.total), raw: kpi.ar.total,
          change_pct: null, change_label: "Accounts Receivable",
          good_direction: "up", drill_href: "/dashboard/receivables",
          note: kpi.ar.overdue > 0 ? `${fmtL(kpi.ar.overdue)} overdue` : undefined,
        },
        {
          id: "tax_liability", label: "Tax Liability",
          value: fmtL(kpi.tax.total), raw: kpi.tax.total,
          change_pct: null, change_label: "GST + TDS pending",
          good_direction: "down", drill_href: "/dashboard/drill/tax",
        },
      ],
    },
  ];

  const noData = kpi.revenue.current === 0 && kpi.cogs.current === 0;
  const summary = noData
    ? "No financial data imported yet. Upload your Busy Excel exports to see live scorecard metrics."
    : `Health score ${healthScore}/100. Revenue ${kpi.revenue.vs_last_month_pct >= 0 ? "up" : "down"} ${Math.abs(kpi.revenue.vs_last_month_pct).toFixed(1)}% vs last month. Gross margin at ${gmPct.toFixed(1)}%.`;

  const base: ScorecardData = {
    period_label:      getMonthLabel(),
    as_of:             today,
    health_score:      noData ? 0 : healthScore,
    health_label:      noData ? "No Data" : healthLabel,
    health_color:      noData ? "bg-gray-400" : healthColor,
    executive_summary: summary,
    sections:          noData ? EMPTY_SECTIONS : sections,
  };

  return {
    weekly:    { ...base, period_label: `Week ending ${getWeekEndDate()}` },
    monthly:   base,
    quarterly: { ...base, period_label: getQuarterLabel() },
  };
}

export function trendClass(row: MetricRow): string {
  if (row.change_pct === null || row.change_pct === 0) return "text-brand-gray-mid";
  const improved =
    (row.good_direction === "up"   && row.change_pct > 0) ||
    (row.good_direction === "down" && row.change_pct < 0);
  return improved ? "text-green-600" : "text-red-600";
}

export function trendIcon(row: MetricRow): "up" | "down" | "neutral" {
  if (row.change_pct === null || row.change_pct === 0) return "neutral";
  return row.change_pct > 0 ? "up" : "down";
}
