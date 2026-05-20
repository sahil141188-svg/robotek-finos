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
