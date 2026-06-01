/**
 * Robotek demand seasonality — single source of truth for Target-Gap.
 *
 * The index maps calendar month (1-12) to a multiplier of an "average month".
 * Derived from real order history. Months 4-7 are provisional (1.00) until the
 * live current-year order tab fills them in.
 */
import raw from "./seasonal-index.json";

export const SEASONAL_INDEX: Record<number, number> = Object.fromEntries(
  Object.entries(raw)
    .filter(([k]) => /^\d+$/.test(k))
    .map(([k, v]) => [Number(k), v as number])
);

export const PROVISIONAL_MONTHS: number[] = (raw as { _provisional?: number[] })._provisional ?? [];

/** Seasonal multiplier for a given month (defaults to 1 if unknown). */
export function seasonalFactor(month: number): number {
  return SEASONAL_INDEX[month] ?? 1;
}

/**
 * Month-specific target for a product, scaling its average monthly baseline
 * target by the seasonal factor. e.g. monthlyBaseline 1000 in Oct (1.36) -> 1360.
 */
export function monthlyTarget(monthlyBaseline: number, month: number): number {
  return Math.round(monthlyBaseline * seasonalFactor(month));
}
