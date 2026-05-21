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
    short_name:      "Robotek India",
    type:            "Manufacturing — Mobile Accessories",
    city:            "Kundli, Haryana",
    gstin:           "06AABCR1234A1Z5",
    color_class:     "bg-brand-red",
    status:          "active",
    monthly_revenue:  18250000,
    ap_outstanding:   4650000,
    ar_outstanding:   6835000,
    cash_balance:     5579000,    // matches actual bank accounts total
    net_pl_monthly:   2840000,
    compliance_score: 84,
    employee_count:   500,
  },
  {
    id:              "comp-02",
    name:            "Robotek Electronics Mfg Ltd",
    short_name:      "Robotek Electronics",
    type:            "Manufacturing — PCB & Components",
    city:            "Manesar, Haryana",
    gstin:           "06AABCR5678B1Z2",
    color_class:     "bg-blue-600",
    status:          "active",
    monthly_revenue:  9420000,
    ap_outstanding:   2280000,
    ar_outstanding:   3560000,
    cash_balance:     1840000,
    net_pl_monthly:   1230000,
    compliance_score: 91,
    employee_count:   220,
  },
  {
    id:              "comp-03",
    name:            "Robotek Trading Pvt Ltd",
    short_name:      "Robotek Trading",
    type:            "Distribution & Wholesale",
    city:            "Delhi",
    gstin:           "07AABCR9012C1Z8",
    color_class:     "bg-emerald-600",
    status:          "active",
    monthly_revenue:  6875000,
    ap_outstanding:   1820000,
    ar_outstanding:   2940000,
    cash_balance:     1260000,
    net_pl_monthly:    890000,
    compliance_score: 78,
    employee_count:   85,
  },
  {
    id:              "comp-04",
    name:            "Robotek Exports Pvt Ltd",
    short_name:      "Robotek Exports",
    type:            "Export — International Trade",
    city:            "New Delhi",
    gstin:           "07AABCR3456D1Z4",
    color_class:     "bg-purple-600",
    status:          "active",
    monthly_revenue:  14500000,
    ap_outstanding:   3150000,
    ar_outstanding:   8200000,
    cash_balance:     2873000,
    net_pl_monthly:   1980000,
    compliance_score: 88,
    employee_count:   65,
  },
  {
    id:              "comp-05",
    name:            "Robotek Logistics Ltd",
    short_name:      "Robotek Logistics",
    type:            "Supply Chain & Transport",
    city:            "Sonipat, Haryana",
    gstin:           "06AABCR7890E1Z0",
    color_class:     "bg-orange-600",
    status:          "active",
    monthly_revenue:  3840000,
    ap_outstanding:   1460000,
    ar_outstanding:   2230000,
    cash_balance:      980000,
    net_pl_monthly:    520000,
    compliance_score: 72,
    employee_count:   180,
  },
  {
    id:              "comp-06",
    name:            "Robotek Consumer Products Ltd",
    short_name:      "Robotek Consumer",
    type:            "FMCG — White-label Accessories",
    city:            "Faridabad, Haryana",
    gstin:           "06AABCR2345F1Z6",
    color_class:     "bg-pink-600",
    status:          "active",
    monthly_revenue:  5230000,
    ap_outstanding:   1140000,
    ar_outstanding:   1870000,
    cash_balance:      750000,
    net_pl_monthly:    680000,
    compliance_score: 81,
    employee_count:   130,
  },
  {
    id:              "comp-07",
    name:            "Robotek Properties Pvt Ltd",
    short_name:      "Robotek Properties",
    type:            "Real Estate & Infrastructure",
    city:            "Gurugram, Haryana",
    gstin:           "06AABCR6789G1Z9",
    color_class:     "bg-teal-600",
    status:          "active",
    monthly_revenue:   850000,
    ap_outstanding:    420000,
    ar_outstanding:    680000,
    cash_balance:     2240000,
    net_pl_monthly:    410000,
    compliance_score: 95,
    employee_count:   12,
  },
  {
    id:              "comp-08",
    name:            "Robotek Digital Services Pvt Ltd",
    short_name:      "Robotek Digital",
    type:            "IT Services & Software",
    city:            "Gurugram, Haryana",
    gstin:           "06AABCR0123H1Z3",
    color_class:     "bg-indigo-600",
    status:          "active",
    monthly_revenue:  2260000,
    ap_outstanding:    380000,
    ar_outstanding:   1450000,
    cash_balance:      820000,
    net_pl_monthly:    740000,
    compliance_score: 92,
    employee_count:   45,
  },
  {
    id:              "comp-09",
    name:            "Robotek Power Solutions Ltd",
    short_name:      "Robotek Power",
    type:            "Solar Energy & Power Backup",
    city:            "Kundli, Haryana",
    gstin:           "06AABCR4567I1Z7",
    color_class:     "bg-yellow-600",
    status:          "active",
    monthly_revenue:  1680000,
    ap_outstanding:    890000,
    ar_outstanding:   1240000,
    cash_balance:      560000,
    net_pl_monthly:    320000,
    compliance_score: 68,
    employee_count:   35,
  },
  {
    id:              "comp-10",
    name:            "Robotek Finance Ltd",
    short_name:      "Robotek Finance",
    type:            "NBFC — Group Treasury",
    city:            "New Delhi",
    gstin:           "07AABCR8901J1Z1",
    color_class:     "bg-slate-600",
    status:          "dormant",
    monthly_revenue:   420000,
    ap_outstanding:    150000,
    ar_outstanding:    800000,
    cash_balance:     4200000,
    net_pl_monthly:    280000,
    compliance_score: 100,
    employee_count:   8,
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
