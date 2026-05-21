/**
 * Bank Statement Sample Data — Module 8: Bank Statement Dashboard
 *
 * 3 accounts covering Apr–May 2026 (today = May 22 2026).
 * Reflects real Robotek India cash flows: AP payments, AR receipts,
 * payroll, taxes, inter-account transfers.
 *
 * Total liquidity May 22: ₹55.79L across all 3 accounts.
 */

export type AccountType = "current" | "savings" | "od" | "cc";

export type BankAccount = {
  id:                   string;
  account_name:         string;
  bank_name:            string;
  account_number_last4: string;
  account_type:         AccountType;
  currency:             "INR";
  opening_balance:      number;    // Apr 1, 2026
  current_balance:      number;    // May 22, 2026
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
  balance:      number;    // running balance after txn
  category:     TxnCategory;
  reference:    string | null;
  counterparty: string | null;
};

// ─── Accounts ─────────────────────────────────────────────────────────────────
// Closing balances verified from transaction history below

export const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "ba-01", account_name: "HDFC Bank — Operations Current",
    bank_name: "HDFC Bank", account_number_last4: "1234", account_type: "current",
    currency: "INR", opening_balance: 2850000, current_balance: 1106500, is_primary: true,
  },
  {
    id: "ba-02", account_name: "State Bank of India — OD Account",
    bank_name: "State Bank of India", account_number_last4: "5678", account_type: "od",
    currency: "INR", opening_balance: 1200000, current_balance: 1600000,
    od_limit: 5000000, is_primary: false,
  },
  {
    id: "ba-03", account_name: "Axis Bank — Export Receipts Current",
    bank_name: "Axis Bank", account_number_last4: "9012", account_type: "current",
    currency: "INR", opening_balance: 520000, current_balance: 2872800, is_primary: false,
  },
];

// ─── Transactions ─────────────────────────────────────────────────────────────

export const BANK_TRANSACTIONS: BankTransaction[] = [

  // ── HDFC (ba-01) — April ─────────────────────────────────────────────────
  // Opening: 28,50,000  →  April closing: 16,13,000  →  May 22 closing: 11,06,500
  { id: "bt-001", account_id: "ba-01", txn_date: "2026-04-02", value_date: "2026-04-02", description: "NEFT CR — ABC ELECTRONICS PVT LTD", debit: 0, credit: 1500000, balance: 4350000, category: "customer_receipt", reference: "NEFT26093012345", counterparty: "ABC Electronics Pvt Ltd" },
  { id: "bt-002", account_id: "ba-01", txn_date: "2026-04-03", value_date: "2026-04-03", description: "NEFT DR — KUNDLI POLYMERS PVT LTD", debit: 720000, credit: 0, balance: 3630000, category: "vendor_payment", reference: "NEFT26094056789", counterparty: "Kundli Polymers Pvt Ltd" },
  { id: "bt-003", account_id: "ba-01", txn_date: "2026-04-05", value_date: "2026-04-05", description: "SALARY DISBURSEMENT APR 2026 — ROBOTEK INDIA", debit: 850000, credit: 0, balance: 2780000, category: "payroll", reference: "SAL-APR-2026", counterparty: null },
  { id: "bt-004", account_id: "ba-01", txn_date: "2026-04-07", value_date: "2026-04-07", description: "NEFT DR — INCOME TAX DEPT — TDS DEPOSIT MAR-26", debit: 125000, credit: 0, balance: 2655000, category: "tax_payment", reference: "TDS-MAR26", counterparty: "Income Tax Dept" },
  { id: "bt-005", account_id: "ba-01", txn_date: "2026-04-08", value_date: "2026-04-08", description: "RTGS CR — MUMBAI MOBILE MART LLP", debit: 0, credit: 1100000, balance: 3755000, category: "customer_receipt", reference: "RTGS26098112233", counterparty: "Mumbai Mobile Mart LLP" },
  { id: "bt-006", account_id: "ba-01", txn_date: "2026-04-10", value_date: "2026-04-10", description: "NEFT DR — DELHI SHEET METAL WORKS", debit: 580000, credit: 0, balance: 3175000, category: "vendor_payment", reference: "NEFT26100234567", counterparty: "Delhi Sheet Metal Works" },
  { id: "bt-007", account_id: "ba-01", txn_date: "2026-04-12", value_date: "2026-04-12", description: "NEFT CR — BENGALURU TECH STORES", debit: 0, credit: 750000, balance: 3925000, category: "customer_receipt", reference: "NEFT26102345678", counterparty: "Bengaluru Tech Stores" },
  { id: "bt-008", account_id: "ba-01", txn_date: "2026-04-15", value_date: "2026-04-15", description: "PF + ESI DEPOSIT APR 2026 — EPFO/ESIC", debit: 280000, credit: 0, balance: 3645000, category: "tax_payment", reference: "PF-APR26", counterparty: "EPFO/ESIC" },
  { id: "bt-009", account_id: "ba-01", txn_date: "2026-04-16", value_date: "2026-04-16", description: "NEFT DR — INCOME TAX DEPT — TCS DEPOSIT MAR-26", debit: 45000, credit: 0, balance: 3600000, category: "tax_payment", reference: "TCS-MAR26", counterparty: "Income Tax Dept" },
  { id: "bt-010", account_id: "ba-01", txn_date: "2026-04-18", value_date: "2026-04-18", description: "NEFT DR — HP CHEMICALS LTD", debit: 510000, credit: 0, balance: 3090000, category: "vendor_payment", reference: "NEFT26108456789", counterparty: "HP Chemicals Ltd" },
  { id: "bt-011", account_id: "ba-01", txn_date: "2026-04-20", value_date: "2026-04-20", description: "NEFT/RTGS PROCESSING CHARGES APR-2026", debit: 12000, credit: 0, balance: 3078000, category: "bank_charges", reference: null, counterparty: "HDFC Bank" },
  { id: "bt-012", account_id: "ba-01", txn_date: "2026-04-22", value_date: "2026-04-22", description: "NEFT CR — CHENNAI ELECTRONICS HUB", debit: 0, credit: 410000, balance: 3488000, category: "customer_receipt", reference: "NEFT26112567890", counterparty: "Chennai Electronics Hub" },
  { id: "bt-013", account_id: "ba-01", txn_date: "2026-04-25", value_date: "2026-04-25", description: "NEFT DR — PUNJAB PACKAGING CO", debit: 290000, credit: 0, balance: 3198000, category: "vendor_payment", reference: "NEFT26115678901", counterparty: "Punjab Packaging Co" },
  { id: "bt-014", account_id: "ba-01", txn_date: "2026-04-28", value_date: "2026-04-28", description: "IMPS TRANSFER OWN ACCT — AXIS BANK XXXX-9012", debit: 1000000, credit: 0, balance: 2198000, category: "inter_account_transfer", reference: "IMPS26118789012", counterparty: "Own Account — Axis XXXX-9012" },
  { id: "bt-015", account_id: "ba-01", txn_date: "2026-04-30", value_date: "2026-04-30", description: "NEFT DR — HARYANA POWER CORPORATION", debit: 205000, credit: 0, balance: 1993000, category: "vendor_payment", reference: "NEFT26120890123", counterparty: "Haryana Power Corporation" },
  { id: "bt-016", account_id: "ba-01", txn_date: "2026-04-30", value_date: "2026-04-30", description: "NEFT DR — GSTN — GSTR-3B PAYMENT APR-2026", debit: 380000, credit: 0, balance: 1613000, category: "tax_payment", reference: "GST-APR26-3B", counterparty: "GSTN" },

  // ── HDFC (ba-01) — May ───────────────────────────────────────────────────
  { id: "bt-017", account_id: "ba-01", txn_date: "2026-05-02", value_date: "2026-05-02", description: "NEFT CR — KOLKATA DISTRIBUTORS CO", debit: 0, credit: 200000, balance: 1813000, category: "customer_receipt", reference: "NEFT26122901234", counterparty: "Kolkata Distributors Co" },
  { id: "bt-018", account_id: "ba-01", txn_date: "2026-05-05", value_date: "2026-05-05", description: "SALARY DISBURSEMENT MAY 2026 — ROBOTEK INDIA", debit: 850000, credit: 0, balance: 963000, category: "payroll", reference: "SAL-MAY-2026", counterparty: null },
  { id: "bt-019", account_id: "ba-01", txn_date: "2026-05-06", value_date: "2026-05-06", description: "NEFT DR — NATIONAL LOGISTICS EXPRESS", debit: 165000, credit: 0, balance: 798000, category: "vendor_payment", reference: "NEFT26126012345", counterparty: "National Logistics Express" },
  { id: "bt-020", account_id: "ba-01", txn_date: "2026-05-07", value_date: "2026-05-07", description: "NEFT DR — INCOME TAX DEPT — TDS DEPOSIT APR-26", debit: 120000, credit: 0, balance: 678000, category: "tax_payment", reference: "TDS-APR26", counterparty: "Income Tax Dept" },
  { id: "bt-021", account_id: "ba-01", txn_date: "2026-05-08", value_date: "2026-05-08", description: "RTGS CR — ABC ELECTRONICS PVT LTD", debit: 0, credit: 960000, balance: 1638000, category: "customer_receipt", reference: "RTGS26128123456", counterparty: "ABC Electronics Pvt Ltd" },
  { id: "bt-022", account_id: "ba-01", txn_date: "2026-05-10", value_date: "2026-05-10", description: "NEFT DR — HP CHEMICALS LTD", debit: 450000, credit: 0, balance: 1188000, category: "vendor_payment", reference: "NEFT26130234567", counterparty: "HP Chemicals Ltd" },
  { id: "bt-023", account_id: "ba-01", txn_date: "2026-05-14", value_date: "2026-05-14", description: "A/C MAINTENANCE + SMS ALERT CHARGES MAY-26", debit: 8500, credit: 0, balance: 1179500, category: "bank_charges", reference: null, counterparty: "HDFC Bank" },
  { id: "bt-024", account_id: "ba-01", txn_date: "2026-05-15", value_date: "2026-05-15", description: "NEFT DR — INCOME TAX DEPT — TCS DEPOSIT APR-26", debit: 38000, credit: 0, balance: 1141500, category: "tax_payment", reference: "TCS-APR26", counterparty: "Income Tax Dept" },
  { id: "bt-025", account_id: "ba-01", txn_date: "2026-05-16", value_date: "2026-05-16", description: "PF + ESI DEPOSIT MAY 2026 — EPFO/ESIC", debit: 280000, credit: 0, balance: 861500, category: "tax_payment", reference: "PF-MAY26", counterparty: "EPFO/ESIC" },
  { id: "bt-026", account_id: "ba-01", txn_date: "2026-05-18", value_date: "2026-05-18", description: "RTGS CR — MUMBAI MOBILE MART LLP", debit: 0, credit: 750000, balance: 1611500, category: "customer_receipt", reference: "RTGS26138345678", counterparty: "Mumbai Mobile Mart LLP" },
  { id: "bt-027", account_id: "ba-01", txn_date: "2026-05-20", value_date: "2026-05-20", description: "NEFT DR — AMBALA SPARE PARTS HUB", debit: 520000, credit: 0, balance: 1091500, category: "vendor_payment", reference: "NEFT26140456789", counterparty: "Ambala Spare Parts Hub" },
  { id: "bt-028", account_id: "ba-01", txn_date: "2026-05-21", value_date: "2026-05-21", description: "INTEREST CREDIT — QUARTERLY INT MAY-2026", debit: 0, credit: 15000, balance: 1106500, category: "interest_income", reference: null, counterparty: "HDFC Bank" },

  // ── SBI OD (ba-02) — April ───────────────────────────────────────────────
  // Opening: 12,00,000  →  April closing: 18,62,000  →  May 22 closing: 16,00,000
  { id: "bt-029", account_id: "ba-02", txn_date: "2026-04-05", value_date: "2026-04-05", description: "IMPS DR — TRANSFER TO HDFC XXXX-1234 — WC SUPPORT", debit: 500000, credit: 0, balance: 700000, category: "inter_account_transfer", reference: "IMPS26095112345", counterparty: "Own Account — HDFC XXXX-1234" },
  { id: "bt-030", account_id: "ba-02", txn_date: "2026-04-20", value_date: "2026-04-20", description: "NEFT CR — HYDERABAD MOBILE PARTS — PART PMT", debit: 0, credit: 680000, balance: 1380000, category: "customer_receipt", reference: "NEFT26110678901", counterparty: "Hyderabad Mobile Parts" },
  { id: "bt-031", account_id: "ba-02", txn_date: "2026-04-30", value_date: "2026-04-30", description: "OD INTEREST CHARGE APR-2026", debit: 18000, credit: 0, balance: 1362000, category: "bank_charges", reference: null, counterparty: "State Bank of India" },
  { id: "bt-032", account_id: "ba-02", txn_date: "2026-04-30", value_date: "2026-04-30", description: "IMPS CR — REPAYMENT — HDFC XXXX-1234", debit: 0, credit: 500000, balance: 1862000, category: "inter_account_transfer", reference: "IMPS26120234567", counterparty: "Own Account — HDFC XXXX-1234" },

  // ── SBI OD (ba-02) — May ─────────────────────────────────────────────────
  { id: "bt-033", account_id: "ba-02", txn_date: "2026-05-03", value_date: "2026-05-03", description: "NEFT DR — RK COMPONENTS LTD — PART PMT", debit: 320000, credit: 0, balance: 1542000, category: "vendor_payment", reference: "NEFT26123345678", counterparty: "RK Components Ltd" },
  { id: "bt-034", account_id: "ba-02", txn_date: "2026-05-15", value_date: "2026-05-15", description: "NEFT CR — PUNE RETAIL CHAIN PVT LTD", debit: 0, credit: 380000, balance: 1922000, category: "customer_receipt", reference: "NEFT26135456789", counterparty: "Pune Retail Chain Pvt Ltd" },
  { id: "bt-035", account_id: "ba-02", txn_date: "2026-05-20", value_date: "2026-05-20", description: "NEFT DR — LUDHIANA STEEL TRADERS", debit: 380000, credit: 0, balance: 1542000, category: "vendor_payment", reference: "NEFT26140567890", counterparty: "Ludhiana Steel Traders" },
  { id: "bt-036", account_id: "ba-02", txn_date: "2026-05-21", value_date: "2026-05-21", description: "INTEREST CREDIT — SBI SAVINGS INT MAY-2026", debit: 0, credit: 58000, balance: 1600000, category: "interest_income", reference: null, counterparty: "State Bank of India" },

  // ── Axis (ba-03) — April ─────────────────────────────────────────────────
  // Opening: 5,20,000  →  April closing: 29,02,000  →  May 22 closing: 28,72,800
  { id: "bt-037", account_id: "ba-03", txn_date: "2026-04-14", value_date: "2026-04-14", description: "SWIFT CR — UAE MOBILE DISTRIBUTORS — EXPORT PMT", debit: 0, credit: 900000, balance: 1420000, category: "customer_receipt", reference: "SWIFT2026-045", counterparty: "UAE Mobile Distributors" },
  { id: "bt-038", account_id: "ba-03", txn_date: "2026-04-20", value_date: "2026-04-20", description: "NEFT CR — JAIPUR ELECTRONICS WORLD — PART PMT", debit: 0, credit: 500000, balance: 1920000, category: "customer_receipt", reference: "NEFT26110789012", counterparty: "Jaipur Electronics World" },
  { id: "bt-039", account_id: "ba-03", txn_date: "2026-04-28", value_date: "2026-04-28", description: "IMPS CR — TRANSFER OWN ACCT — HDFC XXXX-1234", debit: 0, credit: 1000000, balance: 2920000, category: "inter_account_transfer", reference: "IMPS26118789012", counterparty: "Own Account — HDFC XXXX-1234" },
  { id: "bt-040", account_id: "ba-03", txn_date: "2026-04-30", value_date: "2026-04-30", description: "FOREX COMMISSION — USD CONVERSION CHARGES", debit: 18000, credit: 0, balance: 2902000, category: "bank_charges", reference: null, counterparty: "Axis Bank" },

  // ── Axis (ba-03) — May ───────────────────────────────────────────────────
  { id: "bt-041", account_id: "ba-03", txn_date: "2026-05-01", value_date: "2026-05-01", description: "NEFT DR — NOIDA PCB MANUFACTURING — PART PMT", debit: 350000, credit: 0, balance: 2552000, category: "vendor_payment", reference: "NEFT26121890123", counterparty: "Noida PCB Manufacturing" },
  { id: "bt-042", account_id: "ba-03", txn_date: "2026-05-10", value_date: "2026-05-10", description: "NEFT DR — WESTERN IMPORTERS USD — OVERDUE PMT", debit: 420000, credit: 0, balance: 2132000, category: "vendor_payment", reference: "NEFT26130901234", counterparty: "Western Importers (USD)" },
  { id: "bt-043", account_id: "ba-03", txn_date: "2026-05-12", value_date: "2026-05-12", description: "SWIFT CR — UAE MOBILE DISTRIBUTORS — ADV PMT", debit: 0, credit: 1000000, balance: 3132000, category: "customer_receipt", reference: "SWIFT2026-046", counterparty: "UAE Mobile Distributors" },
  { id: "bt-044", account_id: "ba-03", txn_date: "2026-05-14", value_date: "2026-05-14", description: "NEFT DR — DELHI FREIGHT SERVICES — PART PMT", debit: 280000, credit: 0, balance: 2852000, category: "vendor_payment", reference: "NEFT26134012345", counterparty: "Delhi Freight Services" },
  { id: "bt-045", account_id: "ba-03", txn_date: "2026-05-15", value_date: "2026-05-15", description: "NEFT DR — CHANDIGARH ELECTRONICS PARTS", debit: 150000, credit: 0, balance: 2702000, category: "vendor_payment", reference: "NEFT26135123456", counterparty: "Chandigarh Electronics Parts" },
  { id: "bt-046", account_id: "ba-03", txn_date: "2026-05-18", value_date: "2026-05-18", description: "NEFT CR — SURAT MOBILE WORLD — PART PMT", debit: 0, credit: 180000, balance: 2882000, category: "customer_receipt", reference: "NEFT26138234567", counterparty: "Surat Mobile World" },
  { id: "bt-047", account_id: "ba-03", txn_date: "2026-05-20", value_date: "2026-05-20", description: "AXIS BANK PROCESSING CHARGES MAY-2026", debit: 9200, credit: 0, balance: 2872800, category: "bank_charges", reference: null, counterparty: "Axis Bank" },
];

// ─── Summary ─────────────────────────────────────────────────────────────────
// Total liquidity May 22: 1,106,500 + 1,600,000 + 2,872,800 = 5,579,300 (₹55.79L)

export const BANK_SUMMARY = {
  total_accounts:  3,
  total_balance:   5579300,     // ₹55.79L
  apr_net_change:  -1688000,    // opening 45.7L → Apr 30: 47L  (net of all accounts)
  may_net_change:  -120700,     // Apr 30 → May 22 (net across all accounts)
};

// ─── Weekly Cash Flow for Chart ───────────────────────────────────────────────

export type WeeklyCashflow = {
  week:    string;
  inflow:  number;
  outflow: number;
  net:     number;
};

export const WEEKLY_CASHFLOW: WeeklyCashflow[] = [
  { week: "Apr W1", inflow: 2600000, outflow: 1695000, net:   905000 },
  { week: "Apr W2", inflow: 1850000, outflow:  905000, net:   945000 },
  { week: "Apr W3", inflow: 1590000, outflow:  557000, net:  1033000 },
  { week: "Apr W4", inflow: 1910000, outflow: 2893000, net:  -983000 },
  { week: "May W1", inflow:  200000, outflow: 1135000, net:  -935000 },
  { week: "May W2", inflow: 2160000, outflow:  976500, net:  1183500 },
  { week: "May W3", inflow: 2308000, outflow: 1729200, net:   578800 },
];

// ─── Category breakdown for chart ────────────────────────────────────────────

export type CategorySummary = {
  category:  TxnCategory;
  label:     string;
  total_out: number;
  color:     string;
};

export const OUTFLOW_CATEGORIES: CategorySummary[] = [
  { category: "vendor_payment",         label: "Vendor Payments", total_out: 6170000, color: "#E52D31" },
  { category: "payroll",                label: "Payroll",         total_out: 1700000, color: "#852321" },
  { category: "tax_payment",            label: "Tax & Statutory", total_out: 1006000, color: "#f97316" },
  { category: "inter_account_transfer", label: "Inter-Account",   total_out:  500000, color: "#3b82f6" },
  { category: "bank_charges",           label: "Bank Charges",    total_out:   57700, color: "#9A9596" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAccountTransactions(accountId: string): BankTransaction[] {
  return BANK_TRANSACTIONS
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));
}

export function accountById(id: string): BankAccount | undefined {
  return BANK_ACCOUNTS.find((a) => a.id === id);
}

export const CATEGORY_META: Record<TxnCategory, { label: string; badgeClass: string; isCredit: boolean }> = {
  customer_receipt:       { label: "Customer Receipt",  badgeClass: "bg-green-100 text-green-700 border-green-200",   isCredit: true  },
  vendor_payment:         { label: "Vendor Payment",    badgeClass: "bg-red-100 text-red-700 border-red-200",         isCredit: false },
  payroll:                { label: "Payroll",           badgeClass: "bg-rose-100 text-rose-700 border-rose-200",      isCredit: false },
  tax_payment:            { label: "Tax / Statutory",   badgeClass: "bg-orange-100 text-orange-700 border-orange-200",isCredit: false },
  bank_charges:           { label: "Bank Charges",      badgeClass: "bg-gray-100 text-gray-600 border-gray-200",      isCredit: false },
  interest_income:        { label: "Interest Income",   badgeClass: "bg-blue-100 text-blue-700 border-blue-200",      isCredit: true  },
  inter_account_transfer: { label: "Inter-Account",     badgeClass: "bg-purple-100 text-purple-700 border-purple-200",isCredit: false },
  other_debit:            { label: "Other Debit",       badgeClass: "bg-gray-100 text-gray-600 border-gray-200",      isCredit: false },
  other_credit:           { label: "Other Credit",      badgeClass: "bg-green-100 text-green-600 border-green-200",   isCredit: true  },
};

/** Format INR in Lakh/Crore notation */
export { fmtAmt, fmtD } from "@/lib/payables-data";
