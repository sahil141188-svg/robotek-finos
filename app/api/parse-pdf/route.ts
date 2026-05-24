/**
 * POST /api/parse-pdf
 *
 * Route Handler that receives a raw PDF binary body and returns parsed
 * bank statement data as JSON.
 *
 * WHY a Route Handler instead of a Server Action:
 *   Server Actions use JSON-encoded bodies which hit Next.js/Turbopack's
 *   body-parser limit (~10 MB in dev) regardless of `bodySizeLimit` config.
 *   Route Handlers receive the raw HTTP body directly via req.arrayBuffer(),
 *   bypassing that limit. On Vercel production, large PDFs (up to 100 MB)
 *   upload successfully through this endpoint.
 *
 * Client usage:
 *   const res = await fetch('/api/parse-pdf', {
 *     method: 'POST',
 *     body: file,
 *     headers: { 'x-file-name': file.name },
 *   });
 *   const result = await res.json();
 */

import { NextRequest, NextResponse } from "next/server";
import type { ParsedFile, RawRow } from "@/lib/import-utils";
import type { BankAccountMetadata } from "@/app/actions/parsers/types";
import { extractBankAccountMetadata } from "@/app/actions/parsers";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Route segment config — disable body parsing so we can read raw binary
export const dynamic = "force-dynamic";

// ─── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_NUM: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normaliseDate(raw: string): string | null {
  const m1 = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let y = m1[3];
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }
  const m2 = raw.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})$/i);
  if (m2) {
    return `${m2[3]}-${MONTH_NUM[m2[2].toLowerCase()]}-${m2[1].padStart(2, "0")}`;
  }
  return null;
}

function extractAmounts(text: string): number[] {
  const matches = text.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/g) ?? [];
  return matches
    .map((s) => parseFloat(s.replace(/,/g, "")))
    .filter((n) => !isNaN(n) && n >= 10);
}

const DATE_PATTERNS: RegExp[] = [
  /^(\d{2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})\b/i,
  /^(\d{2}\/\d{2}\/\d{4})\b/,
  /^(\d{2}-\d{2}-\d{4})\b/,
  /^(\d{2}\.\d{2}\.\d{4})\b/,
  /^(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  /^(\d{2}\/\d{2}\/\d{2})\s/,
];

const HEADER_RE = /\b(date|narration|description|withdrawal|deposit|debit|credit|balance|particulars|chq|ref\.?\s*no|value\s+dt|trans\s*type)\b/i;
const IS_DEBIT  = /\b(dr|debit|withdrawal|payment|paid|neft\s+dr|upi\s+dr|imps\s+dr|rtgs\s+dr|atm|ecs\s+dr|pos\s+)\b/i;
const IS_CREDIT = /\b(cr|credit|deposit|received|neft\s+cr|upi\s+cr|imps\s+cr|rtgs\s+cr|salary|interest|refund|ecs\s+cr)\b/i;

function parseBankStatementText(text: string): ParsedFile {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
  const transactions: RawRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let dateRaw: string | null = null;
    let dateLen = 0;
    for (const pat of DATE_PATTERNS) {
      const m = line.match(pat);
      if (m) { dateRaw = m[1]; dateLen = m[0].length; break; }
    }
    if (!dateRaw) continue;

    const rest = line.slice(dateLen).trim();
    if (HEADER_RE.test(rest) && rest.split(/\s+/).length < 6) continue;

    const isoDate = normaliseDate(dateRaw);
    if (!isoDate) continue;

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
    if (amounts.length === 0) continue;

    const balance = amounts[amounts.length - 1];
    let debit = 0, credit = 0;

    if (amounts.length >= 3) {
      if (IS_DEBIT.test(afterDate))        debit  = amounts[0];
      else if (IS_CREDIT.test(afterDate))  credit = amounts[0];
      else                                  debit  = amounts[0];
    } else if (amounts.length === 2) {
      const txnAmt = amounts[0];
      if (IS_CREDIT.test(afterDate))       credit = txnAmt;
      else if (IS_DEBIT.test(afterDate))   debit  = txnAmt;
      else                                  credit = txnAmt;
    } else {
      continue;
    }

    const firstNumPos = afterDate.search(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/);
    const raw_desc = firstNumPos > 2
      ? afterDate.slice(0, firstNumPos)
      : afterDate.replace(/\d[\d,\.]+/g, "");
    const description = raw_desc.replace(/\s+/g, " ").replace(/[|\/\\]+/g, " ").trim();
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

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const fileName = req.headers.get("x-file-name") ?? "upload.pdf";

    // Read raw binary body — no JSON parsing, no busboy, no body-size-limit config
    const arrayBuffer = await req.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const uint8       = new Uint8Array(buffer);

    if (buffer.byteLength === 0) {
      return NextResponse.json({ success: false, error: "No file data received." }, { status: 400 });
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds 100 MB limit. Your file is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB.`,
      }, { status: 413 });
    }

    const magic = buffer.slice(0, 4).toString("ascii");
    if (magic !== "%PDF") {
      return NextResponse.json({
        success: false,
        error: "Only PDF files are supported. Please upload a .pdf file.",
      }, { status: 400 });
    }

    let text: string;
    let numpages: number;

    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: uint8 });
      const result = await parser.getText();
      text     = result.text;
      numpages = result.total;
      await parser.destroy();
    } catch (loadErr) {
      console.error("[api/parse-pdf] pdf-parse error:", loadErr);
      return NextResponse.json({
        success: false,
        error:
          "Could not read the PDF. Make sure it is a digital (not scanned/image) bank statement. " +
          "If scanned, download the PDF from your bank's internet banking portal instead.",
      }, { status: 422 });
    }

    if (!text || text.trim().length < 50) {
      let tempFilePath: string | null = null;
      try {
        tempFilePath = join(tmpdir(), `pdf-${Date.now()}.pdf`);
        writeFileSync(tempFilePath, Buffer.from(uint8));
        const { default: Tesseract } = await import("tesseract.js");
        const result = await Tesseract.recognize(tempFilePath, "eng");
        text = result.data.text;
      } catch (ocrErr) {
        console.error("[api/parse-pdf] OCR failed:", ocrErr);
        return NextResponse.json({
          success: false,
          error:
            "This PDF appears to be image-based (scanned) and OCR extraction failed. " +
            "Please try: (1) Download a fresh statement from your bank's internet banking portal, " +
            "(2) Export as Excel or CSV from net banking, or (3) Export from Busy Accounting as .xlsx.",
        }, { status: 422 });
      } finally {
        if (tempFilePath) {
          try { unlinkSync(tempFilePath); } catch { /* ignore */ }
        }
      }
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "Could not extract text from PDF. The file may be corrupted or in an unsupported format.",
      }, { status: 422 });
    }

    const parsed = parseBankStatementText(text);

    let bankMetadata: BankAccountMetadata | null = null;
    try {
      bankMetadata = await extractBankAccountMetadata(text);
      if (bankMetadata) {
        console.log("[api/parse-pdf] ✓ Extracted metadata:", {
          bank:    bankMetadata.bankName,
          account: bankMetadata.accountNumber,
          period:  `${bankMetadata.periodStart} to ${bankMetadata.periodEnd}`,
        });
      }
    } catch (metaErr) {
      console.warn("[api/parse-pdf] Metadata extraction failed (non-fatal):", metaErr);
    }

    if (parsed.totalRows === 0) {
      return NextResponse.json({
        success: false,
        error:
          `Extracted ${numpages} page(s) but found no transaction rows. ` +
          "Try exporting as Excel/CSV from net banking, or contact support with a sample statement.",
      }, { status: 422 });
    }

    return NextResponse.json({
      success:      true,
      data:         parsed,
      bankMetadata: bankMetadata ?? undefined,
      pages:        numpages,
    });

  } catch (err) {
    console.error("[api/parse-pdf] Unexpected error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error parsing PDF.",
    }, { status: 500 });
  }
}
