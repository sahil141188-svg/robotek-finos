/**
 * detectBankFromText — Identifies which bank issued the statement.
 *
 * TWO-PASS strategy to avoid false positives:
 *
 * Pass 1 — Scan only the first 400 chars (the letterhead / header area).
 *   Only the ISSUING bank's name appears here. Transaction descriptions
 *   (which mention beneficiary banks like "NEFT TO HDFC BANK...") are
 *   further down the document, so we never read them in pass 1.
 *
 * Pass 2 — If pass 1 returns UNKNOWN, scan 3000 chars but ONLY look for
 *   IFSC-code prefixes (KKBK = Kotak, IBKL = IDBI, HDFC = HDFC, etc.).
 *   IFSC codes are account-level data unique to the issuing bank and don't
 *   appear as beneficiary references in descriptions.
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

// ── Pass 1: name patterns — only safe in the first 400 chars (header) ─────────
interface NamePattern { code: BankCode; patterns: RegExp[] }

const NAME_PATTERNS: NamePattern[] = [
  { code: "KOTAK",          patterns: [/kotak\s+mahindra/i, /kotak\s+bank/i, /kotak\.com/i] },
  { code: "IDBI",           patterns: [/idbi\s+bank/i, /idbibank/i, /idbi\.in/i] },
  { code: "HDFC",           patterns: [/hdfc\s+bank/i, /hdfcbank\.com/i] },
  { code: "ICICI",          patterns: [/icici\s+bank/i, /icicibank\.com/i] },
  { code: "SBI",            patterns: [/state\s+bank\s+of\s+india/i, /sbi\.co\.in/i] },
  { code: "AXIS",           patterns: [/axis\s+bank/i, /axisbank\.com/i] },
  { code: "CANARA",         patterns: [/canara\s+bank/i, /canarabank\.com/i] },
  { code: "FEDERAL",        patterns: [/federal\s+bank/i, /federalbank\.in/i] },
  { code: "AU_SMALL_FINANCE",patterns:[/au\s+small\s+finance/i, /au\s+bank/i, /aubank\.in/i] },
  { code: "YES_BANK",       patterns: [/yes\s+bank/i, /yesbank\.in/i] },
  { code: "INDUSIND",       patterns: [/indusind\s+bank/i, /indusind\.com/i] },
];

// ── Pass 2: IFSC-prefix patterns — safe anywhere in the document ──────────────
// Each issuing bank has a unique 4-letter IFSC prefix; these never appear as
// beneficiary info in another bank's statement.
interface IfscPattern { code: BankCode; regex: RegExp }

const IFSC_PATTERNS: IfscPattern[] = [
  { code: "KOTAK",          regex: /\bKKBK0[A-Z0-9]{6}\b/i },  // Kotak IFSC: KKBK0xxxxxx
  { code: "IDBI",           regex: /\bIBKL0[A-Z0-9]{6}\b/i },  // IDBI  IFSC: IBKL0xxxxxx
  { code: "HDFC",           regex: /\bHDFC0[A-Z0-9]{6}\b/i },  // HDFC  IFSC: HDFC0xxxxxx
  { code: "ICICI",          regex: /\bICIC0[A-Z0-9]{6}\b/i },  // ICICI IFSC: ICIC0xxxxxx
  { code: "SBI",            regex: /\bSBIN0[A-Z0-9]{6}\b/i },  // SBI   IFSC: SBIN0xxxxxx
  { code: "AXIS",           regex: /\bUTIB0[A-Z0-9]{6}\b/i },  // Axis  IFSC: UTIB0xxxxxx
  { code: "CANARA",         regex: /\bCNRB0[A-Z0-9]{6}\b/i },  // Canara IFSC
  { code: "FEDERAL",        regex: /\bFDRL0[A-Z0-9]{6}\b/i },  // Federal IFSC
  { code: "AU_SMALL_FINANCE",regex: /\bAUBL0[A-Z0-9]{6}\b/i }, // AU IFSC
  { code: "YES_BANK",       regex: /\bYESB0[A-Z0-9]{6}\b/i },  // Yes IFSC
  { code: "INDUSIND",       regex: /\bINDB0[A-Z0-9]{6}\b/i },  // IndusInd IFSC
];

/**
 * Main detector — two-pass approach.
 * Returns the BankCode for routing to the correct parser.
 */
export function detectBank(text: string): BankCode {
  // Pass 1: header-only name match (first 400 chars = letterhead)
  const header = text.substring(0, 400);
  for (const { code, patterns } of NAME_PATTERNS) {
    for (const p of patterns) {
      if (p.test(header)) {
        console.log(`[detect-bank] Pass-1 match: ${code}`);
        return code;
      }
    }
  }

  // Pass 2: IFSC-prefix scan across first 3000 chars
  const body = text.substring(0, 3000);
  for (const { code, regex } of IFSC_PATTERNS) {
    if (regex.test(body)) {
      console.log(`[detect-bank] Pass-2 IFSC match: ${code}`);
      return code;
    }
  }

  // Last resort: widen name search to 1500 chars — still safer than full doc
  const wider = text.substring(0, 1500);
  for (const { code, patterns } of NAME_PATTERNS) {
    for (const p of patterns) {
      if (p.test(wider)) {
        console.log(`[detect-bank] Pass-3 wide-name match: ${code}`);
        return code;
      }
    }
  }

  console.log("[detect-bank] Unknown bank — using generic parser");
  return "UNKNOWN";
}
