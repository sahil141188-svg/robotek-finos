/**
 * Review Engine Sample Data — Module 7
 *
 * Weekly / Monthly / Quarterly scorecards referencing real KPIs from Modules 1–6.
 * TODAY = 2026-05-21
 */

export type PeriodTab = "weekly" | "monthly" | "quarterly";

export type TrendDir = "up" | "down" | "neutral";

export type MetricRow = {
  id:               string;
  label:            string;
  value:            string;         // formatted display
  raw:              number;
  change_pct:       number | null;  // null = no comparison
  change_label:     string;         // "vs Apr 2026", "vs prev week"
  good_direction:   "up" | "down" | "none"; // "up" means higher = better
  drill_href?:      string;
  note?:            string;         // optional footnote
};

export type ScorecardSection = {
  title: string;
  metrics: MetricRow[];
};

export type ScorecardData = {
  period_label:       string;
  as_of:              string;
  health_score:       number;  // 0-100
  health_label:       string;
  health_color:       string;  // tailwind class
  executive_summary:  string;
  sections:           ScorecardSection[];
};

export const SCORECARD_DATA: Record<PeriodTab, ScorecardData> = {

  // ─── Weekly ────────────────────────────────────────────────────────────────
  weekly: {
    period_label:      "Week ending 21 May 2026",
    as_of:             "2026-05-21",
    health_score:      78,
    health_label:      "Good",
    health_color:      "bg-green-500",
    executive_summary: "Strong invoicing week. Collections improved 14% over last week. One overdue task requires attention (TCS Q4 return). AR overdue crept up slightly — follow up on Jaipur and Ahmedabad accounts.",
    sections: [
      {
        title: "Revenue & Collections",
        metrics: [
          { id: "rev_week",   label: "Invoices Raised (Week)",     value: "₹38.5L",  raw: 3850000, change_pct: +8,   change_label: "vs prev week",  good_direction: "up",   drill_href: "/dashboard/receivables" },
          { id: "coll_week",  label: "Collections Received",       value: "₹22.4L",  raw: 2240000, change_pct: +14,  change_label: "vs prev week",  good_direction: "up",   drill_href: "/dashboard/receivables" },
          { id: "pay_week",   label: "Vendor Payments Made",       value: "₹18.2L",  raw: 1820000, change_pct: -4,   change_label: "vs prev week",  good_direction: "down", drill_href: "/dashboard/payables" },
        ],
      },
      {
        title: "Outstanding Balances",
        metrics: [
          { id: "ar_wk",    label: "Total AR Outstanding",         value: "₹68.35L", raw: 6835000, change_pct: +3,   change_label: "vs prev week",  good_direction: "down", drill_href: "/dashboard/receivables" },
          { id: "ar_ovd_wk",label: "AR Overdue (>30 days)",        value: "₹22.5L",  raw: 2250000, change_pct: +5,   change_label: "vs prev week",  good_direction: "down", drill_href: "/dashboard/receivables" },
          { id: "ap_wk",    label: "Total AP Outstanding",         value: "₹46.5L",  raw: 4650000, change_pct: -2,   change_label: "vs prev week",  good_direction: "down", drill_href: "/dashboard/payables" },
          { id: "ap_ovd_wk",label: "AP Overdue (>30 days)",        value: "₹16.95L", raw: 1695000, change_pct: -8,   change_label: "vs prev week",  good_direction: "down", drill_href: "/dashboard/payables" },
        ],
      },
      {
        title: "Compliance & Tasks",
        metrics: [
          { id: "comp_wk",    label: "Compliance Score",           value: "88%",     raw: 88,      change_pct: 0,    change_label: "unchanged",     good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "tasks_done", label: "Tasks Completed (Week)",     value: "3",       raw: 3,       change_pct: null, change_label: "",              good_direction: "up",   drill_href: "/dashboard/tasks" },
          { id: "tasks_ovd",  label: "Tasks Overdue",              value: "1",       raw: 1,       change_pct: null, change_label: "TCS Q4 return", good_direction: "down", drill_href: "/dashboard/tasks", note: "TCS Q4 FY25-26 return — escalate to CA" },
        ],
      },
    ],
  },

  // ─── Monthly ───────────────────────────────────────────────────────────────
  monthly: {
    period_label:      "May 2026 (MTD — 21 of 31 days)",
    as_of:             "2026-05-21",
    health_score:      82,
    health_label:      "Strong",
    health_color:      "bg-green-500",
    executive_summary: "Revenue tracking 12% ahead of April. Gross margin holding at 39.1% (+2.1pp). AP overdue reduced 8% vs April — good payment discipline. AR overdue up 12% — 3 customers need escalation. One compliance item overdue (TCS Q4).",
    sections: [
      {
        title: "Revenue & Profitability",
        metrics: [
          { id: "rev_m",    label: "Revenue (MTD)",                value: "₹1.85Cr", raw: 18500000, change_pct: +12,  change_label: "vs Apr 2026",   good_direction: "up",   drill_href: "/dashboard" },
          { id: "cogs_m",   label: "COGS (Est.)",                  value: "₹1.13Cr", raw: 11300000, change_pct: +9,   change_label: "vs Apr 2026",   good_direction: "down", drill_href: "/dashboard" },
          { id: "gm_m",     label: "Gross Margin",                 value: "39.1%",   raw: 39.1,    change_pct: +2.1, change_label: "vs Apr 2026",   good_direction: "up",   drill_href: "/dashboard" },
          { id: "coll_m",   label: "Collections Received (MTD)",   value: "₹1.42Cr", raw: 14200000, change_pct: +8,   change_label: "vs Apr 2026",   good_direction: "up",   drill_href: "/dashboard/receivables" },
        ],
      },
      {
        title: "Accounts Payable",
        metrics: [
          { id: "ap_m",     label: "Total AP Outstanding",         value: "₹46.5L",  raw: 4650000, change_pct: +6,   change_label: "vs Apr end",    good_direction: "down", drill_href: "/dashboard/payables" },
          { id: "ap_ovd_m", label: "AP Overdue (>30 days)",        value: "₹16.95L", raw: 1695000, change_pct: -8,   change_label: "vs Apr end",    good_direction: "down", drill_href: "/dashboard/payables" },
          { id: "dpo_m",    label: "Days Payable Outstanding",     value: "38 days", raw: 38,      change_pct: -5,   change_label: "vs Apr 2026",   good_direction: "down", drill_href: "/dashboard/payables" },
        ],
      },
      {
        title: "Accounts Receivable",
        metrics: [
          { id: "ar_m",     label: "Total AR Outstanding",         value: "₹68.35L", raw: 6835000, change_pct: +4,   change_label: "vs Apr end",    good_direction: "down", drill_href: "/dashboard/receivables" },
          { id: "ar_ovd_m", label: "AR Overdue (>30 days)",        value: "₹22.5L",  raw: 2250000, change_pct: +12,  change_label: "vs Apr end",    good_direction: "down", drill_href: "/dashboard/receivables", note: "3 customers need immediate follow-up" },
          { id: "dso_m",    label: "Days Sales Outstanding",       value: "47 days", raw: 47,      change_pct: +4,   change_label: "vs Apr 2026",   good_direction: "down", drill_href: "/dashboard/receivables" },
        ],
      },
      {
        title: "Compliance",
        metrics: [
          { id: "comp_m",       label: "Compliance Score",         value: "88%",     raw: 88,      change_pct: -4,   change_label: "vs Apr 2026",   good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "items_due_m",  label: "Items Due This Month",     value: "8",       raw: 8,       change_pct: null, change_label: "",              good_direction: "none", drill_href: "/dashboard/compliance" },
          { id: "items_filed_m",label: "Items Filed / Paid",       value: "7",       raw: 7,       change_pct: null, change_label: "of 8",          good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "items_ovd_m",  label: "Items Overdue",            value: "1",       raw: 1,       change_pct: null, change_label: "TCS Q4 FY25-26",good_direction: "none", drill_href: "/dashboard/compliance", note: "TCS Q4 FY25-26 return due 15 May — assign to CA immediately" },
        ],
      },
    ],
  },

  // ─── Quarterly ─────────────────────────────────────────────────────────────
  quarterly: {
    period_label:      "Q1 FY 2026-27 (Apr–May, in progress)",
    as_of:             "2026-05-21",
    health_score:      85,
    health_label:      "Strong",
    health_color:      "bg-green-500",
    executive_summary: "Q1 off to a strong start — revenue up 11% vs Q4 FY25-26. Gross margin improved 1.8pp to 39.1%. Working capital under control. DSO slightly elevated at 47 days — target is 40 days. Compliance rate holding above 85%.",
    sections: [
      {
        title: "Revenue & Profitability",
        metrics: [
          { id: "rev_q",    label: "Revenue (Apr–May)",            value: "₹3.73Cr", raw: 37300000, change_pct: +11,  change_label: "vs Q4 FY25-26", good_direction: "up",   drill_href: "/dashboard" },
          { id: "cogs_q",   label: "COGS",                         value: "₹2.27Cr", raw: 22700000, change_pct: +8,   change_label: "vs Q4 FY25-26", good_direction: "down", drill_href: "/dashboard" },
          { id: "gm_q",     label: "Gross Margin",                 value: "39.1%",   raw: 39.1,    change_pct: +1.8, change_label: "vs Q4 FY25-26", good_direction: "up",   drill_href: "/dashboard" },
          { id: "opinc_q",  label: "Operating Income (Est.)",      value: "₹62.4L",  raw: 6240000, change_pct: +18,  change_label: "vs Q4 FY25-26", good_direction: "up",   drill_href: "/dashboard" },
        ],
      },
      {
        title: "Working Capital",
        metrics: [
          { id: "ap_q",     label: "AP Outstanding",               value: "₹46.5L",  raw: 4650000, change_pct: +3,   change_label: "vs Q4 end",     good_direction: "down", drill_href: "/dashboard/payables" },
          { id: "ar_q",     label: "AR Outstanding",               value: "₹68.35L", raw: 6835000, change_pct: +7,   change_label: "vs Q4 end",     good_direction: "down", drill_href: "/dashboard/receivables" },
          { id: "dpo_q",    label: "Days Payable Outstanding",     value: "38 days", raw: 38,      change_pct: -6,   change_label: "vs Q4 FY25-26", good_direction: "down", drill_href: "/dashboard/payables" },
          { id: "dso_q",    label: "Days Sales Outstanding",       value: "47 days", raw: 47,      change_pct: +3,   change_label: "vs Q4 FY25-26", good_direction: "down", drill_href: "/dashboard/receivables", note: "Target ≤ 40 days" },
        ],
      },
      {
        title: "Compliance",
        metrics: [
          { id: "comp_q",    label: "Compliance Score",            value: "88%",     raw: 88,      change_pct: -2,   change_label: "vs Q4 FY25-26", good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "gst_q",     label: "GST Returns Filed",           value: "4 / 4",   raw: 100,     change_pct: null, change_label: "Apr–May",        good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "tds_q",     label: "TDS Deposits On Time",        value: "2 / 2",   raw: 100,     change_pct: null, change_label: "Apr–May",        good_direction: "up",   drill_href: "/dashboard/compliance" },
          { id: "tcs_q",     label: "TCS Q4 Return",               value: "Overdue", raw: 0,       change_pct: null, change_label: "Due 15 May",     good_direction: "none", drill_href: "/dashboard/compliance", note: "TCS Q4 FY25-26 return not yet filed — action required" },
        ],
      },
    ],
  },
};

/** Compute effective trend direction for a metric row (green/red) */
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
