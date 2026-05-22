/**
 * Bank Account Metadata extracted from statements
 */
export interface BankAccountMetadata {
  bankName: string; // "HDFC Bank", "Kotak Mahindra Bank", etc.
  accountNumber: string; // "1234567890123"
  accountType?: string; // "CURRENT", "SAVINGS", etc.
  branch?: string; // "NEW DELHI - SHALIMAR BAGH"
  ifscCode?: string; // "KKBK0004571"
  micrCode?: string; // "110485060"
  accountHolderName?: string; // "Robotek Llp"
  periodStart?: string; // "2026-04-01" (YYYY-MM-DD)
  periodEnd?: string; // "2026-05-20"
  openingBalance: number; // In paisa (multiply by 100 for storage)
  closingBalance: number; // In paisa
  currency?: string; // "INR" (default)
  statementDate?: string; // "2026-05-20"
}

/**
 * Generic bank statement parser interface
 * All bank-specific parsers implement this
 */
export interface BankStatementParser {
  /**
   * Extract bank metadata from statement text
   * Returns null if parsing fails
   */
  extractMetadata(text: string): BankAccountMetadata | null;

  /**
   * Can this parser handle this text?
   * Optional - used for fallback detection
   */
  canHandle?(text: string): boolean;
}
