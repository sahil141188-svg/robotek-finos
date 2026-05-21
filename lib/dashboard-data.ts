/**
 * Dashboard data layer — Module 1: CFO Dashboard
 *
 * All sample data modelled on Robotek India's scale (mobile accessories manufacturer,
 * ₹18–20 Cr annual revenue, Kundli factory, Delhi HQ).
 *
 * Replace `SAMPLE_*` constants with real Supabase queries once the
 * Day 3 Data Import Engine populates the `transactions` table.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

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
  month: string;       // display label e.g. "Mar '26"
  period: string;      // URL slug e.g. "mar-2026"
  revenue: number;     // ₹ Lakhs
  cogs: number;        // ₹ Lakhs
  grossProfit: number; // ₹ Lakhs
};

export type ExpenseItem = {
  category: string;
  amount: number; // ₹ Lakhs
  color: string;
};

export type AgingBucket = {
  bucket: string;
  ap: number; // ₹ Lakhs
  ar: number; // ₹ Lakhs
};

export type ComplianceItem = {
  title: string;
  due_date: string;
  days_remaining: number; // negative = overdue
  status: "overdue" | "critical" | "upcoming";
};

export type MonthlyBreakdown = {
  month: string;
  period: string;
  value: number;    // amount in Lakhs (or % for margin)
  count: number;    // transaction count
  vs_prev_pct: number;
};

export type DrillTransaction = {
  id: string;
  date: string;
  voucher_no: string;
  ledger: string;
  narration: string;
  dr_cr: "DR" | "CR";
  amount: number; // ₹ Lakhs
};

// ─── KPI Summary (Mar 2026 actuals, FY 2025-26) ──────────────────────────────

export const SAMPLE_KPI: KpiSummary = {
  revenue:      { mtd: 184.0, ytd: 1840.0, vs_last_month_pct: 7.0,  vs_last_year_pct: 12.0 },
  cogs:         { mtd: 112.0, ytd: 1120.0, vs_last_month_pct: 5.0 },
  gross_margin: { pct: 39.1,  vs_last_month_pp: 1.2, vs_last_year_pp: 2.1 },
  ap:           { total: 46.5,  overdue: 16.95 },
  ar:           { total: 68.35, overdue: 22.5 },
  cash:         { balance: 28.4, vs_last_month_pct: -3.2 },
  tax:          { gst: 4.12, tds: 2.84, total: 6.96 },
  opex:         { mtd: 34.2, vs_last_month_pct: 2.1 },
};

// ─── Revenue Trend (last 6 months, ₹ Lakhs) ─────────────────────────────────

export const REVENUE_TREND: RevenueTrendPoint[] = [
  { month: "Oct '25", period: "oct-2025", revenue: 142, cogs: 87,  grossProfit: 55 },
  { month: "Nov '25", period: "nov-2025", revenue: 155, cogs: 94,  grossProfit: 61 },
  { month: "Dec '25", period: "dec-2025", revenue: 172, cogs: 104, grossProfit: 68 },
  { month: "Jan '26", period: "jan-2026", revenue: 161, cogs: 97,  grossProfit: 64 },
  { month: "Feb '26", period: "feb-2026", revenue: 172, cogs: 105, grossProfit: 67 },
  { month: "Mar '26", period: "mar-2026", revenue: 184, cogs: 112, grossProfit: 72 },
];

// ─── Cost Breakdown (Mar 2026, ₹ Lakhs) ──────────────────────────────────────

export const EXPENSE_BREAKDOWN: ExpenseItem[] = [
  { category: "Raw Materials",   amount: 84.0, color: "#E52D31" },
  { category: "Direct Labour",   amount: 16.8, color: "#852321" },
  { category: "Mfg Overhead",    amount: 11.2, color: "#b45309" },
  { category: "Selling & Dist",  amount: 18.5, color: "#4f46e5" },
  { category: "Admin & General", amount:  8.4, color: "#0891b2" },
  { category: "Finance Costs",   amount:  4.2, color: "#16a34a" },
  { category: "Other",           amount:  3.1, color: "#9A9596" },
];

// ─── AP / AR Aging Buckets (₹ Lakhs) ─────────────────────────────────────────

export const AGING_DATA: AgingBucket[] = [
  { bucket: "0–30 days",  ap: 17.8, ar: 22.4  },
  { bucket: "31–60 days", ap: 15.6, ar: 24.6  },
  { bucket: "61–90 days", ap:  8.6, ar: 11.2  },
  { bucket: "90+ days",   ap:  4.5, ar: 10.15 },
];

// ─── Compliance Upcoming (as of May 21, 2026) ────────────────────────────────

export const UPCOMING_COMPLIANCE: ComplianceItem[] = [
  { title: "PF Deposit (Apr '26)",  due_date: "15 May 2026", days_remaining: -6,  status: "overdue"  },
  { title: "TDS Deposit (May '26)", due_date: "7 Jun 2026",  days_remaining: 17,  status: "critical" },
  { title: "GSTR-1 (May '26)",      due_date: "11 Jun 2026", days_remaining: 21,  status: "upcoming" },
  { title: "ESI Deposit (May '26)", due_date: "15 Jun 2026", days_remaining: 25,  status: "upcoming" },
  { title: "GSTR-3B (May '26)",     due_date: "20 Jun 2026", days_remaining: 30,  status: "upcoming" },
];

// ─── Layer 2 Drill — Full FY 2025-26 Monthly Breakdown ───────────────────────

export const DRILL_REVENUE: MonthlyBreakdown[] = [
  { month: "Apr 2025", period: "apr-2025", value: 148.2, count: 124, vs_prev_pct: 0    },
  { month: "May 2025", period: "may-2025", value: 152.6, count: 138, vs_prev_pct: 3.0  },
  { month: "Jun 2025", period: "jun-2025", value: 168.4, count: 145, vs_prev_pct: 10.4 },
  { month: "Jul 2025", period: "jul-2025", value: 154.8, count: 132, vs_prev_pct: -8.1 },
  { month: "Aug 2025", period: "aug-2025", value: 160.2, count: 140, vs_prev_pct: 3.5  },
  { month: "Sep 2025", period: "sep-2025", value: 175.6, count: 152, vs_prev_pct: 9.6  },
  { month: "Oct 2025", period: "oct-2025", value: 142.0, count: 118, vs_prev_pct: -19.1},
  { month: "Nov 2025", period: "nov-2025", value: 155.0, count: 128, vs_prev_pct: 9.2  },
  { month: "Dec 2025", period: "dec-2025", value: 172.0, count: 144, vs_prev_pct: 10.9 },
  { month: "Jan 2026", period: "jan-2026", value: 161.0, count: 134, vs_prev_pct: -6.4 },
  { month: "Feb 2026", period: "feb-2026", value: 172.0, count: 140, vs_prev_pct: 6.8  },
  { month: "Mar 2026", period: "mar-2026", value: 184.0, count: 158, vs_prev_pct: 7.0  },
];

/** Derive COGS / Gross-Margin / OpEx drill from revenue base */
export const DRILL_COGS: MonthlyBreakdown[] = DRILL_REVENUE.map(d => ({
  ...d,
  value: parseFloat((d.value * 0.609).toFixed(1)),
}));

export const DRILL_OPEX: MonthlyBreakdown[] = DRILL_REVENUE.map(d => ({
  ...d,
  value: parseFloat((d.value * 0.186).toFixed(1)),
}));

export const DRILL_GROSS_MARGIN: MonthlyBreakdown[] = DRILL_REVENUE.map(d => ({
  ...d,
  value: parseFloat(((1 - 0.609) * 100).toFixed(1)),
}));

export const DRILL_CASH: MonthlyBreakdown[] = [
  { month: "Apr 2025", period: "apr-2025", value: 31.2, count: 48, vs_prev_pct: 0    },
  { month: "May 2025", period: "may-2025", value: 29.8, count: 52, vs_prev_pct: -4.5 },
  { month: "Jun 2025", period: "jun-2025", value: 34.5, count: 55, vs_prev_pct: 15.8 },
  { month: "Jul 2025", period: "jul-2025", value: 26.4, count: 44, vs_prev_pct: -23.5},
  { month: "Aug 2025", period: "aug-2025", value: 28.1, count: 46, vs_prev_pct: 6.4  },
  { month: "Sep 2025", period: "sep-2025", value: 32.8, count: 58, vs_prev_pct: 16.7 },
  { month: "Oct 2025", period: "oct-2025", value: 24.6, count: 40, vs_prev_pct: -25.0},
  { month: "Nov 2025", period: "nov-2025", value: 27.4, count: 44, vs_prev_pct: 11.4 },
  { month: "Dec 2025", period: "dec-2025", value: 30.8, count: 50, vs_prev_pct: 12.4 },
  { month: "Jan 2026", period: "jan-2026", value: 29.4, count: 48, vs_prev_pct: -4.5 },
  { month: "Feb 2026", period: "feb-2026", value: 29.4, count: 46, vs_prev_pct: 0    },
  { month: "Mar 2026", period: "mar-2026", value: 28.4, count: 44, vs_prev_pct: -3.4 },
];

export const DRILL_TAX: MonthlyBreakdown[] = DRILL_REVENUE.map(d => ({
  ...d,
  value: parseFloat((d.value * 0.038).toFixed(2)),
}));

// ─── Layer 3 Sample Transactions (Mar 2026) ───────────────────────────────────

export const SAMPLE_TRANSACTIONS: DrillTransaction[] = [
  { id: "T001", date: "01 Mar 2026", voucher_no: "SI-26100001", ledger: "Reliance Retail Ltd",      narration: "Sales — USB-A Cables 10,000 pcs @ ₹246", dr_cr: "DR", amount: 24.6  },
  { id: "T002", date: "02 Mar 2026", voucher_no: "SI-26100002", ledger: "Amazon India Pvt Ltd",     narration: "Sales — Phone Cases 8,500 pcs @ ₹204",  dr_cr: "DR", amount: 17.3  },
  { id: "T003", date: "03 Mar 2026", voucher_no: "SI-26100003", ledger: "Croma (Infiniti Retail)",  narration: "Sales — 20W Chargers 6,200 pcs @ ₹180", dr_cr: "DR", amount: 11.2  },
  { id: "T004", date: "05 Mar 2026", voucher_no: "SI-26100004", ledger: "Flipkart Internet",        narration: "Sales — Power Banks 4,100 pcs @ ₹230",  dr_cr: "DR", amount: 9.45  },
  { id: "T005", date: "07 Mar 2026", voucher_no: "SI-26100005", ledger: "Vijay Sales",              narration: "Sales — TWS Earphones 3,800 pcs @ ₹152",dr_cr: "DR", amount: 5.8   },
  { id: "T006", date: "10 Mar 2026", voucher_no: "SI-26100006", ledger: "Samsung Plaza",            narration: "Sales — USB-C Cables 5,000 pcs @ ₹168", dr_cr: "DR", amount: 8.4   },
  { id: "T007", date: "12 Mar 2026", voucher_no: "SI-26100007", ledger: "Poorvika Mobiles",         narration: "Sales — Mobile Stands 7,000 pcs @ ₹88", dr_cr: "DR", amount: 6.2   },
  { id: "T008", date: "14 Mar 2026", voucher_no: "SI-26100008", ledger: "Big Bazaar Retail",        narration: "Sales — Accessories Bundle 4,200 sets",  dr_cr: "DR", amount: 12.8  },
  { id: "T009", date: "16 Mar 2026", voucher_no: "SI-26100009", ledger: "Chroma Electronics",       narration: "Sales — USB-C Cables 12,000 pcs @ ₹238",dr_cr: "DR", amount: 28.6  },
  { id: "T010", date: "18 Mar 2026", voucher_no: "GST-26100001", ledger: "GST Payable A/c",         narration: "GST @18% collected on sales (Mar wk1-2)", dr_cr: "CR", amount: 18.0 },
  { id: "T011", date: "20 Mar 2026", voucher_no: "SI-26100010", ledger: "DMart Retail",             narration: "Sales — TWS Earbuds 2,800 pcs @ ₹693",  dr_cr: "DR", amount: 19.4  },
  { id: "T012", date: "22 Mar 2026", voucher_no: "SI-26100011", ledger: "Reliance JioMart",         narration: "Sales — 65W GaN Chargers 5,600 pcs",     dr_cr: "DR", amount: 16.5  },
  { id: "T013", date: "25 Mar 2026", voucher_no: "SI-26100012", ledger: "Paytm Mall",              narration: "Sales — Tempered Glass 24,000 pcs",      dr_cr: "DR", amount: 7.2   },
  { id: "T014", date: "28 Mar 2026", voucher_no: "SI-26100013", ledger: "Amazon India Pvt Ltd",     narration: "Sales — 15W Wireless Chargers 3,150 pcs",dr_cr: "DR", amount: 12.6  },
  { id: "T015", date: "31 Mar 2026", voucher_no: "GST-26100002", ledger: "GST Payable A/c",         narration: "GST @18% collected on sales (Mar wk3-4)", dr_cr: "CR", amount: 18.3 },
];

// ─── Module Config — maps URL slug to display data ───────────────────────────

export type DrillModuleSlug =
  | "revenue" | "cogs" | "gross-margin" | "cash" | "tax" | "opex";

export type DrillConfig = {
  title: string;
  metric: string;
  unit: "lakhs" | "percent";
  data: MonthlyBreakdown[];
  breadcrumb: string;
};

export const DRILL_CONFIG: Record<DrillModuleSlug, DrillConfig> = {
  revenue:       { title: "Revenue Drill-Down",       metric: "Revenue",         unit: "lakhs",   data: DRILL_REVENUE,      breadcrumb: "Revenue"       },
  cogs:          { title: "COGS Drill-Down",           metric: "COGS",            unit: "lakhs",   data: DRILL_COGS,         breadcrumb: "COGS"          },
  "gross-margin":{ title: "Gross Margin Drill-Down",  metric: "Gross Margin",    unit: "percent", data: DRILL_GROSS_MARGIN, breadcrumb: "Gross Margin"  },
  cash:          { title: "Cash Position Drill-Down", metric: "Cash Balance",    unit: "lakhs",   data: DRILL_CASH,         breadcrumb: "Cash"          },
  tax:           { title: "Tax Liability Drill-Down", metric: "Tax Outstanding", unit: "lakhs",   data: DRILL_TAX,          breadcrumb: "Tax Liability" },
  opex:          { title: "OpEx Drill-Down",          metric: "Operating Exp",   unit: "lakhs",   data: DRILL_OPEX,         breadcrumb: "OpEx"          },
};

/** Period slug → display label for Layer 3 breadcrumb */
export const PERIOD_LABELS: Record<string, string> = {
  "apr-2025": "April 2025",   "may-2025": "May 2025",
  "jun-2025": "June 2025",    "jul-2025": "July 2025",
  "aug-2025": "August 2025",  "sep-2025": "September 2025",
  "oct-2025": "October 2025", "nov-2025": "November 2025",
  "dec-2025": "December 2025","jan-2026": "January 2026",
  "feb-2026": "February 2026","mar-2026": "March 2026",
  "apr-2026": "April 2026",   "may-2026": "May 2026",
};
