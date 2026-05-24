/**
 * Accounts Receivable — Types and Utilities
 * Sample data removed. Upload AR data via Import to populate.
 */

export type SampleCustomer = {
  id: string;
  name: string;
  category: string;
  segment?: string | null;
  gstin: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  credit_limit: number;
  credit_days: number;
  payment_terms_days?: number;
  ag0to30: number;
  ag31to60: number;
  ag61to90: number;
  ag90plus: number;
  last_receipt_date: string | null;
  last_receipt_amount: number | null;
  last_payment_date?: string | null;
  last_payment_amount?: number | null;
  collection_notes?: string | null;
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
  collection_status?: string | null;
};

// Empty — populated from real imported data
export const SAMPLE_CUSTOMERS: SampleCustomer[] = [];
export const SAMPLE_AR_INVOICES: SampleARInvoice[] = [];

export const AR_SUMMARY = {
  total:        0,
  overdue:      0,
  avg_dso:      0,
  customers:    0,
  bucket0to30:  0,
  bucket31to60: 0,
  bucket61to90: 0,
  bucket90plus: 0,
};

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
  "outstanding" | "partially_paid" | "overdue" | "paid",
  { label: string; className: string }
> = {
  outstanding:     { label: "Outstanding",     className: "bg-yellow-100 text-yellow-800" },
  partially_paid:  { label: "Partial",         className: "bg-blue-100 text-blue-800" },
  overdue:         { label: "Overdue",         className: "bg-red-100 text-red-700" },
  paid:            { label: "Paid",            className: "bg-green-100 text-green-700" },
};

export { fmtAmt, fmtD } from "@/lib/payables-data";
