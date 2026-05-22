/**
 * Robotek Group of Companies — 10 subsidiaries
 * Used for the multi-company switcher and consolidated dashboard.
 * All monetary values in INR (rupees). FY 2026-27, as of May 22 2026.
 */

export type CompanyStatus = "active" | "dormant";

export interface Company {
  id:               string;
  name:             string;       // full legal name
  short_name:       string;       // abbreviated for sidebar (≤ 18 chars)
  type:             string;       // business sector
  city:             string;
  gstin:            string;
  color_class:      string;       // Tailwind bg color for avatar dot
  status:           CompanyStatus;
  // KPIs — stored in INR (rupees)
  monthly_revenue:  number;
  ap_outstanding:   number;
  ar_outstanding:   number;
  cash_balance:     number;
  net_pl_monthly:   number;       // monthly net P&L (positive = profit)
  compliance_score: number;       // 0–100
  employee_count:   number;
}

export const COMPANIES: Company[] = [
  {
    id:              "comp-01",
    name:            "Robotek India Pvt Ltd",
    short_name:      "Robotek",
    type:            "Manufacturing — Mobile Accessories",
    city:            "Kundli, Haryana",
    gstin:           "",
    color_class:     "bg-brand-red",
    status:          "active",
    monthly_revenue:  18250000,
    ap_outstanding:   4650000,
    ar_outstanding:   6835000,
    cash_balance:     5579000,
    net_pl_monthly:   2840000,
    compliance_score: 84,
    employee_count:   500,
  },
  {
    id:              "comp-02",
    name:            "Muskan",
    short_name:      "Muskan",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-blue-600",
    status:          "active",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-03",
    name:            "Yellow",
    short_name:      "Yellow",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-yellow-500",
    status:          "active",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-04",
    name:            "Skyview",
    short_name:      "Skyview",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-sky-600",
    status:          "active",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-05",
    name:            "Yuval Enterprises",
    short_name:      "Yuval Ent",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-emerald-600",
    status:          "active",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-06",
    name:            "Yuval Industries",
    short_name:      "Yuval Ind",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-purple-600",
    status:          "active",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  // ── Slots 7–10 reserved — share details to activate ────────────────────────
  {
    id:              "comp-07",
    name:            "Company 7 (Coming Soon)",
    short_name:      "Company 7",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-slate-400",
    status:          "dormant",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-08",
    name:            "Company 8 (Coming Soon)",
    short_name:      "Company 8",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-slate-400",
    status:          "dormant",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-09",
    name:            "Company 9 (Coming Soon)",
    short_name:      "Company 9",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-slate-400",
    status:          "dormant",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
  {
    id:              "comp-10",
    name:            "Company 10 (Coming Soon)",
    short_name:      "Company 10",
    type:            "",
    city:            "",
    gstin:           "",
    color_class:     "bg-slate-400",
    status:          "dormant",
    monthly_revenue:  0,
    ap_outstanding:   0,
    ar_outstanding:   0,
    cash_balance:     0,
    net_pl_monthly:   0,
    compliance_score: 0,
    employee_count:   0,
  },
];

/** Returns a company by its id */
export function getCompany(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id);
}

/** Aggregate totals across ALL companies in the group */
export const GROUP_TOTALS = {
  monthly_revenue:  COMPANIES.reduce((s, c) => s + c.monthly_revenue,  0),
  ap_outstanding:   COMPANIES.reduce((s, c) => s + c.ap_outstanding,   0),
  ar_outstanding:   COMPANIES.reduce((s, c) => s + c.ar_outstanding,   0),
  cash_balance:     COMPANIES.reduce((s, c) => s + c.cash_balance,     0),
  net_pl_monthly:   COMPANIES.reduce((s, c) => s + c.net_pl_monthly,   0),
  compliance_score: Math.round(
    COMPANIES.reduce((s, c) => s + c.compliance_score, 0) / COMPANIES.length
  ),
  employee_count:   COMPANIES.reduce((s, c) => s + c.employee_count,   0),
};
