/**
 * Intercompany reconciliation — detect transactions between group companies.
 *
 * For each pair (A, B), looks at vendor/customer ledgers in A whose name
 * mentions B (e.g., Yuval has a vendor "SKYVIEW BARTER PVT LTD" which
 * matches the Skyview group company). Returns net balance per pair.
 *
 * This is heuristic — name matching is fuzzy and can miss aliases. The
 * matrix is meant as a flag, not a final reconciliation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildPartyAging } from "./party-aging";

export type IntercompanyRow = {
  /** Company holding the receivable/payable */
  ownerCompanyId: string;
  ownerCompanyName: string;
  /** The matched counterparty company */
  partnerCompanyId: string;
  partnerCompanyName: string;
  /** Receivable from partner (DR in owner's books) */
  receivable: number;
  /** Payable to partner (CR in owner's books) */
  payable: number;
  /** Net = receivable − payable (positive = owner is owed) */
  net: number;
  matchedLedgers: string[];
};

/** Build a fuzzy-match predicate from a company's name/short_name */
function makeMatcher(short: string, full: string): (ledger: string) => boolean {
  const tokens = [
    short.toLowerCase().trim(),
    full.toLowerCase().trim(),
  ]
    .filter((t) => t.length >= 4)
    // Strip generic suffixes ("Pvt Ltd", "LLP", "Enterprises") so e.g. "Yuval Industries LLP" still matches.
    .map((t) => t.replace(/\b(pvt\.?\s*ltd\.?|private limited|limited|llp|inc|enterprises?|industries?|barter|towers?|group)\b/gi, "").trim())
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return () => false;
  // Use only the first significant token (e.g. "yuval", "skyview") to keep matching reliable.
  const needle = tokens[0];
  return (ledger: string) => ledger.toLowerCase().includes(needle);
}

export async function fetchIntercompanyMatrix(
  supabase: SupabaseClient<Database>,
): Promise<IntercompanyRow[]> {
  // Load all active companies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (supabase as any)
    .from("companies")
    .select("id, name, short_name")
    .order("sort_order");
  if (!companies || companies.length === 0) return [];

  type Co = { id: string; name: string; short_name: string };
  const cos = companies as Co[];

  const matchers = cos.map((c) => ({ co: c, match: makeMatcher(c.short_name, c.name) }));

  const rows: IntercompanyRow[] = [];

  // For each company (owner), look at AP + AR aging and find ledgers matching
  // another group company's name.
  for (const owner of cos) {
    let apData, arData;
    try {
      [apData, arData] = await Promise.all([
        buildPartyAging(supabase, "vendor",   owner.id),
        buildPartyAging(supabase, "customer", owner.id),
      ]);
    } catch {
      continue;
    }

    // For each potential partner, scan owner's vendor/customer ledgers for a match
    for (const partner of matchers) {
      if (partner.co.id === owner.id) continue;
      let payable = 0;
      let receivable = 0;
      const matched: string[] = [];

      for (const v of apData.parties) {
        if (v.total > 0 && partner.match(v.party_name)) {
          payable += v.total;
          matched.push(`AP: ${v.party_name}`);
        }
      }
      for (const c of arData.parties) {
        if (c.total > 0 && partner.match(c.party_name)) {
          receivable += c.total;
          matched.push(`AR: ${c.party_name}`);
        }
      }

      if (payable === 0 && receivable === 0) continue;
      rows.push({
        ownerCompanyId:    owner.id,
        ownerCompanyName:  owner.short_name,
        partnerCompanyId:  partner.co.id,
        partnerCompanyName:partner.co.short_name,
        receivable, payable,
        net: receivable - payable,
        matchedLedgers: matched,
      });
    }
  }

  return rows;
}
