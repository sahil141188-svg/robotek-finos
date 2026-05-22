/**
 * HDFC Bank Statement Parser
 *
 * Handles HDFC Bank statements - works with both:
 * - Digital PDFs (direct text extraction)
 * - Scanned PDFs (after OCR processing)
 *
 * Standard HDFC format:
 * - Account Statement header
 * - Account Number, Name, Branch
 * - Statement Period
 * - Transactions with Date, Description, Withdrawal/Deposit, Balance
 */

import type { BankAccountMetadata, BankStatementParser } from "./types";

export class HDFCParser implements BankStatementParser {
  canHandle(text: string): boolean {
    return /hdfc\s+bank|hdfc\s+account/i.test(text.substring(0, 500));
  }

  extractMetadata(text: string): BankAccountMetadata | null {
    try {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const result: BankAccountMetadata = {
        bankName: "HDFC Bank",
        accountNumber: "",
        openingBalance: 0,
        closingBalance: 0,
      };

      // Extract account number - HDFC typically shows: "Account Number: 1234567890"
      let match = text.match(/(?:Account\s+Number|Account)[:\s]+(\d{10,16})/i);
      if (match) {
        result.accountNumber = match[1];
      }

      // Extract account type: "Account Type: CURRENT" or "Account Type: SAVINGS"
      match = text.match(/Account\s+Type[:\s]+(CURRENT|SAVINGS|CHECKING)/i);
      if (match) {
        result.accountType = match[1];
      }

      // Extract branch: "Branch: NEW DELHI" or similar
      match = text.match(/Branch[:\s]+([A-Z\s\-]+?)(?:\n|$)/i);
      if (match) {
        result.branch = match[1].trim();
      }

      // Extract account holder name
      match = text.match(/(?:Name|A\/C Holder)[:\s]+([A-Z\s&()]+?)(?:\n|$)/i);
      if (match) {
        result.accountHolderName = match[1].trim();
      }

      // Extract IFSC code - "IFSC Code: HDFC0001234"
      match = text.match(/IFSC\s+Code[:\s]+([A-Z0-9]+)/i);
      if (match) {
        result.ifscCode = match[1];
      }

      // Extract MICR code
      match = text.match(/MICR\s+Code[:\s]+(\d+)/i);
      if (match) {
        result.micrCode = match[1];
      }

      // Extract statement period - "Statement Period: 01 Apr 2026 to 30 May 2026"
      match = text.match(
        /(?:Statement\s+Period|Period)[:\s]+(\d{1,2}\s+\w+\s+\d{4})\s+(?:to|TO)\s+(\d{1,2}\s+\w+\s+\d{4})/i
      );
      if (match) {
        result.periodStart = this.parseDate(match[1]);
        result.periodEnd = this.parseDate(match[2]);
        result.statementDate = result.periodEnd;
      }

      // Extract opening and closing balances
      // HDFC shows: "Opening Balance: 50,000.00" and "Closing Balance: 85,000.00"
      match = text.match(/Opening\s+Balance[:\s]+([+-]?[\d,]+\.?\d*)/i);
      if (match) {
        result.openingBalance = this.parseAmount(match[1]);
      }

      match = text.match(/Closing\s+Balance[:\s]+([+-]?[\d,]+\.?\d*)/i);
      if (match) {
        result.closingBalance = this.parseAmount(match[1]);
      }

      // Fallback: extract from last transaction if not found
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
        console.warn("[hdfc-parser] Could not extract account number");
        return null;
      }

      return result;
    } catch (error) {
      console.error("[hdfc-parser] Error:", error);
      return null;
    }
  }

  private parseDate(dateStr: string): string {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };

    const match = dateStr.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
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
    // HDFC typically shows: "Date | Narration | Withdrawal | Deposit | Balance"
    // Balance is the last number on the line
    const match = line.match(/([\d,]+\.\d{2})$/);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      return !isNaN(amount) ? amount * 100 : null; // Convert to paisa
    }
    return null;
  }
}

export const hdfcParser = new HDFCParser();
