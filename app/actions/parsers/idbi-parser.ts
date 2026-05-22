/**
 * IDBI Bank Statement Parser
 *
 * Handles IDBI Bank statements - typical format has:
 * - Account Number in header
 * - Bank details (branch, IFSC, MICR)
 * - Period information
 * - Transaction list with Date, Description, Debit/Credit, Balance
 */

import type { BankAccountMetadata, BankStatementParser } from "./types";

export class IDBAParser implements BankStatementParser {
  canHandle(text: string): boolean {
    return /idbi\s+bank|idbi\s+account/i.test(text.substring(0, 500));
  }

  extractMetadata(text: string): BankAccountMetadata | null {
    try {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const result: BankAccountMetadata = {
        bankName: "IDBI Bank",
        accountNumber: "",
        openingBalance: 0,
        closingBalance: 0,
      };

      // Search for account number patterns in first 20 lines
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i];

        // Pattern: "Account Number: 1234567890" or "A/c: 1234567890"
        let match = line.match(/(?:Account\s+Number|A\/c\s*)[:\s]+(\d+)/i);
        if (match) {
          result.accountNumber = match[1];
          continue;
        }

        // Pattern: "Branch: BRANCH NAME"
        match = line.match(/Branch[:\s]+([A-Z\s\-]+?)(?:\n|$)/i);
        if (match) {
          result.branch = match[1].trim();
          continue;
        }

        // Pattern: "IFSC: IBKL0000571"
        match = line.match(/IFSC[:\s]+([A-Z0-9]+)/i);
        if (match) {
          result.ifscCode = match[1];
          continue;
        }

        // Pattern: "MICR: 110000001"
        match = line.match(/MICR[:\s]+(\d+)/i);
        if (match) {
          result.micrCode = match[1];
          continue;
        }

        // Pattern: "Period: 01 Apr 2026 to 30 May 2026" or "01-Apr-2026 to 31-May-2026"
        match = line.match(
          /(?:Period|From|Date)[:\s]+(\d{1,2}[\s\-](?:\w+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]\d{4})\s+(?:to|TO|-)\s+(\d{1,2}[\s\-](?:\w+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]\d{4})/i
        );
        if (match) {
          result.periodStart = this.parseDate(match[1]);
          result.periodEnd = this.parseDate(match[2]);
          result.statementDate = result.periodEnd;
          continue;
        }
      }

      // Extract Opening and Closing Balance
      // Search for "Opening Balance:" or "Previous Balance:" patterns
      const balanceText = text.substring(0, 2000); // Search first 2000 chars
      let match = balanceText.match(/Opening\s+Balance[:\s]+[\w\s]*([+-]?[\d,]+\.?\d*)/i);
      if (match) {
        result.openingBalance = this.parseAmount(match[1]);
      }

      // Closing balance or Ending balance
      match = balanceText.match(
        /(?:Closing|Ending|Final)\s+Balance[:\s]+[\w\s]*([+-]?[\d,]+\.?\d*)/i
      );
      if (match) {
        result.closingBalance = this.parseAmount(match[1]);
      }

      // Fallback: get from last transaction line if balances not found
      if (result.closingBalance === 0) {
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
          const balance = this.extractBalanceFromLine(lines[i]);
          if (balance !== null) {
            result.closingBalance = balance;
            break;
          }
        }
      }

      if (!result.accountNumber) {
        console.warn("[idbi-parser] Could not extract account number");
        return null;
      }

      return result;
    } catch (error) {
      console.error("[idbi-parser] Error:", error);
      return null;
    }
  }

  private parseDate(dateStr: string): string {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };

    // Try DD MMM YYYY format
    let match = dateStr.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = months[match[2].toLowerCase()] || "01";
      const year = match[3];
      return `${year}-${month}-${day}`;
    }

    // Try DD-MMM-YYYY format
    match = dateStr.match(/(\d{1,2})-([a-zA-Z]+)-(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = months[match[2].toLowerCase()] || "01";
      const year = match[3];
      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split("T")[0];
  }

  private parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/[₹\s,]/g, "");
    const amount = parseFloat(cleaned);
    return !isNaN(amount) ? amount * 100 : 0; // Convert to paisa
  }

  private extractBalanceFromLine(line: string): number | null {
    // Match amounts at the end of the line
    const match = line.match(/([\d,]+\.\d{2})$/);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      return !isNaN(amount) ? amount * 100 : null; // Convert to paisa
    }
    return null;
  }
}

export const idbiParser = new IDBAParser();
