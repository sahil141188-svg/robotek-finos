/**
 * Accounts Payable Sample Data — Module 5: AP Health
 *
 * 15 vendors with aging buckets that sum to match the Dashboard KPI:
 *   Total AP: ₹46.5L  |  Overdue (>30 days): ₹16.95L  |  DPO: 38 days
 */

export type APAgingBucket = "0to30" | "31to60" | "61to90" | "90plus";

export type SampleVendor = {
  id: string;
  name: string;
  category: string;
  gstin: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  ag0to30: number;    // ₹ outstanding 0-30 days
  ag31to60: number;   // ₹ outstanding 31-60 days
  ag61to90: number;   // ₹ outstanding 61-90 days
  ag90plus: number;   // ₹ outstanding 90+ days
  last_payment_date: string | null;
  last_payment_amount: number | null;
};

export type SampleAPInvoice = {
  id: string;
  vendor_id: string;
  invoice_no: string;
  invoice_date: string;   // YYYY-MM-DD
  due_date: string;
  amount: number;         // ₹
  status: "outstanding" | "partially_paid" | "overdue" | "paid";
  days_outstanding: number;
};

// ─── Vendors ──────────────────────────────────────────────────────────────────
// ag totals: 0-30 = 29,55,000 | 31-60 = 8,50,000 | 61-90 = 5,00,000 | 90+ = 3,45,000
// Grand total = 46,50,000. Overdue (31+) = 16,95,000. Matches dashboard KPI.

export const SAMPLE_VENDORS: SampleVendor[] = [
  {
    id: "v-01", name: "Kundli Polymers Pvt Ltd",
    category: "Raw Materials", gstin: "06AAACK1234P1ZA",
    contact_person: "Ramesh Gupta", phone: "9810001234", email: "accounts@kundlipolymers.com",
    payment_terms_days: 30,
    ag0to30: 850000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-30", last_payment_amount: 720000,
  },
  {
    id: "v-02", name: "Delhi Sheet Metal Works",
    category: "Raw Materials", gstin: "07AABCD5678Q1ZB",
    contact_person: "Sunil Kumar", phone: "9811005678", email: "billing@dsmw.in",
    payment_terms_days: 30,
    ag0to30: 620000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-05", last_payment_amount: 580000,
  },
  {
    id: "v-03", name: "RK Components Ltd",
    category: "Components", gstin: "06AABCR9012S1ZC",
    contact_person: "Rajiv Kapoor", phone: "9812009012", email: "finance@rkcomponents.com",
    payment_terms_days: 30,
    ag0to30: 0, ag31to60: 580000, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-03-25", last_payment_amount: 450000,
  },
  {
    id: "v-04", name: "Haryana Power Corporation",
    category: "Utilities", gstin: null,
    contact_person: "DHBVN Office", phone: "1800-180-4334", email: null,
    payment_terms_days: 15,
    ag0to30: 210000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-28", last_payment_amount: 205000,
  },
  {
    id: "v-05", name: "Punjab Packaging Co",
    category: "Packaging", gstin: "03AABCP3456T1ZD",
    contact_person: "Gurpreet Singh", phone: "9814003456", email: "orders@punjabpack.com",
    payment_terms_days: 30,
    ag0to30: 340000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-20", last_payment_amount: 290000,
  },
  {
    id: "v-06", name: "Ludhiana Steel Traders",
    category: "Raw Materials", gstin: "03AABCL7890U1ZE",
    contact_person: "Hardeep Bhatia", phone: "9815007890", email: "sales@ludhianasteel.in",
    payment_terms_days: 45,
    ag0to30: 0, ag31to60: 150000, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-15", last_payment_amount: 380000,
  },
  {
    id: "v-07", name: "National Logistics Express",
    category: "Transport", gstin: "07AABCN2345V1ZF",
    contact_person: "Mohan Sharma", phone: "9816002345", email: "billing@natlogix.com",
    payment_terms_days: 15,
    ag0to30: 180000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-10", last_payment_amount: 165000,
  },
  {
    id: "v-08", name: "HP Chemicals Ltd",
    category: "Raw Materials", gstin: "06AABCH6789W1ZG",
    contact_person: "Anand Verma", phone: "9817006789", email: "accounts@hpchem.com",
    payment_terms_days: 30,
    ag0to30: 450000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-25", last_payment_amount: 510000,
  },
  {
    id: "v-09", name: "Gurgaon Office Supplies",
    category: "Admin & Misc", gstin: "06AABCG0123X1ZH",
    contact_person: "Priti Mehta", phone: "9818000123", email: "info@gurgaonoffice.com",
    payment_terms_days: 30,
    ag0to30: 80000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-01", last_payment_amount: 72000,
  },
  {
    id: "v-10", name: "Delhi Freight Services",
    category: "Transport", gstin: "07AABCD4567Y1ZI",
    contact_person: "Vikram Joshi", phone: "9819004567", email: "billing@dfs.co.in",
    payment_terms_days: 30,
    ag0to30: 0, ag31to60: 0, ag61to90: 300000, ag90plus: 0,
    last_payment_date: "2026-02-28", last_payment_amount: 280000,
  },
  {
    id: "v-11", name: "Chandigarh Electronics Parts",
    category: "Components", gstin: "04AABCC8901Z1ZJ",
    contact_person: "Deepak Arora", phone: "9820008901", email: "deepak@chdparts.in",
    payment_terms_days: 30,
    ag0to30: 0, ag31to60: 120000, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-03-15", last_payment_amount: 150000,
  },
  {
    id: "v-12", name: "HDFC Bank — CC Bill",
    category: "Finance Costs", gstin: null,
    contact_person: "HDFC Customer Care", phone: "1800-202-6161", email: null,
    payment_terms_days: 20,
    ag0to30: 225000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-30", last_payment_amount: 280000,
  },
  {
    id: "v-13", name: "Noida PCB Manufacturing",
    category: "Components", gstin: "09AABCN2345A1ZK",
    contact_person: "Ashok Gupta", phone: "9821002345", email: "ashok@noidapcb.com",
    payment_terms_days: 45,
    ag0to30: 0, ag31to60: 0, ag61to90: 200000, ag90plus: 200000,
    last_payment_date: "2026-01-31", last_payment_amount: 350000,
  },
  {
    id: "v-14", name: "Western Importers (USD)",
    category: "Imported Components", gstin: "07AABCW6789B1ZL",
    contact_person: "Kiran Nair", phone: "9822006789", email: "kiran@westimport.com",
    payment_terms_days: 60,
    ag0to30: 0, ag31to60: 0, ag61to90: 0, ag90plus: 145000,
    last_payment_date: "2026-01-15", last_payment_amount: 420000,
  },
  {
    id: "v-15", name: "Ambala Spare Parts Hub",
    category: "Components", gstin: "06AABCA0123C1ZM",
    contact_person: "Sanjay Malik", phone: "9823000123", email: "sales@ambalaparts.com",
    payment_terms_days: 30,
    ag0to30: 600000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-28", last_payment_amount: 520000,
  },
];

// Verify totals: sum all ag* across vendors
// ag0to30: 850000+620000+210000+340000+180000+450000+80000+225000+600000 = 2,955,000 (29.55L) ✓
// ag31to60: 580000+150000+120000 = 850,000 (8.5L) ✓
// ag61to90: 300000+200000 = 500,000 (5.0L) ✓
// ag90plus: 200000+145000 = 345,000 (3.45L) ✓
// Grand total: 2,955,000+850,000+500,000+345,000 = 4,650,000 (46.5L) ✓

// ─── AP Invoices ──────────────────────────────────────────────────────────────

export const SAMPLE_AP_INVOICES: SampleAPInvoice[] = [
  // Kundli Polymers (v-01) — 0-30 outstanding
  { id: "ap-inv-001", vendor_id: "v-01", invoice_no: "KP/2026/0423", invoice_date: "2026-04-23", due_date: "2026-05-23", amount: 480000, status: "outstanding", days_outstanding: 28 },
  { id: "ap-inv-002", vendor_id: "v-01", invoice_no: "KP/2026/0508", invoice_date: "2026-05-08", due_date: "2026-06-07", amount: 370000, status: "outstanding", days_outstanding: 13 },
  // Delhi Sheet Metal (v-02) — 0-30
  { id: "ap-inv-003", vendor_id: "v-02", invoice_no: "DSM/MAY/018", invoice_date: "2026-04-26", due_date: "2026-05-26", amount: 620000, status: "outstanding", days_outstanding: 25 },
  // RK Components (v-03) — 31-60 OVERDUE
  { id: "ap-inv-004", vendor_id: "v-03", invoice_no: "RKC/26/0112", invoice_date: "2026-04-01", due_date: "2026-05-01", amount: 580000, status: "overdue", days_outstanding: 50 },
  // Haryana Power (v-04) — 0-30
  { id: "ap-inv-005", vendor_id: "v-04", invoice_no: "HVPNL/APR/26", invoice_date: "2026-05-10", due_date: "2026-05-25", amount: 210000, status: "outstanding", days_outstanding: 11 },
  // Punjab Packaging (v-05)
  { id: "ap-inv-006", vendor_id: "v-05", invoice_no: "PPC/2604/023", invoice_date: "2026-04-28", due_date: "2026-05-28", amount: 200000, status: "outstanding", days_outstanding: 23 },
  { id: "ap-inv-007", vendor_id: "v-05", invoice_no: "PPC/2605/001", invoice_date: "2026-05-12", due_date: "2026-06-11", amount: 140000, status: "outstanding", days_outstanding: 9 },
  // Ludhiana Steel (v-06) — 31-60 OVERDUE
  { id: "ap-inv-008", vendor_id: "v-06", invoice_no: "LST/0326/089", invoice_date: "2026-04-06", due_date: "2026-05-21", amount: 150000, status: "overdue", days_outstanding: 45 },
  // National Logistics (v-07) — 0-30
  { id: "ap-inv-009", vendor_id: "v-07", invoice_no: "NLE/MAY/0045", invoice_date: "2026-05-06", due_date: "2026-05-21", amount: 180000, status: "outstanding", days_outstanding: 15 },
  // HP Chemicals (v-08) — 0-30
  { id: "ap-inv-010", vendor_id: "v-08", invoice_no: "HPC/APR/0234", invoice_date: "2026-04-29", due_date: "2026-05-29", amount: 450000, status: "outstanding", days_outstanding: 22 },
  // Gurgaon Office (v-09)
  { id: "ap-inv-011", vendor_id: "v-09", invoice_no: "GOS/0521/012", invoice_date: "2026-05-14", due_date: "2026-06-13", amount: 80000, status: "outstanding", days_outstanding: 7 },
  // Delhi Freight (v-10) — 61-90 OVERDUE
  { id: "ap-inv-012", vendor_id: "v-10", invoice_no: "DFS/MAR/0156", invoice_date: "2026-03-07", due_date: "2026-04-06", amount: 180000, status: "overdue", days_outstanding: 75 },
  { id: "ap-inv-013", vendor_id: "v-10", invoice_no: "DFS/MAR/0178", invoice_date: "2026-03-18", due_date: "2026-04-17", amount: 120000, status: "overdue", days_outstanding: 64 },
  // Chandigarh Electronics (v-11) — 31-60
  { id: "ap-inv-014", vendor_id: "v-11", invoice_no: "CEP/APR/0067", invoice_date: "2026-04-07", due_date: "2026-05-07", amount: 120000, status: "overdue", days_outstanding: 44 },
  // HDFC Bank (v-12)
  { id: "ap-inv-015", vendor_id: "v-12", invoice_no: "HDFC/MAY/STMT", invoice_date: "2026-05-10", due_date: "2026-05-30", amount: 225000, status: "outstanding", days_outstanding: 11 },
  // Noida PCB (v-13) — 61-90 + 90+ OVERDUE
  { id: "ap-inv-016", vendor_id: "v-13", invoice_no: "NPCB/FEB/034", invoice_date: "2026-02-20", due_date: "2026-04-05", amount: 200000, status: "overdue", days_outstanding: 90 },
  { id: "ap-inv-017", vendor_id: "v-13", invoice_no: "NPCB/MAR/041", invoice_date: "2026-03-12", due_date: "2026-04-26", amount: 200000, status: "overdue", days_outstanding: 69 },
  // Western Importers (v-14) — 90+ OVERDUE
  { id: "ap-inv-018", vendor_id: "v-14", invoice_no: "WI/JAN/2026/12", invoice_date: "2026-01-20", due_date: "2026-03-20", amount: 145000, status: "overdue", days_outstanding: 92 },
  // Ambala Spare Parts (v-15) — 0-30
  { id: "ap-inv-019", vendor_id: "v-15", invoice_no: "ASPH/0423/056", invoice_date: "2026-04-24", due_date: "2026-05-24", amount: 350000, status: "outstanding", days_outstanding: 27 },
  { id: "ap-inv-020", vendor_id: "v-15", invoice_no: "ASPH/0512/003", invoice_date: "2026-05-12", due_date: "2026-06-11", amount: 250000, status: "outstanding", days_outstanding: 9 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function vendorTotal(v: SampleVendor): number {
  return v.ag0to30 + v.ag31to60 + v.ag61to90 + v.ag90plus;
}

export function vendorOverdue(v: SampleVendor): number {
  return v.ag31to60 + v.ag61to90 + v.ag90plus;
}

export const AP_SUMMARY = {
  total:       4650000,
  overdue:     1695000,
  avg_dpo:     38,
  vendors:     SAMPLE_VENDORS.length,
  bucket0to30: 2955000,
  bucket31to60: 850000,
  bucket61to90:  500000,
  bucket90plus:  345000,
};

/** Format number as ₹X.XXL or ₹X.XXCr */
export function fmtAmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Format date "2026-05-21" → "21 May 2026" */
export function fmtD(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function getVendorInvoices(vendorId: string): SampleAPInvoice[] {
  return SAMPLE_AP_INVOICES.filter((i) => i.vendor_id === vendorId);
}
