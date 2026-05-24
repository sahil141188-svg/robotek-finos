/**
 * Dashboard data layer — Types and Utilities
 * Sample data removed. Upload data via Import to populate.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiSummary = {
  revenue:      { mtd: number; ytd: number; vs_last_month_pct: number; vs_last_year_pct: number };
  cogs:         { mtd: number; ytd: number; vs_last_month_pct: number };
  gross_margin: { pct: number; vs_last_month_pp: number; vs_last_year_pp: number };
  ap:           { total: number; overdue: number };
  ar:           { total: number; overdue: number };
  cash:         { balance: number; vs_last_month_pct: number };
  tax:          { gst: number; tds: number; total: number };
  opex:         { mtd: number; vs_last_month_pct: number };
};

export type RevenueTrendPoint = {
  month: string;
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
};

export type ExpenseItem = {
  category: string;
  amount: number;
  color: string;
};

export type AgingBucket = {
  bucket: string;
  ap: number;
  ar: number;
};

export type ComplianceItem = {
  title: string;
  due_date: string;
  days_remaining: number;
  status: "overdue" | "critical" | "upcoming";
};

export type MonthlyBreakdown = {
  month: string;
  period: string;
  value: number;
  count: number;
  vs_prev_pct: number;
};

export type DrillTransaction = {
  id: string;
  date: string;
  voucher_no: string;
  ledger: string;
  narration: string;
  dr_cr: "DR" | "CR";
  amount: number;
};

// ─── All zeroed — populated from real imported data ───────────────────────────

export const SAMPLE_KPI: KpiSummary = {
  revenue:      { mtd: 0, ytd: 0, vs_last_month_pct: 0, vs_last_year_pct: 0 },
  cogs:         { mtd: 0, ytd: 0, vs_last_month_pct: 0 },
  gross_margin: { pct: 0, vs_last_month_pp: 0, vs_last_year_pp: 0 },
  ap:           { total: 0, overdue: 0 },
  ar:           { total: 0, overdue: 0 },
  cash:         { balance: 0, vs_last_month_pct: 0 },
  tax:          { gst: 0, tds: 0, total: 0 },
  opex:         { mtd: 0, vs_last_month_pct: 0 },
};

export const REVENUE_TREND:     RevenueTrendPoint[]  = [];
export const EXPENSE_BREAKDOWN: ExpenseItem[]        = [];
export const AGING_DATA:        AgingBucket[]        = [];
export const SAMPLE_TRANSACTIONS: DrillTransaction[] = [];
export const DRILL_REVENUE:     MonthlyBreakdown[]   = [];
export const DRILL_COGS:        MonthlyBreakdown[]   = [];
export const DRILL_OPEX:        MonthlyBreakdown[]   = [];
export const DRILL_GROSS_MARGIN:MonthlyBreakdown[]   = [];
export const DRILL_CASH:        MonthlyBreakdown[]   = [];
export const DRILL_TAX:         MonthlyBreakdown[]   = [];

// ─── Compliance Upcoming — real due dates, no sample financial amounts ─────────

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

function complianceStatus(days: number): "overdue" | "critical" | "upcoming" {
  if (days < 0)  return "overdue";
  if (days <= 7) return "critical";
  return "upcoming";
}

// Real statutory deadlines — always shown regardless of import status
const COMPLIANCE_DEADLINES: { title: string; due: string }[] = [
  { title: "TDS Deposit (May '26)",  due: "2026-06-07" },
  { title: "GSTR-1 (May '26)",       due: "2026-06-11" },
  { title: "ESI Deposit (May '26)",  due: "2026-06-15" },
  { title: "GSTR-3B (May '26)",      due: "2026-06-20" },
  { title: "Advance Tax Q1",         due: "2026-06-15" },
];

export const UPCOMING_COMPLIANCE: ComplianceItem[] = COMPLIANCE_DEADLINES.map(({ title, due }) => {
  const days = daysUntil(due);
  return {
    title,
    due_date: new Date(due).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    days_remaining: days,
    status: complianceStatus(days),
  };
});

// ─── Module Config ────────────────────────────────────────────────────────────

export type DrillModuleSlug = "revenue" | "cogs" | "gross-margin" | "cash" | "tax" | "opex";

export type DrillConfig = {
  title: string;
  metric: string;
  unit: "lakhs" | "percent";
  data: MonthlyBreakdown[];
  breadcrumb: string;
};

export const DRILL_CONFIG: Record<DrillModuleSlug, DrillConfig> = {
  revenue:        { title: "Revenue Drill-Down",       metric: "Revenue",         unit: "lakhs",   data: DRILL_REVENUE,       breadcrumb: "Revenue"      },
  cogs:           { title: "COGS Drill-Down",          metric: "COGS",            unit: "lakhs",   data: DRILL_COGS,          breadcrumb: "COGS"         },
  "gross-margin": { title: "Gross Margin Drill-Down",  metric: "Gross Margin",    unit: "percent", data: DRILL_GROSS_MARGIN,  breadcrumb: "Gross Margin" },
  cash:           { title: "Cash Position Drill-Down", metric: "Cash Balance",    unit: "lakhs",   data: DRILL_CASH,          breadcrumb: "Cash"         },
  tax:            { title: "Tax Liability Drill-Down", metric: "Tax Outstanding", unit: "lakhs",   data: DRILL_TAX,           breadcrumb: "Tax Liability"},
  opex:           { title: "OpEx Drill-Down",          metric: "Operating Exp",   unit: "lakhs",   data: DRILL_OPEX,          breadcrumb: "OpEx"         },
};

export const PERIOD_LABELS: Record<string, string> = {
  "apr-2025": "April 2025",   "may-2025": "May 2025",
  "jun-2025": "June 2025",    "jul-2025": "July 2025",
  "aug-2025": "August 2025",  "sep-2025": "September 2025",
  "oct-2025": "October 2025", "nov-2025": "November 2025",
  "dec-2025": "December 2025","jan-2026": "January 2026",
  "feb-2026": "February 2026","mar-2026": "March 2026",
  "apr-2026": "April 2026",   "may-2026": "May 2026",
};
