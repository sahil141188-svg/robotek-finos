/**
 * KOTAK Bank Statement Parser
 *
 * Handles Kotak Mahindra Bank statements in standard format:
 * - Account #: 9810504008
 * - Branch: NEW DELHI - SHALIMAR BAGH
 * - Period: 01 Apr 2026 - 20 May 2026
 * - Transactions with Date, Time, Description, Debit/Credit, Balance
 */

import type { BankAccountMetadata, BankStatementParser } from "./types";

export class KotakParser implements BankStatementParser {
  canHandle(text: string): boolean {
    return /kotak|kbk\d{10}/i.test(text.substring(0, 500));
  }

  extractMetadata(text: string): BankAccountMetadata | null {
    try {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const result: BankAccountMetadata = {
        bankName: "Kotak Mahindra Bank",
        accountNumber: "",
        openingBalance: 0,
        closingBalance: 0,
      };

      // Extract Account Number: "Account Statement Account # 9810504008 CURRENT"
      const accountMatch = text.match(/Account\s+#\s+(\d+)\s+(CURRENT|SAVINGS|CHECKING)?/i);
      if (accountMatch) {
        result.accountNumber = accountMatch[1];
        result.accountType = accountMatch[2] || "CURRENT";
      }

      // Extract Branch: "Branch NEW DELHI - SHALIMAR BAGH"
      const branchMatch = text.match(/Branch\s+([A-Z\s\-]+?)(?:\n|$)/i);
      if (branchMatch) {
        result.branch = branchMatch[1].trim();
      }

      // Extract Period: "01 Apr 2026 - 20 May 2026"
      const periodMatch = text.match(/(\d{2}\s+\w+\s+\d{4})\s*-\s*(\d{2}\s+\w+\s+\d{4})/);
      if (periodMatch) {
        result.periodStart = this.parseDate(periodMatch[1]);
        result.periodEnd = this.parseDate(periodMatch[2]);
        result.statementDate = result.periodEnd;
      }

      // Extract Account Holder Name: "Robotek Llp"
      const nameMatch = text.match(/Account Holder[:\s]+([A-Za-z\s&()]+?)(?:\n|$)/i);
      if (nameMatch) {
        result.accountHolderName = nameMatch[1].trim();
      } else {
        // Try to get name from "CRN XXXXXX408" line or address area
        const crn = lines.find((l) => l.includes("CRN"));
        if (crn) {
          const nameIdx = lines.indexOf(crn);
          if (nameIdx > 0) {
            result.accountHolderName = lines[nameIdx - 1] || "Unknown";
          }
        }
      }

      // Extract IFSC: "IFSC KKBK0004571"
      const ifscMatch = text.match(/IFSC\s+([A-Z0-9]+)/);
      if (ifscMatch) {
        result.ifscCode = ifscMatch[1];
      }

      // Extract MICR: "MICR 110485060"
      const micrMatch = text.match(/MICR\s+(\d+)/);
      if (micrMatch) {
        result.micrCode = micrMatch[1];
      }

      // Extract Opening and Closing Balance from first and last transaction
      // Find the transaction section: "# TRANSACTION DATE VALUE DATE..."
      const txnHeaderIdx = lines.findIndex((l) =>
        l.includes("TRANSACTION DATE") || l.includes("# TRANSACTION DATE")
      );

      if (txnHeaderIdx > -1) {
        // First transaction line after header gives opening balance
        for (let i = txnHeaderIdx + 1; i < lines.length; i++) {
          const balance = this.extractBalanceFromLine(lines[i]);
          if (balance !== null) {
            result.openingBalance = balance;
            break;
          }
        }

        // Last transaction line gives closing balance
        for (let i = lines.length - 1; i > txnHeaderIdx; i--) {
          const balance = this.extractBalanceFromLine(lines[i]);
          if (balance !== null) {
            result.closingBalance = balance;
            break;
          }
        }
      }

      if (!result.accountNumber) {
        console.warn("[kotak-parser] Could not extract account number");
        return null;
      }

      return result;
    } catch (error) {
      console.error("[kotak-parser] Error:", error);
      return null;
    }
  }

  /**
   * Parse date string like "01 Apr 2026" to "2026-04-01"
   */
  private parseDate(dateStr: string): string {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };

    const match = dateStr.match(/(\d{2})\s+(\w+)\s+(\d{4})/);
    if (match) {
      const day = match[1];
      const month = months[match[2].toLowerCase()] || "01";
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Extract balance amount from a line
   * Format: "...+50,000.00 1,29,429.07" or "-13,200.00 2,66,229.07"
   * Last number is the balance
   */
  private extractBalanceFromLine(line: string): number | null {
    // Match all numbers with commas and decimals
    const amounts = line.match(/[\d,]+\.\d{2}/g);
    if (amounts && amounts.length > 0) {
      // Last amount is typically the balance
      const lastAmount = amounts[amounts.length - 1];
      const cleaned = lastAmount.replace(/,/g, "");
      const balance = parseFloat(cleaned);
      return !isNaN(balance) ? balance * 100 : null; // Convert to paisa
    }
    return null;
  }
}

export const kotakParser = new KotakParser();
