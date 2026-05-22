/**
 * Bank Statement Parser Router
 *
 * Orchestrates:
 * 1. Bank detection (KOTAK, IDBI, HDFC, etc.)
 * 2. Route to bank-specific parser
 * 3. Fallback to generic parser
 * 4. Extract bank account metadata
 */

import { detectBank } from "./detect-bank";
import { kotakParser } from "./kotak-parser";
import { idbiParser } from "./idbi-parser";
import { hdfcParser } from "./hdfc-parser";
import { genericParser } from "./generic-parser";
import type { BankAccountMetadata } from "./types";

export type { BankAccountMetadata } from "./types";

/**
 * Extract bank account metadata from statement text
 *
 * Returns bank details: account number, branch, IFSC, balances, period, etc.
 * Works with digital PDFs, OCR-extracted text, and any bank format.
 */
export async function extractBankAccountMetadata(
  text: string
): Promise<BankAccountMetadata | null> {
  try {
    // Step 1: Detect which bank
    const bank = detectBank(text);
    console.log(`[bank-parser] Processing ${bank} statement`);

    // Step 2: Route to appropriate parser
    let metadata: BankAccountMetadata | null = null;

    switch (bank) {
      case "KOTAK":
        metadata = kotakParser.extractMetadata(text);
        break;

      case "IDBI":
        metadata = idbiParser.extractMetadata(text);
        break;

      case "HDFC":
        metadata = hdfcParser.extractMetadata(text);
        break;

      case "CANARA":
      case "FEDERAL":
      case "AU_SMALL_FINANCE":
      case "YES_BANK":
      case "INDUSIND":
      case "ICICI":
      case "SBI":
      case "AXIS":
        // Use generic parser for these banks
        metadata = genericParser.extractMetadata(text);
        break;

      case "UNKNOWN":
      default:
        // Try generic parser for unknown banks
        console.log("[bank-parser] Using generic parser for unknown bank");
        metadata = genericParser.extractMetadata(text);
        break;
    }

    if (metadata) {
      console.log("[bank-parser] ✓ Successfully extracted metadata:", {
        bank: metadata.bankName,
        account: metadata.accountNumber,
        branch: metadata.branch,
        period: `${metadata.periodStart} to ${metadata.periodEnd}`,
        closingBalance: `₹${(metadata.closingBalance / 100).toLocaleString("en-IN")}`,
      });
    } else {
      console.warn("[bank-parser] ✗ Failed to extract metadata");
    }

    return metadata;
  } catch (error) {
    console.error("[bank-parser] Error:", error);
    return null;
  }
}

/**
 * Export all parsers for direct use if needed
 */
export { detectBank } from "./detect-bank";
export { kotakParser } from "./kotak-parser";
export { idbiParser } from "./idbi-parser";
export { hdfcParser } from "./hdfc-parser";
export { genericParser } from "./generic-parser";
