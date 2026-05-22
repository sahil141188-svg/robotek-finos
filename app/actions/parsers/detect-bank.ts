/**
 * detectBankFromText — Identifies which bank issued the statement
 *
 * Scans the first 500 characters for bank name patterns.
 * Returns the bank code for routing to the correct parser.
 */

export type BankCode =
  | "HDFC"
  | "ICICI"
  | "SBI"
  | "AXIS"
  | "KOTAK"
  | "IDBI"
  | "CANARA"
  | "FEDERAL"
  | "AU_SMALL_FINANCE"
  | "YES_BANK"
  | "INDUSIND"
  | "UNKNOWN";

interface BankPattern {
  code: BankCode;
  patterns: RegExp[];
}

const BANK_PATTERNS: BankPattern[] = [
  {
    code: "HDFC",
    patterns: [
      /hdfc\s+bank/i,
      /hdfc\s+account/i,
      /www\.hdfcbank\.com/i,
    ],
  },
  {
    code: "KOTAK",
    patterns: [
      /kotak\s+bank/i,
      /kotak\s+mahindra/i,
      /kbk\d{10}/i, // IFSC code starts with KBK
    ],
  },
  {
    code: "IDBI",
    patterns: [
      /idbi\s+bank/i,
      /idbi\s+account/i,
      /www\.idbibank\.in/i,
    ],
  },
  {
    code: "SBI",
    patterns: [
      /state\s+bank\s+of\s+india/i,
      /sbi\s+account/i,
      /www\.sbi\.co\.in/i,
    ],
  },
  {
    code: "AXIS",
    patterns: [
      /axis\s+bank/i,
      /axis\s+account/i,
      /www\.axisbank\.com/i,
    ],
  },
  {
    code: "ICICI",
    patterns: [
      /icici\s+bank/i,
      /icici\s+account/i,
      /www\.icicibank\.com/i,
    ],
  },
  {
    code: "CANARA",
    patterns: [
      /canara\s+bank/i,
      /canara\s+account/i,
      /www\.canarabank\.com/i,
    ],
  },
  {
    code: "FEDERAL",
    patterns: [
      /federal\s+bank/i,
      /federal\s+account/i,
      /www\.federalbank\.in/i,
    ],
  },
  {
    code: "AU_SMALL_FINANCE",
    patterns: [
      /au\s+bank/i,
      /au\s+small\s+finance/i,
      /www\.aubank\.in/i,
    ],
  },
  {
    code: "YES_BANK",
    patterns: [
      /yes\s+bank/i,
      /yesbank/i,
      /www\.yesbank\.in/i,
    ],
  },
  {
    code: "INDUSIND",
    patterns: [
      /indusind\s+bank/i,
      /indusind\s+account/i,
      /www\.indusind\.com/i,
    ],
  },
];

/**
 * Detects bank from extracted PDF text
 * Scans first 1000 chars for bank identifiers
 */
export function detectBank(text: string): BankCode {
  // Only scan first 1000 chars for performance
  const searchText = text.substring(0, 1000);

  for (const bank of BANK_PATTERNS) {
    for (const pattern of bank.patterns) {
      if (pattern.test(searchText)) {
        console.log(`[detect-bank] Detected: ${bank.code}`);
        return bank.code;
      }
    }
  }

  console.log("[detect-bank] Unknown bank, using generic parser");
  return "UNKNOWN";
}
