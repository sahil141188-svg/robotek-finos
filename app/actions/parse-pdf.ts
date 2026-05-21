"use server";

/**
 * parsePDFBankStatement — Server Action
 *
 * Runs on Node.js (server-side only). Uses pdf-parse to extract text from a
 * digital bank statement PDF, then finds transaction lines using date + amount
 * heuristics common across Indian bank statement formats:
 *   HDFC, SBI, Axis Bank, ICICI, Kotak, Yes Bank, IndusInd
 *
 * Returns a ParsedFile identical in shape to what parseExcelFile returns, so
 * the rest of the import wizard (column mapper → validate → import) works
 * without any changes.
 *
 * Import this action from the "use client" import page and call it for PDFs.
 */

// pdf-parse v2 — listed in serverExternalPackages so it runs on Node.js only.
import { PDFParse } from "pdf-parse";

import type { ParsedFile, RawRow } from "@/lib/import-utils";

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_NUM: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Normalises a raw date string to YYYY-MM-DD */
function normaliseDate(raw: string): string | null {
  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
  const m1 = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    const d  = m1[1];
    const mo = m1[2];
    let   y  = m1[3];
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD MMM YYYY  (02 Apr 2026)
  const m2 = raw.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})$/i);
  if (m2) {
    const [, d, mon, y] = m2;
    return `${y}-${MONTH_NUM[mon.toLowerCase()]}-${d.padStart(2, "0")}`;
  }
  return null;
}

// ─── Amount extraction ────────────────────────────────────────────────────────

/**
 * Extracts all monetary amounts from a text string.
 * Handles Indian format: 1,50,000.00 or 150000.00 or 150000
 * Filters out numbers that look like dates or short reference numbers.
 */
function extractAmounts(text: string): number[] {
  // Match: optionally starts with digit, commas for thousands, optional decimal
  const matches = text.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) ?? [];
  return matches
    .map((s) => parseFloat(s.replace(/,/g, "")))
    .filter((n) => !isNaN(n) && n >= 10); // ≥ 10 to skip day/month numbers
}

// ─── Transaction line detection ───────────────────────────────────────────────

// Ordered by specificity — try longest patterns first
const DATE_PATTERNS: RegExp[] = [
  /^(\d{2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})\b/i, // DD MMM YYYY
  /^(\d{2}\/\d{2}\/\d{4})\b/,    // DD/MM/YYYY
  /^(\d{2}-\d{2}-\d{4})\b/,      // DD-MM-YYYY
  /^(\d{2}\.\d{2}\.\d{4})\b/,    // DD.MM.YYYY
  /^(\d{1,2}\/\d{1,2}\/\d{4})\b/, // D/M/YYYY
  /^(\d{2}\/\d{2}\/\d{2})\s/,    // DD/MM/YY
];

// Keywords that indicate a HEADER row (not a transaction)
const HEADER_RE = /\b(date|narration|description|withdrawal|deposit|debit|credit|balance|particulars|chq|ref\.?\s*no|value\s+dt|trans\s*type)\b/i;

// DR/CR keyword indicators in the narration
const IS_DEBIT  = /\b(dr|debit|withdrawal|payment|paid|neft\s+dr|upi\s+dr|imps\s+dr|rtgs\s+dr|atm|ecs\s+dr|pos\s+)\b/i;
const IS_CREDIT = /\b(cr|credit|deposit|received|neft\s+cr|upi\s+cr|imps\s+cr|rtgs\s+cr|salary|interest|refund|ecs\s+cr)\b/i;

// ─── Main parser ──────────────────────────────────────────────────────────────

function parseBankStatementText(text: string): ParsedFile {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const transactions: RawRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match date at the start of the line
    let dateRaw: string | null = null;
    let dateLen  = 0;
    for (const pat of DATE_PATTERNS) {
      const m = line.match(pat);
      if (m) {
        dateRaw = m[1];
        dateLen = m[0].length;
        break;
      }
    }
    if (!dateRaw) continue;

    // Skip header lines that happen to start with a date-like string
    const rest = line.slice(dateLen).trim();
    if (HEADER_RE.test(rest) && rest.split(/\s+/).length < 6) continue;

    const isoDate = normaliseDate(dateRaw);
    if (!isoDate) continue;

    // Sometimes SBI / Axis split value date onto the same line — merge next line
    // if it continues the description (starts with a letter, not a date)
    let fullLine = line;
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextHasDate = DATE_PATTERNS.some((p) => nextLine.match(p));
      if (!nextHasDate && /^[A-Za-z]/.test(nextLine) && nextLine.length < 60) {
        fullLine = line + " " + nextLine;
        i++; // skip the merged line in the next iteration
      }
    }

    // Extract amounts from everything after the date
    const afterDate = fullLine.slice(dateLen);
    const amounts   = extractAmounts(afterDate);

    // Need at least 1 amount to be a real transaction
    if (amounts.length === 0) continue;

    // Heuristic: the closing balance is the last amount on the line
    const balance = amounts[amounts.length - 1];

    let debit  = 0;
    let credit = 0;

    if (amounts.length >= 3) {
      // Three-column format: [dr_amount, cr_amount, balance]
      // One of the first two will be 0 in reality, but since extractAmounts
      // filters ≥10, a zero column won't appear — use keyword to decide
      if (IS_DEBIT.test(afterDate)) {
        debit  = amounts[0];
      } else if (IS_CREDIT.test(afterDate)) {
        credit = amounts[0];
      } else {
        // Ambiguous: first amount is the transaction; second + third are cr + bal
        // OR first is dr, second is bal — use previous balance comparison if possible
        // Default: treat amounts[0] as debit if no clear indicator
        debit  = amounts[0];
        credit = amounts[1];
      }
    } else if (amounts.length === 2) {
      // [transaction_amount, balance]
      const txnAmt = amounts[0];
      if (IS_CREDIT.test(afterDate)) {
        credit = txnAmt;
      } else if (IS_DEBIT.test(afterDate)) {
        debit = txnAmt;
      } else {
        // Default to credit (common in HDFC format where blank column is omitted)
        credit = txnAmt;
      }
    } else {
      // Single amount — could be just the balance line, skip
      continue;
    }

    // Extract description — text between date and first number
    const firstNumPos = afterDate.search(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/);
    const raw_desc = firstNumPos > 2
      ? afterDate.slice(0, firstNumPos)
      : afterDate.replace(/\d[\d,\.]+/g, "");

    const description = raw_desc
      .replace(/\s+/g, " ")
      .replace(/[|\/\\]+/g, " ")
      .trim();

    if (description.length < 2) continue;

    transactions.push({
      Date:        isoDate,
      Description: description,
      Debit:       debit  > 0 ? debit  : "",
      Credit:      credit > 0 ? credit : "",
      Balance:     balance,
    });
  }

  return {
    headers:   ["Date", "Description", "Debit", "Credit", "Balance"],
    rows:      transactions,
    sheetName: "Bank Statement (PDF)",
    totalRows: transactions.length,
  };
}

// ─── Server action (exported) ─────────────────────────────────────────────────

export async function parsePDFBankStatement(formData: FormData): Promise<{
  success: boolean;
  data?:   ParsedFile;
  error?:  string;
  pages?:  number;
}> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided." };

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let text: string;
    let numpages: number;
    try {
      // PDFParse v2 API: new PDFParse({ data: Uint8Array }) then .getText()
      const parser = new PDFParse({ data: uint8 });
      const result = await parser.getText();
      text     = result.text;
      numpages = result.total;
      await parser.destroy();
    } catch {
      return {
        success: false,
        error:
          "Could not read the PDF. Make sure it is a digital (not scanned/image) bank statement. " +
          "If scanned, download the PDF from your bank's internet banking portal instead.",
      };
    }

    if (!text || text.trim().length < 50) {
      return {
        success: false,
        error:
          "This PDF appears to be image-based (scanned). We can only parse text-based PDFs. " +
          "Download a fresh statement from your bank's net banking or mobile app.",
      };
    }

    const parsed = parseBankStatementText(text);

    if (parsed.totalRows === 0) {
      return {
        success: false,
        error:
          `Extracted ${numpages} page(s) of text but found no transaction rows. ` +
          "Your bank may use a custom format. Try exporting as Excel/CSV from net banking, " +
          "or contact support with a sample statement so we can add support for your bank.",
      };
    }

    return { success: true, data: parsed, pages: numpages };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error parsing PDF.",
    };
  }
}
