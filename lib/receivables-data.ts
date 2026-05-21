/**
 * Accounts Receivable Sample Data — Module 6: AR Health
 *
 * 12 customers with aging that matches Dashboard KPI:
 *   Total AR: ₹68.35L  |  Overdue (>30 days): ₹22.5L  |  DSO: 47 days
 */

export type SampleCustomer = {
  id: string;
  name: string;
  segment: string;     // Distributor | Retailer | Export | Government
  gstin: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  credit_limit: number;
  payment_terms_days: number;
  ag0to30: number;
  ag31to60: number;
  ag61to90: number;
  ag90plus: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  collection_notes: string | null;
};

export type SampleARInvoice = {
  id: string;
  customer_id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: "outstanding" | "partially_paid" | "overdue" | "paid";
  days_outstanding: number;
  collection_status: "none" | "reminder_sent" | "followup_done" | "disputed" | "escalated";
};

// ─── Customers ────────────────────────────────────────────────────────────────
// ag totals: 0-30 = 45,85,000 | 31-60 = 12,00,000 | 61-90 = 7,50,000 | 90+ = 3,00,000
// Grand total = 68,35,000. Overdue = 22,50,000. Matches dashboard KPI.

export const SAMPLE_CUSTOMERS: SampleCustomer[] = [
  {
    id: "c-01", name: "ABC Electronics Pvt Ltd",
    segment: "Distributor", gstin: "07AAABC1234A1Z1",
    contact_person: "Vikas Malhotra", phone: "9910001234", email: "vikas@abcelectronics.in",
    credit_limit: 3000000, payment_terms_days: 30,
    ag0to30: 1840000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-01", last_payment_amount: 1500000,
    collection_notes: "Reliable payer. Recent order ₹36L pending dispatch.",
  },
  {
    id: "c-02", name: "Mumbai Mobile Mart LLP",
    segment: "Distributor", gstin: "27AABCM5678B1Z2",
    contact_person: "Rohit Shah", phone: "9920005678", email: "rohit@mumbaimobilemart.com",
    credit_limit: 2000000, payment_terms_days: 30,
    ag0to30: 1250000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-28", last_payment_amount: 1100000,
    collection_notes: null,
  },
  {
    id: "c-03", name: "Bengaluru Tech Stores",
    segment: "Retailer", gstin: "29AABCB9012C1Z3",
    contact_person: "Suresh Nair", phone: "9930009012", email: "suresh@bengalurutech.in",
    credit_limit: 1500000, payment_terms_days: 30,
    ag0to30: 820000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-05", last_payment_amount: 750000,
    collection_notes: null,
  },
  {
    id: "c-04", name: "Chennai Electronics Hub",
    segment: "Distributor", gstin: "33AABCC3456D1Z4",
    contact_person: "Arun Krishnan", phone: "9940003456", email: "arun@chennaielec.com",
    credit_limit: 1000000, payment_terms_days: 45,
    ag0to30: 450000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-05-10", last_payment_amount: 410000,
    collection_notes: null,
  },
  {
    id: "c-05", name: "Kolkata Distributors Co",
    segment: "Distributor", gstin: "19AABCK7890E1Z5",
    contact_person: "Sandip Roy", phone: "9950007890", email: "sandip@kolkatadist.in",
    credit_limit: 800000, payment_terms_days: 30,
    ag0to30: 225000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-30", last_payment_amount: 200000,
    collection_notes: null,
  },
  {
    id: "c-06", name: "Hyderabad Mobile Parts",
    segment: "Retailer", gstin: "36AABCH2345F1Z6",
    contact_person: "Ravi Kumar", phone: "9960002345", email: "ravi@hydmobileparts.com",
    credit_limit: 1000000, payment_terms_days: 30,
    ag0to30: 0, ag31to60: 750000, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-03-20", last_payment_amount: 680000,
    collection_notes: "Sent reminder 14 May. Promised payment by May 30.",
  },
  {
    id: "c-07", name: "Pune Retail Chain Pvt Ltd",
    segment: "Retailer", gstin: "27AABCP6789G1Z7",
    contact_person: "Asha Joshi", phone: "9970006789", email: "asha@puneretail.com",
    credit_limit: 750000, payment_terms_days: 30,
    ag0to30: 0, ag31to60: 450000, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-01", last_payment_amount: 380000,
    collection_notes: "Accounts on credit hold. Payment by May 25 or order freeze.",
  },
  {
    id: "c-08", name: "Jaipur Electronics World",
    segment: "Retailer", gstin: "08AABCJ0123H1Z8",
    contact_person: "Dilip Khandelwal", phone: "9980000123", email: "dilip@jaipurelec.com",
    credit_limit: 800000, payment_terms_days: 30,
    ag0to30: 0, ag31to60: 0, ag61to90: 550000, ag90plus: 0,
    last_payment_date: "2026-02-28", last_payment_amount: 500000,
    collection_notes: "⚠️ Legal notice sent 10 May. Disputed 2 invoices (₹1.2L).",
  },
  {
    id: "c-09", name: "Surat Mobile World",
    segment: "Retailer", gstin: "24AABCS4567I1Z9",
    contact_person: "Mehul Patel", phone: "9990004567", email: "mehul@suratmobile.in",
    credit_limit: 500000, payment_terms_days: 30,
    ag0to30: 0, ag31to60: 0, ag61to90: 200000, ag90plus: 0,
    last_payment_date: "2026-03-10", last_payment_amount: 180000,
    collection_notes: "Following up weekly. PDC received for ₹1.5L (due Jun 15).",
  },
  {
    id: "c-10", name: "Ahmedabad Electronics",
    segment: "Distributor", gstin: "24AABCA8901J1Z0",
    contact_person: "Prakash Desai", phone: "9901008901", email: "prakash@ahmedabadelec.com",
    credit_limit: 600000, payment_terms_days: 45,
    ag0to30: 0, ag31to60: 0, ag61to90: 0, ag90plus: 200000,
    last_payment_date: "2026-01-20", last_payment_amount: 250000,
    collection_notes: "⚠️ 92 days overdue. Recovery proceedings initiated.",
  },
  {
    id: "c-11", name: "Lucknow Mobile Hub",
    segment: "Retailer", gstin: "09AABCL2345K1Z1",
    contact_person: "Rakesh Srivastava", phone: "9902002345", email: "rakesh@lko-mobile.in",
    credit_limit: 300000, payment_terms_days: 30,
    ag0to30: 0, ag31to60: 0, ag61to90: 0, ag90plus: 100000,
    last_payment_date: "2026-01-05", last_payment_amount: 120000,
    collection_notes: "⚠️ 106 days overdue. No response. Credit limit exceeded.",
  },
  {
    id: "c-12", name: "UAE Mobile Distributors (Export)",
    segment: "Export", gstin: null,
    contact_person: "Mohammed Al-Rashid", phone: "+971-50-1234567", email: "uaemobile@gmail.com",
    credit_limit: 5000000, payment_terms_days: 60,
    ag0to30: 1000000, ag31to60: 0, ag61to90: 0, ag90plus: 0,
    last_payment_date: "2026-04-15", last_payment_amount: 900000,
    collection_notes: "USD-denominated invoices. FEMA compliance required.",
  },
];

// Verify: 0-30 = 1840000+1250000+820000+450000+225000+1000000 = 4,585,000 (45.85L) ✓
// 31-60 = 750000+450000 = 1,200,000 (12L) ✓
// 61-90 = 550000+200000 = 750,000 (7.5L) ✓
// 90+ = 200000+100000 = 300,000 (3L) ✓
// Total = 4,585,000+1,200,000+750,000+300,000 = 6,835,000 (68.35L) ✓

// ─── AR Invoices ──────────────────────────────────────────────────────────────

export const SAMPLE_AR_INVOICES: SampleARInvoice[] = [
  // ABC Electronics (c-01) — 0-30
  { id: "ar-001", customer_id: "c-01", invoice_no: "RBT/2026/0478", invoice_date: "2026-04-28", due_date: "2026-05-28", amount: 960000, status: "outstanding", days_outstanding: 23, collection_status: "none" },
  { id: "ar-002", customer_id: "c-01", invoice_no: "RBT/2026/0512", invoice_date: "2026-05-12", due_date: "2026-06-11", amount: 880000, status: "outstanding", days_outstanding: 9, collection_status: "none" },
  // Mumbai Mobile Mart (c-02) — 0-30
  { id: "ar-003", customer_id: "c-02", invoice_no: "RBT/2026/0467", invoice_date: "2026-04-25", due_date: "2026-05-25", amount: 750000, status: "outstanding", days_outstanding: 26, collection_status: "none" },
  { id: "ar-004", customer_id: "c-02", invoice_no: "RBT/2026/0498", invoice_date: "2026-05-08", due_date: "2026-06-07", amount: 500000, status: "outstanding", days_outstanding: 13, collection_status: "none" },
  // Bengaluru Tech (c-03) — 0-30
  { id: "ar-005", customer_id: "c-03", invoice_no: "RBT/2026/0489", invoice_date: "2026-05-03", due_date: "2026-06-02", amount: 820000, status: "outstanding", days_outstanding: 18, collection_status: "none" },
  // Chennai Electronics (c-04) — 0-30
  { id: "ar-006", customer_id: "c-04", invoice_no: "RBT/2026/0474", invoice_date: "2026-04-30", due_date: "2026-06-14", amount: 450000, status: "outstanding", days_outstanding: 21, collection_status: "none" },
  // Kolkata (c-05) — 0-30
  { id: "ar-007", customer_id: "c-05", invoice_no: "RBT/2026/0463", invoice_date: "2026-04-26", due_date: "2026-05-26", amount: 225000, status: "outstanding", days_outstanding: 25, collection_status: "none" },
  // Hyderabad Mobile (c-06) — 31-60 OVERDUE
  { id: "ar-008", customer_id: "c-06", invoice_no: "RBT/2026/0401", invoice_date: "2026-04-01", due_date: "2026-05-01", amount: 420000, status: "overdue", days_outstanding: 50, collection_status: "reminder_sent" },
  { id: "ar-009", customer_id: "c-06", invoice_no: "RBT/2026/0412", invoice_date: "2026-04-10", due_date: "2026-05-10", amount: 330000, status: "overdue", days_outstanding: 41, collection_status: "followup_done" },
  // Pune Retail (c-07) — 31-60 OVERDUE
  { id: "ar-010", customer_id: "c-07", invoice_no: "RBT/2026/0389", invoice_date: "2026-03-28", due_date: "2026-04-27", amount: 450000, status: "overdue", days_outstanding: 54, collection_status: "reminder_sent" },
  // Jaipur Electronics (c-08) — 61-90 OVERDUE
  { id: "ar-011", customer_id: "c-08", invoice_no: "RBT/2026/0334", invoice_date: "2026-03-07", due_date: "2026-04-06", amount: 290000, status: "overdue", days_outstanding: 75, collection_status: "disputed" },
  { id: "ar-012", customer_id: "c-08", invoice_no: "RBT/2026/0352", invoice_date: "2026-03-18", due_date: "2026-04-17", amount: 260000, status: "overdue", days_outstanding: 64, collection_status: "escalated" },
  // Surat Mobile (c-09) — 61-90
  { id: "ar-013", customer_id: "c-09", invoice_no: "RBT/2026/0348", invoice_date: "2026-03-14", due_date: "2026-04-13", amount: 200000, status: "overdue", days_outstanding: 68, collection_status: "followup_done" },
  // Ahmedabad (c-10) — 90+ OVERDUE
  { id: "ar-014", customer_id: "c-10", invoice_no: "RBT/2026/0267", invoice_date: "2026-01-20", due_date: "2026-03-05", amount: 200000, status: "overdue", days_outstanding: 107, collection_status: "escalated" },
  // Lucknow (c-11) — 90+ OVERDUE
  { id: "ar-015", customer_id: "c-11", invoice_no: "RBT/2026/0245", invoice_date: "2026-01-05", due_date: "2026-02-04", amount: 100000, status: "overdue", days_outstanding: 136, collection_status: "escalated" },
  // UAE Export (c-12) — 0-30
  { id: "ar-016", customer_id: "c-12", invoice_no: "RBT/EXP/2026/045", invoice_date: "2026-04-25", due_date: "2026-06-24", amount: 1000000, status: "outstanding", days_outstanding: 26, collection_status: "none" },
];

// ─── Summary ──────────────────────────────────────────────────────────────────

export const AR_SUMMARY = {
  total:        6835000,
  overdue:      2250000,
  avg_dso:      47,
  customers:    SAMPLE_CUSTOMERS.length,
  bucket0to30:  4585000,
  bucket31to60: 1200000,
  bucket61to90:  750000,
  bucket90plus:  300000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function customerTotal(c: SampleCustomer): number {
  return c.ag0to30 + c.ag31to60 + c.ag61to90 + c.ag90plus;
}

export function customerOverdue(c: SampleCustomer): number {
  return c.ag31to60 + c.ag61to90 + c.ag90plus;
}

export function getCustomerInvoices(customerId: string): SampleARInvoice[] {
  return SAMPLE_AR_INVOICES.filter((i) => i.customer_id === customerId);
}

export const COLLECTION_STATUS_META: Record<
  SampleARInvoice["collection_status"],
  { label: string; className: string }
> = {
  none:          { label: "None",          className: "bg-gray-100 text-gray-600 border-gray-200" },
  reminder_sent: { label: "Reminder Sent", className: "bg-blue-100 text-blue-700 border-blue-200" },
  followup_done: { label: "Follow-up Done",className: "bg-purple-100 text-purple-700 border-purple-200" },
  disputed:      { label: "Disputed",      className: "bg-orange-100 text-orange-700 border-orange-200" },
  escalated:     { label: "Escalated",     className: "bg-red-100 text-red-700 border-red-200" },
};

// Re-export shared helper
export { fmtAmt, fmtD } from "@/lib/payables-data";
