/**
 * Formats a number in Indian number system (Lakhs and Crores).
 * CLAUDE.md RULE 5: Indian number format — Lakhs and Crores.
 */
export function formatIndian(value: number, decimals = 2): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 10_000_000) {
    return `${sign}₹${(absValue / 10_000_000).toFixed(2)} Cr`;
  }
  if (absValue >= 100_000) {
    return `${sign}₹${(absValue / 100_000).toFixed(2)} L`;
  }

  // Below 1 Lakh — format with Indian comma grouping (xx,xx,xxx)
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatter.format(value);
}

/**
 * Formats a plain quantity (units, not rupees) in the Indian system.
 * e.g. 1380895 → "13.81 L", 122518 → "1.23 L", 4200 → "4,200".
 * Used by the AI Sales Coordinator for unit targets/volumes.
 */
export function formatQty(value: number): string {
  const v = Math.round(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(2)} L`;
  return new Intl.NumberFormat("en-IN").format(v);
}

/**
 * Returns the current Indian financial year string (e.g. "2024-25").
 * Financial year runs April to March.
 */
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  if (month >= 3) {
    // April (3) or later
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * Returns the start date of a given financial year (April 1).
 */
export function fyStartDate(fy: string): Date {
  const startYear = parseInt(fy.split("-")[0]);
  return new Date(startYear, 3, 1); // April 1
}

/**
 * Returns the end date of a given financial year (March 31).
 */
export function fyEndDate(fy: string): Date {
  const startYear = parseInt(fy.split("-")[0]);
  return new Date(startYear + 1, 2, 31); // March 31
}

/**
 * Formats days overdue/remaining as a readable string.
 */
export function formatDaysLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days > 0) return `${days}d overdue`;
  return `Due in ${Math.abs(days)}d`;
}
