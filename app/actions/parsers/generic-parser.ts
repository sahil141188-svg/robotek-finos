/**
 * Generic Bank Statement Parser (Fallback)
 *
 * Works with any bank statement format using flexible heuristics.
 * Useful for:
 * - Canara Bank
 * - Federal Bank
 * - AU Small Finance Bank
 * - Yes Bank
 * - IndusInd Bank
 * - Or any unknown bank format
 *
 * Strategy: Search for common patterns across all bank statements
 */

import type { BankAccountMetadata, BankStatementParser } from "./types";

export class GenericBankParser implements BankStatementParser {
  extractMetadata(text: string): BankAccountMetadata | null {
    try {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const result: BankAccountMetadata = {
        bankName: this.detectBankName(text),
        accountNumber: "",
        openingBalance: 0,
        closingBalance: 0,
      };

      // Try multiple account number patterns (10-16 digit numbers after "Account" or similar)
      let match = text.match(
        /(?:Account\s+(?:Number|No\.?)|A\/c\s+(?:No\.?)|Account)[:\s#+]*([\d\s\-]+)/i
      );
      if (match) {
        result.accountNumber = match[1]
          .replace(/[\s\-]/g, "")
          .substring(0, 16);
      }

      // If not found, search for any 10-16 digit sequence in first 1000 chars
      if (!result.accountNumber || result.accountNumber.length < 10) {
        const numMatch = text
          .substring(0, 1000)
          .match(/\b(\d{10,16})\b/);
        if (numMatch) {
          result.accountNumber = numMatch[1];
        }
      }

      // Extract branch
      match = text.match(
        /(?:Branch|Branch Name)[:\s]+([A-Z\s\-&(),\.]+?)(?:\n|$)/i
      );
      if (match) {
        result.branch = match[1].trim().substring(0, 100);
      }

      // Extract IFSC (always 11 chars, format: 4 letters + 0 + 6 alphanumeric)
      match = text.match(/(?:IFSC|IFSC Code)[:\s]*([A-Z]{4}0[A-Z0-9]{6})/i);
      if (match) {
        result.ifscCode = match[1];
      }

      // Extract MICR (9 digit code)
      match = text.match(/(?:MICR|MICR Code)[:\s]*(\d{9})/i);
      if (match) {
        result.micrCode = match[1];
      }

      // Extract statement period - flexible pattern
      match = text.match(
        /(\d{1,2}[\s\-](?:\w+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]\d{4})\s*(?:to|TO|-)\s*(\d{1,2}[\s\-](?:\w+|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]\d{4})/i
      );
      if (match) {
        result.periodStart = this.parseDate(match[1]);
        result.periodEnd = this.parseDate(match[2]);
        result.statementDate = result.periodEnd;
      }

      // Try to extract opening and closing balances
      match = text.match(/Opening\s+Balance[:\s]*([+-]?[\d,]+\.?\d*)/i);
      if (match) {
        result.openingBalance = this.parseAmount(match[1]);
      }

      match = text.match(
        /(?:Closing|Ending|Final)\s+Balance[:\s]*([+-]?[\d,]+\.?\d*)/i
      );
      if (match) {
        result.closingBalance = this.parseAmount(match[1]);
      }

      // Fallback: get closing balance from last numeric line
      if (result.closingBalance === 0) {
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 30); i--) {
          const amount = this.extractAmountFromLine(lines[i]);
          if (amount !== null && amount > 0) {
            result.closingBalance = amount;
            break;
          }
        }
      }

      if (!result.accountNumber) {
        console.warn("[generic-parser] Could not extract account number");
        return null;
      }

      return result;
    } catch (error) {
      console.error("[generic-parser] Error:", error);
      return null;
    }
  }

  /**
   * Try to identify bank name from text
   */
  private detectBankName(text: string): string {
    const bankNames: Record<string, string> = {
      hdfc: "HDFC Bank",
      kotak: "Kotak Mahindra Bank",
      idbi: "IDBI Bank",
      icici: "ICICI Bank",
      axis: "Axis Bank",
      sbi: "State Bank of India",
      canara: "Canara Bank",
      federal: "Federal Bank",
      "au bank": "AU Small Finance Bank",
      "yes bank": "Yes Bank",
      indusind: "IndusInd Bank",
    };

    const searchText = text.substring(0, 500).toLowerCase();
    for (const [key, bankName] of Object.entries(bankNames)) {
      if (searchText.includes(key)) {
        return bankName;
      }
    }

    return "Unknown Bank";
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

    // Try DD/MM/YYYY format
    match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
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

  private extractAmountFromLine(line: string): number | null {
    // Extract any amount from the line (last number typically)
    const match = line.match(/([\d,]+\.?\d*)\s*$/);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      return !isNaN(amount) && amount > 0 ? amount * 100 : null;
    }
    return null;
  }
}

export const genericParser = new GenericBankParser();
