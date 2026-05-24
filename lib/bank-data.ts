/**
 * Bank Statement — Types and Utilities
 * Sample data removed. Upload bank statements via Import to populate.
 */

export type AccountType = "current" | "savings" | "od" | "cc";

export type BankAccount = {
  id:                   string;
  account_name:         string;
  bank_name:            string;
  account_number_last4: string;
  account_type:         AccountType;
  currency:             "INR";
  opening_balance:      number;
  current_balance:      number;
  od_limit?:            number;
  is_primary:           boolean;
};

export type TxnCategory =
  | "customer_receipt"
  | "vendor_payment"
  | "payroll"
  | "tax_payment"
  | "bank_charges"
  | "interest_income"
  | "inter_account_transfer"
  | "other_debit"
  | "other_credit";

export type BankTransaction = {
  id:           string;
  account_id:   string;
  txn_date:     string;
  value_date:   string;
  description:  string;
  debit:        number;
  credit:       number;
  balance:      number;
  category:     TxnCategory;
  reference:    string | null;
  counterparty: string | null;
};

export type WeeklyCashflow = {
  week:    string;
  inflow:  number;
  outflow: number;
  net?:    number;
};

export type CategorySummary = {
  category:  TxnCategory;
  label:     string;
  total_out: number;
  color:     string;
};

// Empty — populated from real imported bank statements
export const BANK_ACCOUNTS:      BankAccount[]    = [];
export const BANK_TRANSACTIONS:  BankTransaction[] = [];
export const WEEKLY_CASHFLOW:    WeeklyCashflow[]  = [];
export const OUTFLOW_CATEGORIES: CategorySummary[] = [];

export const BANK_SUMMARY = {
  total_accounts: 0,
  total_balance:  0,
  apr_net_change: 0,
  may_net_change: 0,
};

export function getAccountTransactions(accountId: string): BankTransaction[] {
  return BANK_TRANSACTIONS
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));
}

export function accountById(id: string): BankAccount | undefined {
  return BANK_ACCOUNTS.find((a) => a.id === id);
}

export const CATEGORY_META: Record<TxnCategory, { label: string; badgeClass: string; isCredit: boolean }> = {
  customer_receipt:       { label: "Customer Receipt",  badgeClass: "bg-green-100 text-green-700 border-green-200",    isCredit: true  },
  vendor_payment:         { label: "Vendor Payment",    badgeClass: "bg-red-100 text-red-700 border-red-200",          isCredit: false },
  payroll:                { label: "Payroll",           badgeClass: "bg-rose-100 text-rose-700 border-rose-200",       isCredit: false },
  tax_payment:            { label: "Tax / Statutory",   badgeClass: "bg-orange-100 text-orange-700 border-orange-200", isCredit: false },
  bank_charges:           { label: "Bank Charges",      badgeClass: "bg-gray-100 text-gray-600 border-gray-200",       isCredit: false },
  interest_income:        { label: "Interest Income",   badgeClass: "bg-blue-100 text-blue-700 border-blue-200",       isCredit: true  },
  inter_account_transfer: { label: "Inter-Account",     badgeClass: "bg-purple-100 text-purple-700 border-purple-200", isCredit: false },
  other_debit:            { label: "Other Debit",       badgeClass: "bg-gray-100 text-gray-600 border-gray-200",       isCredit: false },
  other_credit:           { label: "Other Credit",      badgeClass: "bg-green-100 text-green-600 border-green-200",    isCredit: true  },
};

export { fmtAmt, fmtD } from "@/lib/payables-data";
