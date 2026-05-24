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
 * Parsing logic lives in lib/parse-bank-statement.ts (shared with the Server
 * Action at app/actions/parse-pdf.ts) so fixes only need to be applied once.
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
import type { BankAccountMetadata } from "@/app/actions/parsers/types";
import { extractBankAccountMetadata } from "@/app/actions/parsers";
import { parseBankStatementText } from "@/lib/parse-bank-statement";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const dynamic = "force-dynamic";

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

    // Use shared parser — correctly handles NEFT/RTGS reference number fragments
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
