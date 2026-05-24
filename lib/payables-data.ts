/**
 * Accounts Payable — Types and Utilities
 * Sample data removed. Upload AP data via Import to populate.
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
  ag0to30: number;
  ag31to60: number;
  ag61to90: number;
  ag90plus: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
};

export type SampleAPInvoice = {
  id: string;
  vendor_id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: "outstanding" | "partially_paid" | "overdue" | "paid";
  days_outstanding: number;
};

// Empty — populated from real imported data
export const SAMPLE_VENDORS: SampleVendor[] = [];
export const SAMPLE_AP_INVOICES: SampleAPInvoice[] = [];

export const AP_SUMMARY = {
  total:        0,
  overdue:      0,
  avg_dpo:      0,
  vendors:      0,
  bucket0to30:  0,
  bucket31to60: 0,
  bucket61to90: 0,
  bucket90plus: 0,
};

export function vendorTotal(v: SampleVendor): number {
  return v.ag0to30 + v.ag31to60 + v.ag61to90 + v.ag90plus;
}

export function vendorOverdue(v: SampleVendor): number {
  return v.ag31to60 + v.ag61to90 + v.ag90plus;
}

/** Format number as Indian notation: ₹X.XXL / ₹X.XX Cr */
export function fmtAmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Format ISO date "2026-05-21" → "21 May 2026" */
export function fmtD(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function getVendorInvoices(vendorId: string): SampleAPInvoice[] {
  return SAMPLE_AP_INVOICES.filter((i) => i.vendor_id === vendorId);
}
