/**
 * parse-bank-statement — shared PDF bank statement parser.
 *
 * Used by both the Server Action (app/actions/parse-pdf.ts) and the
 * Route Handler (app/api/parse-pdf/route.ts) so there is a single
 * source of truth for the parsing logic.
 *
 * KEY FIX — "reference number fragments" bug:
 *   NEFT/RTGS descriptions like "IPAY/INST/NEFT/007721529111/578701010050451"
 *   contain numeric fragments ("721", "529", "578"…) that naive parsers treat
 *   as transaction amounts.  The fix is simple: the transaction amount is
 *   ALWAYS the second-to-last number on the line; the closing balance is
 *   ALWAYS the last number.  Everything before is description noise.
 *
 *   Old: debit = amounts[0]          — picks up "721" from reference "007721529111"
 *   New: debit = amounts[length - 2] — picks up the real amount before the balance
 */

import type { ParsedFile, RawRow } from "@/lib/import-utils";

// ─── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NUM: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Normalises a raw date string to YYYY-MM-DD */
export function normaliseDate(raw: string): string | null {
  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
  const m1 = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let y = m1[3];
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }
  // DD MMM YYYY  (02 Apr 2026)
  const m2 = raw.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})$/i);
  if (m2) {
    return `${m2[3]}-${MONTH_NUM[m2[2].toLowerCase()]}-${m2[1].padStart(2, "0")}`;
  }
  return null;
}

// ─── Amount extraction ─────────────────────────────────────────────────────────

/**
 * Extract ALL monetary amounts from a text string.
 *
 * Handles Indian format: 1,50,000.00 / 150000.00 / 150000
 * Filters n < 10 to skip day/month numbers embedded in dates.
 *
 * NOTE: this intentionally returns EVERY number ≥ 10, including fragments of
 * NEFT reference numbers.  The caller is responsible for picking the right
 * amount (second-to-last) rather than the first.
 */
export function extractAmounts(text: string): number[] {
  const matches = text.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) ?? [];
  return matches
    .map((s) => parseFloat(s.replace(/,/g, "")))
    .filter((n) => !isNaN(n) && n >= 10);
}

// ─── Transaction line patterns ─────────────────────────────────────────────────

// Ordered by specificity — try longest patterns first
export const DATE_PATTERNS: RegExp[] = [
  /^(\d{2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})\b/i,
  /^(\d{2}\/\d{2}\/\d{4})\b/,
  /^(\d{2}-\d{2}-\d{4})\b/,
  /^(\d{2}\.\d{2}\.\d{4})\b/,
  /^(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  /^(\d{2}\/\d{2}\/\d{2})\s/,
];

// Keywords that mark a HEADER row (not a transaction)
const HEADER_RE = /\b(date|narration|description|withdrawal|deposit|debit|credit|balance|particulars|chq|ref\.?\s*no|value\s+dt|trans\s*type)\b/i;

// DR/CR direction keywords
const IS_DEBIT  = /\b(dr|debit|withdrawal|payment|paid|neft\s+dr|upi\s+dr|imps\s+dr|rtgs\s+dr|atm|ecs\s+dr|pos\s+)\b/i;
const IS_CREDIT = /\b(cr|credit|deposit|received|neft\s+cr|upi\s+cr|imps\s+cr|rtgs\s+cr|salary|interest|refund|ecs\s+cr)\b/i;

// Regex that matches "properly formatted" amounts — Indian comma grouping
// OR a decimal with exactly 2 places.  Reference-number fragments like
// "721" (from "007721529111") do NOT match this pattern.
const FORMATTED_AMT_RE = /\b\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?\b|\b\d+\.\d{2}\b/g;

// ─── Main parser ───────────────────────────────────────────────────────────────

export function parseBankStatementText(text: string): ParsedFile {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const transactions: RawRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match date at the start of the line
    let dateRaw: string | null = null;
    let dateLen = 0;
    for (const pat of DATE_PATTERNS) {
      const m = line.match(pat);
      if (m) { dateRaw = m[1]; dateLen = m[0].length; break; }
    }
    if (!dateRaw) continue;

    // Skip header lines that happen to start with a date-like string
    const rest = line.slice(dateLen).trim();
    if (HEADER_RE.test(rest) && rest.split(/\s+/).length < 6) continue;

    const isoDate = normaliseDate(dateRaw);
    if (!isoDate) continue;

    // Merge next line if it continues the description (SBI / Axis value-date split)
    let fullLine = line;
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextHasDate = DATE_PATTERNS.some((p) => nextLine.match(p));
      if (!nextHasDate && /^[A-Za-z]/.test(nextLine) && nextLine.length < 60) {
        fullLine = line + " " + nextLine;
        i++;
      }
    }

    const afterDate = fullLine.slice(dateLen);
    const amounts   = extractAmounts(afterDate);

    // Need at least 2 amounts (transaction + balance)
    if (amounts.length < 2) continue;

    // Balance is always the LAST amount on the line.
    // Transaction amount is always the SECOND-TO-LAST — this is the key fix:
    //   amounts[0] through amounts[length-3] may be fragments from NEFT/RTGS
    //   reference numbers in the description (e.g. "007721529111" → "721").
    const balance = amounts[amounts.length - 1];
    const txnAmt  = amounts[amounts.length - 2];

    let debit  = 0;
    let credit = 0;

    if (IS_DEBIT.test(afterDate)) {
      debit = txnAmt;
    } else if (IS_CREDIT.test(afterDate)) {
      credit = txnAmt;
    } else {
      // No explicit DR/CR keyword — default to credit (matches HDFC omitted-column format)
      credit = txnAmt;
    }

    // ── Description extraction ──────────────────────────────────────────────
    // Find all "properly formatted" amounts (Indian comma groups or X.XX decimals).
    // Transaction amount and balance are always the last two such matches.
    // Description is everything before the second-to-last formatted amount.
    const fmtMatches = [...afterDate.matchAll(FORMATTED_AMT_RE)];

    let descEnd: number;
    if (fmtMatches.length >= 2) {
      // Position of the transaction amount (second-to-last formatted number)
      descEnd = fmtMatches[fmtMatches.length - 2].index ?? 0;
    } else if (fmtMatches.length === 1) {
      // Only the balance is formatted — take everything before it
      descEnd = fmtMatches[0].index ?? 0;
    } else {
      // No formatted amounts found — fall back to stripping all digit groups
      descEnd = -1;
    }

    const raw_desc = descEnd > 0
      ? afterDate.slice(0, descEnd)
      : afterDate.replace(/\d[\d,\.]+/g, "");

    const description = raw_desc
      .replace(/\s+/g, " ")
      .replace(/[|\/\\]+$/, "")   // trim trailing slashes/pipes
      .replace(/\s+(Dr|Cr|INR|USD)\b\.?/gi, "")  // strip trailing currency/DR/CR markers
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
