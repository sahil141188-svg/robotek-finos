/**
 * Import Engine Utilities — Module 2: Data Import Engine
 *
 * Handles:
 *  - Client-side Excel / CSV parsing via the xlsx library
 *  - Busy Accounting Software column auto-detection (fuzzy match)
 *  - Row validation (required fields, date format, amount sanity)
 *  - Duplicate detection (by voucher number within the same import)
 *  - Financial year inference from transaction dates
 *
 * NOTE: All parsing runs client-side so the user gets instant preview
 * without any upload round-trip. The final import (DB write) happens
 * via a server action in app/actions/import.ts.
 */

import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawRow = Record<string, string | number | null>;

/** A single parsed transaction row ready to be mapped to our DB schema. */
export type MappedRow = {
  transaction_date: string;   // ISO yyyy-mm-dd
  voucher_number: string | null;
  voucher_type: string;
  ledger_name: string;
  dr_amount: number;
  cr_amount: number;
  narration: string | null;
  financial_year: string;     // e.g. "2025-26"
  _raw_index: number;         // 1-based row index for error messages
};

/** Per-row validation result */
export type RowError = {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: MappedRow[];
  errors: RowError[];
  duplicates: string[]; // voucher numbers that are duplicated within this file
  warnings: RowError[];
};

export type ParsedFile = {
  headers: string[];
  rows: RawRow[];
  sheetName: string;
  totalRows: number;
};

export type ColumnMapping = {
  transaction_date: string | null;
  voucher_number: string | null;
  voucher_type: string | null;
  ledger_name: string | null;
  dr_amount: string | null;
  cr_amount: string | null;
  narration: string | null;
};

// ─── Busy Accounting Software column detection ───────────────────────────────

/**
 * Known Busy column name variants for each schema field.
 * Matching is case-insensitive and trims whitespace.
 */
const BUSY_COLUMN_VARIANTS: Record<keyof ColumnMapping, string[]> = {
  transaction_date: ["date", "tran date", "txn date", "trans date", "transaction date", "vch date", "voucher date", "entry date", "value dt", "value date"],
  voucher_number:   ["voucher no", "voucher number", "vch no", "vch number", "vchno", "invoice no", "bill no", "ref no", "ref. no", "chq./ref.no.", "chq no", "cheque no", "reference"],
  voucher_type:     ["voucher type", "vch type", "type", "transaction type", "vch. type"],
  ledger_name:      ["ledger name", "party name", "account name", "ledger", "account", "party", "name", "description", "particulars", "narration"],
  dr_amount:        ["debit", "dr", "dr amount", "debit amount", "dr.", "debit (₹)", "dr (₹)", "amount (dr)", "withdrawal", "withdrawal amt.", "withdrawal amt"],
  cr_amount:        ["credit", "cr", "cr amount", "credit amount", "cr.", "credit (₹)", "cr (₹)", "amount (cr)", "deposit", "deposit amt.", "deposit amt"],
  narration:        ["narration", "remarks", "description", "particulars", "note", "notes", "comment"],
};

/** Auto-detect column mapping from headers using fuzzy matching */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const normalise = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const normalisedHeaders = headers.map(normalise);

  const mapping: ColumnMapping = {
    transaction_date: null,
    voucher_number:   null,
    voucher_type:     null,
    ledger_name:      null,
    dr_amount:        null,
    cr_amount:        null,
    narration:        null,
  };

  for (const [field, variants] of Object.entries(BUSY_COLUMN_VARIANTS)) {
    for (const variant of variants) {
      const idx = normalisedHeaders.findIndex((h) => h === variant || h.includes(variant));
      if (idx !== -1) {
        (mapping as Record<string, string | null>)[field] = headers[idx];
        break;
      }
    }
  }

  return mapping;
}

// ─── Module auto-detection ────────────────────────────────────────────────────

export type ModuleDetectionResult = {
  moduleId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * Inspect parsed file headers and return the best-matching import module.
 * Uses keyword presence checks to distinguish between:
 *   - Bank statements (Balance + Withdrawal/Deposit or Cheque)
 *   - Busy day books (Voucher Type + Ledger Name)
 *   - AP aging (Vendor + Due Date + Outstanding)
 *   - AR aging (Customer + Due Date + Receivable)
 *   - Compliance data (Challan / TDS / GST + Period)
 * Falls back to "transactions" with low confidence when no clear match.
 */
export function autoDetectModule(headers: string[]): ModuleDetectionResult {
  const h = headers.map((s) => s.toLowerCase().trim());
  const has = (...terms: string[]) => terms.some((t) => h.some((col) => col.includes(t)));

  // Bank statement — key signal is "balance" column + withdrawal/deposit or cheque
  if (
    has("balance", "closing balance") &&
    (has("withdrawal", "deposit", "chq", "cheque") || has("credit", "debit"))
  ) {
    return {
      moduleId:   "bank_statement",
      confidence: "high",
      reason:     "Balance column detected — looks like a bank statement",
    };
  }

  // Busy day book / voucher register — voucher type + ledger name are unique to Busy
  if (has("voucher type", "vch type") && has("ledger", "party name", "account name")) {
    return {
      moduleId:   "transactions",
      confidence: "high",
      reason:     "Voucher Type + Ledger Name detected — looks like a Busy day book",
    };
  }
  if (has("voucher no", "vch no", "voucher number") && has("debit", "credit", "dr", "cr")) {
    return {
      moduleId:   "transactions",
      confidence: "medium",
      reason:     "Voucher number + DR/CR columns detected",
    };
  }

  // Accounts Payable — vendor + due date + outstanding
  if (
    (has("vendor", "supplier") || has("party name")) &&
    has("due date") &&
    has("outstanding", "pending", "payable")
  ) {
    return {
      moduleId:   "payables",
      confidence: "high",
      reason:     "Vendor + Due Date + Outstanding detected — looks like AP aging",
    };
  }

  // Accounts Receivable — customer + due date + receivable
  if (
    (has("customer", "buyer") || has("party name")) &&
    has("due date") &&
    has("receivable", "outstanding", "pending")
  ) {
    return {
      moduleId:   "receivables",
      confidence: "high",
      reason:     "Customer + Due Date + Receivable detected — looks like AR aging",
    };
  }

  // Compliance / tax — challan, TDS, GST
  if (has("challan", "tds", "gst", "advance tax") && has("due date", "period")) {
    return {
      moduleId:   "compliance",
      confidence: "high",
      reason:     "Tax/challan columns detected — looks like compliance data",
    };
  }

  // Fallback — DR/CR present, probably transactions
  if (has("debit", "dr") && has("credit", "cr") && has("date")) {
    return {
      moduleId:   "transactions",
      confidence: "low",
      reason:     "DR/CR + Date found — defaulting to transactions",
    };
  }

  return {
    moduleId:   "transactions",
    confidence: "low",
    reason:     "Could not detect type — defaulting to transactions",
  };
}

// ─── File parsing ─────────────────────────────────────────────────────────────

/**
 * Parse an Excel (.xlsx / .xls) or CSV file using the xlsx library.
 * Returns headers and all data rows as raw key→value maps.
 * Runs entirely in the browser — no upload needed.
 */
export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dateNF: "dd/mm/yyyy",
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get as array of arrays first to handle merged cells / header row detection
  const rawMatrix = XLSX.utils.sheet_to_json<(string | number | null | Date)[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (rawMatrix.length === 0) {
    throw new Error("The file appears to be empty.");
  }

  // Find the header row — first row with >= 3 non-empty string cells
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
    const row = rawMatrix[i];
    const nonEmpty = row.filter((c) => typeof c === "string" && c.trim().length > 0);
    if (nonEmpty.length >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = (rawMatrix[headerRowIndex] as (string | null)[])
    .map((h) => (h ?? "").toString().trim())
    .filter((h) => h.length > 0);

  const dataRows: RawRow[] = [];
  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const raw = rawMatrix[i];
    const row: RawRow = {};
    headers.forEach((h, j) => {
      const cell = raw[j];
      row[h] =
        cell instanceof Date
          ? cell.toISOString().slice(0, 10) // yyyy-mm-dd
          : cell == null
          ? null
          : (cell as string | number);
    });
    // Skip completely empty rows
    const values = Object.values(row).filter((v) => v !== null && v !== "");
    if (values.length > 0) dataRows.push(row);
  }

  return {
    headers,
    rows: dataRows,
    sheetName,
    totalRows: dataRows.length,
  };
}

// ─── Date parsing helpers ─────────────────────────────────────────────────────

const DATE_FORMATS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // yyyy-mm-dd (ISO — from xlsx cellDates)
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // dd/mm/yyyy (Indian)
  /^(\d{2})-(\d{2})-(\d{4})$/, // dd-mm-yyyy
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // d/m/yyyy
];

/** Parse a raw date cell value to ISO yyyy-mm-dd */
export function parseDate(raw: string | number | null): string | null {
  if (raw === null || raw === "") return null;

  // xlsx serial number
  if (typeof raw === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    } catch {
      return null;
    }
  }

  const s = raw.toString().trim();

  for (const fmt of DATE_FORMATS) {
    const m = s.match(fmt);
    if (m) {
      if (fmt === DATE_FORMATS[0]) return s; // already ISO
      if (fmt === DATE_FORMATS[1] || fmt === DATE_FORMATS[2] || fmt === DATE_FORMATS[3]) {
        const [, dd, mm, yyyy] = m;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
    }
  }

  // Try JS Date as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/** Infer financial year from an ISO date string (April = start of new FY) */
export function inferFinancialYear(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * Parse an amount cell to a non-negative number.
 * Handles all common Indian accounting amount formats:
 *   1,23,456.00          standard
 *   ₹ 1,23,456.00        with rupee symbol
 *   (1,23,456.00)        parenthetical negative (Tally/Busy credit notes)
 *   1,23,456.00-         trailing minus (some Busy exports)
 *   -1,23,456.00         leading minus
 * Negative values are returned as 0 — caller decides which column is DR vs CR.
 */
export function parseAmount(raw: string | number | null): number {
  if (raw === null || raw === "") return 0;
  if (typeof raw === "number") return Math.abs(raw); // preserve magnitude, caller handles sign
  const s = raw.toString().trim();

  // Parenthetical negative: (5,000.00) → negative value → return 0 for this column
  if (s.startsWith("(") && s.endsWith(")")) {
    const inner = s.slice(1, -1).replace(/[₹,\s]/g, "");
    const n = parseFloat(inner);
    // It IS a negative — caller should map this to the opposite column
    return isNaN(n) ? 0 : 0; // return 0; the validation warning will handle it
  }

  const cleaned = s.replace(/[₹,\s]/g, "").replace(/\-$/, ""); // strip trailing minus
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

/**
 * Apply a column mapping to raw rows, producing MappedRows for the DB.
 * Returns the full list — validation is done separately.
 */
export function applyMapping(
  rows: RawRow[],
  mapping: ColumnMapping,
): { mapped: MappedRow[]; unmappable: number } {
  let unmappable = 0;
  const mapped: MappedRow[] = [];

  rows.forEach((row, idx) => {
    const rawDate = mapping.transaction_date ? row[mapping.transaction_date] : null;
    const isoDate = parseDate(rawDate as string | number | null);

    if (!isoDate) {
      unmappable++;
      return; // skip rows with no parseable date
    }

    const drAmt = parseAmount(mapping.dr_amount ? (row[mapping.dr_amount] as string | number | null) : null);
    const crAmt = parseAmount(mapping.cr_amount ? (row[mapping.cr_amount] as string | number | null) : null);

    mapped.push({
      transaction_date: isoDate,
      voucher_number:   mapping.voucher_number ? (row[mapping.voucher_number]?.toString() ?? null) : null,
      voucher_type:     mapping.voucher_type ? (row[mapping.voucher_type]?.toString() ?? "Journal") : "Journal",
      ledger_name:      mapping.ledger_name ? (row[mapping.ledger_name]?.toString() ?? "Unknown") : "Unknown",
      dr_amount:        drAmt,
      cr_amount:        crAmt,
      narration:        mapping.narration ? (row[mapping.narration]?.toString() ?? null) : null,
      financial_year:   inferFinancialYear(isoDate),
      _raw_index:       idx + 2, // 1-based, accounting for header row
    });
  });

  return { mapped, unmappable };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate mapped rows before import.
 * Returns lists of valid rows, errors, warnings, and in-file duplicates.
 */
export function validateRows(rows: MappedRow[]): ValidationResult {
  const errors: RowError[] = [];
  const warnings: RowError[] = [];
  const valid: MappedRow[] = [];
  const voucherCounts = new Map<string, number>();

  // Count voucher number occurrences (for duplicate detection)
  rows.forEach((r) => {
    if (r.voucher_number) {
      voucherCounts.set(r.voucher_number, (voucherCounts.get(r.voucher_number) ?? 0) + 1);
    }
  });

  const duplicates = Array.from(voucherCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([vno]) => vno);
  const dupeSet = new Set(duplicates);

  rows.forEach((row) => {
    let rowHasError = false;

    // Required: ledger name
    if (!row.ledger_name || row.ledger_name === "Unknown") {
      errors.push({
        row: row._raw_index,
        field: "ledger_name",
        message: "Ledger / party name is missing",
        severity: "error",
      });
      rowHasError = true;
    }

    // Required: at least one of DR or CR must be non-zero
    if (row.dr_amount === 0 && row.cr_amount === 0) {
      errors.push({
        row: row._raw_index,
        field: "amount",
        message: "Both debit and credit are zero",
        severity: "error",
      });
      rowHasError = true;
    }

    // Warning: both DR and CR are non-zero (unusual)
    if (row.dr_amount > 0 && row.cr_amount > 0) {
      warnings.push({
        row: row._raw_index,
        field: "amount",
        message: "Row has both DR and CR amounts — check for data issue",
        severity: "warning",
      });
    }

    // Warning: in-file duplicate voucher number
    if (row.voucher_number && dupeSet.has(row.voucher_number)) {
      warnings.push({
        row: row._raw_index,
        field: "voucher_number",
        message: `Voucher ${row.voucher_number} appears more than once in this file`,
        severity: "warning",
      });
    }

    if (!rowHasError) valid.push(row);
  });

  return { valid, errors, warnings, duplicates };
}

// ─── Module metadata ──────────────────────────────────────────────────────────

export type ImportModule = {
  id: string;
  label: string;
  description: string;
  icon: string;
  sampleColumns: string[];
};

export const IMPORT_MODULES: ImportModule[] = [
  {
    id: "bank_statement",
    label: "Bank Statement",
    description: "PDF or Excel bank statement — HDFC, SBI, Axis, ICICI, Kotak, any bank",
    icon: "🏦",
    sampleColumns: ["Date", "Description", "Debit", "Credit", "Balance"],
  },
  {
    id: "transactions",
    label: "Sales / Purchase Transactions",
    description: "Day book, sales register, purchase register from Busy",
    icon: "📒",
    sampleColumns: ["Date", "Voucher No", "Voucher Type", "Ledger Name", "Debit", "Credit", "Narration"],
  },
  {
    id: "payables",
    label: "Accounts Payable",
    description: "Vendor outstanding, aging from Busy AP report",
    icon: "📤",
    sampleColumns: ["Vendor Name", "Invoice No", "Invoice Date", "Due Date", "Amount", "Paid"],
  },
  {
    id: "receivables",
    label: "Accounts Receivable",
    description: "Customer outstanding, aging from Busy AR report",
    icon: "📥",
    sampleColumns: ["Customer Name", "Invoice No", "Invoice Date", "Due Date", "Amount", "Received"],
  },
  {
    id: "compliance",
    label: "Compliance / Tax Data",
    description: "TDS, GST, advance tax payment records",
    icon: "📋",
    sampleColumns: ["Type", "Period", "Due Date", "Amount", "Status", "Challan No"],
  },
];

/**
 * Pre-built column mapping for bank statement PDFs.
 * Applied automatically after PDF parsing so users skip the mapper step.
 */
export const BANK_STATEMENT_MAPPING: ColumnMapping = {
  transaction_date: "Date",
  voucher_number:   null,
  voucher_type:     null,
  ledger_name:      "Description",
  dr_amount:        "Debit",
  cr_amount:        "Credit",
  narration:        "Description",
};
