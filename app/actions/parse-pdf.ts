"use server";

/**
 * parsePDFBankStatement — Server Action
 *
 * Runs on Node.js (server-side only). Uses pdf-parse to extract text from a
 * digital bank statement PDF, then finds transaction lines using date + amount
 * heuristics common across Indian bank statement formats:
 *   HDFC, SBI, Axis Bank, ICICI, Kotak, Yes Bank, IndusInd, IDBI
 *
 * For scanned/image-based PDFs, falls back to Tesseract OCR.
 *
 * Returns a ParsedFile identical in shape to what parseExcelFile returns, so
 * the rest of the import wizard (column mapper → validate → import) works
 * without any changes.
 *
 * Parsing logic lives in lib/parse-bank-statement.ts (shared with the Route
 * Handler at app/api/parse-pdf/route.ts) so fixes only need to be applied once.
 */

// NOTE: pdf-parse is NOT imported at the top of this file.
// We use a dynamic import() inside the server action so that any module-load
// failure (e.g. pdfjs-dist not loading in Vercel's Lambda cold start) is caught
// by our own try-catch instead of crashing the entire Server Action call and
// returning Next.js's generic "Server Components render" error.
import type { ParsedFile } from "@/lib/import-utils";
import type { BankAccountMetadata } from "./parsers/types";
import { extractBankAccountMetadata } from "./parsers";
import { parseBankStatementText } from "@/lib/parse-bank-statement";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ─── Server action (exported) ─────────────────────────────────────────────────

/**
 * parsePDFBankStatement — accepts the PDF as a base64-encoded string.
 *
 * NOTE: The primary upload path is now the Route Handler at /api/parse-pdf
 * which receives raw binary bytes — no JSON body limit, works for any size PDF.
 * This server action is kept as a fallback for smaller PDFs and for direct
 * server-side calls.
 */
export async function parsePDFBankStatement(
  base64: string,
  fileName: string = "upload.pdf",
): Promise<{
  success: boolean;
  data?:   ParsedFile;
  bankMetadata?: BankAccountMetadata;
  error?:  string;
  pages?:  number;
}> {
  try {
    if (!base64) return { success: false, error: "No file provided." };

    // Decode base64 → Buffer (Node.js server environment)
    const buffer = Buffer.from(base64, "base64");
    const uint8  = new Uint8Array(buffer);

    // Validate file size — max 100 MB
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds 100 MB limit. Your file is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB.`,
      };
    }

    // Basic PDF magic-bytes check (PDF files start with %PDF)
    const magic = buffer.slice(0, 4).toString("ascii");
    if (magic !== "%PDF") {
      return { success: false, error: "Only PDF files are supported. Please upload a .pdf file." };
    }

    let text: string;
    let numpages: number;
    let usedOCR = false;

    try {
      // Dynamic import keeps the module-load inside our try-catch.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: uint8 });
      const result = await parser.getText();
      text     = result.text;
      numpages = result.total;
      await parser.destroy();
    } catch (loadErr) {
      console.error("[parse-pdf] pdf-parse load/parse error:", loadErr);
      return {
        success: false,
        error:
          "Could not read the PDF. Make sure it is a digital (not scanned/image) bank statement. " +
          "If scanned, download the PDF from your bank's internet banking portal instead.",
      };
    }

    // If text extraction returned minimal content, try OCR for scanned PDFs
    if (!text || text.trim().length < 50) {
      console.log("[parse-pdf] Minimal text extracted, attempting OCR...");
      let tempFilePath: string | null = null;
      try {
        tempFilePath = join(tmpdir(), `pdf-${Date.now()}.pdf`);
        writeFileSync(tempFilePath, Buffer.from(uint8));
        const { default: Tesseract } = await import("tesseract.js");
        console.log("[parse-pdf] Starting Tesseract OCR...");
        const result = await Tesseract.recognize(tempFilePath, "eng");
        text = result.data.text;
        usedOCR = true;
        console.log(`[parse-pdf] OCR completed: ${text.length} chars extracted`);
      } catch (ocrErr) {
        console.error("[parse-pdf] OCR failed:", ocrErr);
        return {
          success: false,
          error:
            "This PDF appears to be image-based (scanned) and OCR extraction failed. " +
            "Please try one of these alternatives:\n\n" +
            "1. Download a fresh statement from your bank's internet banking portal (usually in PDF format with embedded text)\n" +
            "2. Export as Excel or CSV from your bank's portal\n" +
            "3. Export from Busy Accounting Software as .xlsx file\n\n" +
            "If your bank only provides scanned PDFs, contact us and we can help manually import the data.",
        };
      } finally {
        if (tempFilePath) {
          try { unlinkSync(tempFilePath); } catch (e) {
            console.warn(`[parse-pdf] Failed to clean up temp file: ${tempFilePath}`, e);
          }
        }
      }
    }

    if (!text || text.trim().length < 50) {
      return {
        success: false,
        error:
          "Could not extract text from PDF even after OCR. The file may be corrupted or in an unsupported format. " +
          "Please try downloading a fresh statement or exporting as Excel/CSV instead.",
      };
    }

    // Use shared parser (lib/parse-bank-statement.ts) — handles NEFT/RTGS
    // reference number fragments and correctly extracts debit/credit amounts.
    const parsed = parseBankStatementText(text);
    void usedOCR; // suppress unused variable warning

    // Try to extract bank account metadata
    let bankMetadata: BankAccountMetadata | null = null;
    try {
      bankMetadata = await extractBankAccountMetadata(text);
      if (bankMetadata) {
        console.log("[parse-pdf] ✓ Extracted bank metadata:", {
          bank: bankMetadata.bankName,
          account: bankMetadata.accountNumber,
          period: `${bankMetadata.periodStart} to ${bankMetadata.periodEnd}`,
        });
      }
    } catch (metaErr) {
      console.warn("[parse-pdf] Bank metadata extraction failed (non-fatal):", metaErr);
    }

    if (parsed.totalRows === 0) {
      return {
        success: false,
        error:
          `Extracted ${numpages} page(s) of text but found no transaction rows. ` +
          "Your bank may use a custom format. Try exporting as Excel/CSV from net banking, " +
          "or contact support with a sample statement so we can add support for your bank.",
      };
    }

    return {
      success: true,
      data: parsed,
      bankMetadata: bankMetadata || undefined,
      pages: numpages
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error parsing PDF.",
    };
  }
}
