/**
 * Cross-company customer / vendor aggregator.
 *
 * Many customers (e.g. "Sunny Mobile Accessories") trade with multiple
 * group companies (Robotek + Aggarwal). This module identifies those
 * shared parties via normalised-name matching and returns ONE row per
 * unique party with per-company breakdown — useful for CRM and
 * payment-followup: when calling a customer, you see their total
 * exposure across the whole group.
 *
 * Name normalisation:
 *   - case-insensitive
 *   - strips the "(Yuval)" workaround suffix from migration-008-pending
 *     installations
 *   - strips legal-form suffixes: Pvt Ltd / Private Limited / LLP / Inc
 *   - collapses non-alphanumeric for matching
 * The DISPLAYED name is the longest variant we saw across companies.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildPartyAging, type PartyKind } from "./party-aging";

export type CrossCompanyPartyEntry = {
  companyId: string;
  companyShortName: string;
  colorClass: string;
  partyId: string;
  partyName: string;        // as stored in this company's books
  outstanding: number;
  overdue: number;          // 31+ days
  phone: string | null;
  email: string | null;
  oldestInvoiceDate: string | null;
  daysOverdue: number;
};

export type CrossCompanyPartyRow = {
  normalisedName: string;
  displayName: string;
  perCompany: CrossCompanyPartyEntry[];
  totalOutstanding: number;
  totalOverdue: number;
  companiesCount: number;       // how many group companies have this party with > 0
  bestPhone: string | null;
  bestEmail: string | null;
};

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\((yuval|robotek|muskan|aggarwal|yellow|skyview)\)\s*$/i, "")
    .replace(/\s+pvt\.?\s*ltd\.?$/i, "")
    .replace(/\s+private limited$/i, "")
    .replace(/\s+llp$/i, "")
    .replace(/\s+inc\.?$/i, "")
    .replace(/\s+limited$/i, "")
    .replace(/\s+ltd\.?$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export async function fetchCrossCompanyParties(
  supabase: SupabaseClient<Database>,
  kind: PartyKind,
): Promise<CrossCompanyPartyRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (supabase as any)
    .from("companies")
    .select("id, short_name, color_class, status")
    .eq("status", "active")
    .order("sort_order");

  type Co = { id: string; short_name: string; color_class: string };
  const cos = (companies ?? []) as Co[];

  const byName = new Map<string, CrossCompanyPartyRow>();

  for (const co of cos) {
    let aging;
    try {
      aging = await buildPartyAging(supabase, kind, co.id);
    } catch { continue; }

    for (const p of aging.parties) {
      if (p.total === 0) continue;
      const key = normaliseName(p.party_name);
      if (!key) continue;
      if (!byName.has(key)) {
        byName.set(key, {
          normalisedName: key,
          displayName: p.party_name,
          perCompany: [],
          totalOutstanding: 0, totalOverdue: 0, companiesCount: 0,
          bestPhone: null, bestEmail: null,
        });
      }
      const row = byName.get(key)!;
      const overdue = p.ag31to60 + p.ag61to90 + p.ag90plus;
      const openSorted = p.open_invoices
        .filter((i) => i.amount > 0)
        .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date));
      const oldest = openSorted[0];

      row.perCompany.push({
        companyId: co.id,
        companyShortName: co.short_name,
        colorClass: co.color_class,
        partyId: p.party_id,
        partyName: p.party_name,
        outstanding: p.total,
        overdue,
        phone: p.phone,
        email: p.email,
        oldestInvoiceDate: oldest?.invoice_date ?? null,
        daysOverdue: oldest?.days_outstanding ?? 0,
      });
      row.totalOutstanding += p.total;
      row.totalOverdue    += overdue;
      row.companiesCount++;

      // Canonical display name = longest variant
      if (p.party_name.length > row.displayName.length) row.displayName = p.party_name;
      if (!row.bestPhone && p.phone) row.bestPhone = p.phone;
      if (!row.bestEmail && p.email) row.bestEmail = p.email;
    }
  }

  // Highest exposure first; multi-company rows naturally float up because
  // their total > any single-company total of the same magnitude.
  return [...byName.values()].sort((a, b) => {
    if (b.companiesCount !== a.companiesCount) return b.companiesCount - a.companiesCount;
    return b.totalOutstanding - a.totalOutstanding;
  });
}
