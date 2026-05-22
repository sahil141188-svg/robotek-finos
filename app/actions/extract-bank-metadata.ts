"use server";

/**
 * extractBankMetadata — Server Action
 *
 * Runs extractBankAccountMetadata() on bank statement text to extract:
 * - Bank name
 * - Account number
 * - Account type
 * - Branch, IFSC, MICR
 * - Statement period
 * - Opening/closing balances
 *
 * Used during PDF import to extract and store bank account metadata.
 * Returns extracted metadata + any errors encountered.
 */

import { extractBankAccountMetadata } from "./parsers";
import type { BankAccountMetadata } from "./parsers/types";

export interface ExtractedBankMetadata extends BankAccountMetadata {
  success: boolean;
  error?: string;
}

/**
 * Extract bank account metadata from statement text
 * Returns null if extraction fails (parser will log details)
 */
export async function extractBankMetadata(
  text: string
): Promise<ExtractedBankMetadata | null> {
  try {
    if (!text || text.trim().length < 50) {
      return null;
    }

    const metadata = await extractBankAccountMetadata(text);

    if (!metadata) {
      console.warn("[extract-bank-metadata] Metadata extraction returned null");
      return null;
    }

    return {
      ...metadata,
      success: true,
    };
  } catch (error) {
    console.error("[extract-bank-metadata] Error:", error);
    return null;
  }
}

/**
 * Helper to mask account number for display
 * Keeps only last 4 digits visible
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length <= 4) {
    return accountNumber;
  }
  const last4 = accountNumber.slice(-4);
  const masked = "*".repeat(accountNumber.length - 4) + last4;
  return masked;
}

/**
 * Get last 4 digits of account number
 */
export function getLastFourDigits(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) {
    return accountNumber;
  }
  return accountNumber.slice(-4);
}
