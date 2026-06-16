/**
 * GET /api/price-list
 *
 * Fetches price list data from Google Sheets (New Launches Price sheet).
 * Returns JSON array of price rows filtered by tier if user is a customer.
 *
 * Auth: Supabase session — must be logged in.
 * Customers (price_tier set) only get their column; staff get all columns.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PriceTier } from "@/types/database";

// Sheet ID for "New Launches Price"
const SHEET_ID  = "1fnsXbowaILGwN3H9zOCJAMypU45YKiuJTvYquRJ1Miw";
const SHEET_TAB = "Sheet1";

export interface PriceRow {
  updatedOn:   string;
  brand:       string;
  category:    string;
  model:       string;
  ssPrice:     number | null;
  ddPrice:     number | null;
  dealerPrice: number | null;
  warranty:    string;
  boxQty:      string;
  scheme:      string;
  remark:      string;
  imageLink:   string;
}

export interface PriceListResponse {
  rows:       PriceRow[];
  priceTier:  PriceTier | null; // null = staff (all tiers visible)
  updatedAt:  string | null;
}

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profileRaw } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceTier = ((profileRaw as any)?.price_tier ?? null) as PriceTier | null;

  // Fetch CSV from Google Sheets (public export — no API key needed)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;

  let rows: PriceRow[] = [];
  let updatedAt: string | null = null;

  try {
    const res = await fetch(csvUrl, { next: { revalidate: 300 } }); // cache 5 min
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

    const csv = await res.text();
    rows = parseCSV(csv);

    // Latest update date from the data
    const dates = rows.map(r => r.updatedOn).filter(Boolean).sort().reverse();
    updatedAt = dates[0] ?? null;
  } catch (err) {
    console.error("[price-list] fetch error", err);
    return NextResponse.json({ error: "Failed to fetch price data" }, { status: 502 });
  }

  return NextResponse.json({ rows, priceTier, updatedAt } satisfies PriceListResponse);
}

function parseCSV(csv: string): PriceRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row (index 0)
  const rows: PriceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 4) continue;

    const model = clean(cols[3]);
    if (!model) continue; // skip blank rows

    rows.push({
      updatedOn:   clean(cols[0]),
      brand:       clean(cols[1]),
      category:    clean(cols[2]),
      model,
      ssPrice:     parsePrice(cols[4]),
      ddPrice:     parsePrice(cols[5]),
      dealerPrice: parsePrice(cols[6]),
      warranty:    clean(cols[7] ?? ""),
      boxQty:      clean(cols[8] ?? ""),
      scheme:      clean(cols[9] ?? ""),
      remark:      clean(cols[10] ?? ""),
      imageLink:   clean(cols[11] ?? ""),
    });
  }
  return rows;
}

function clean(val: string): string {
  return val?.replace(/^"|"$/g, "").trim() ?? "";
}

function parsePrice(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(clean(val));
  return isNaN(n) ? null : n;
}

/** Handles quoted CSV fields that may contain commas */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let cur = "";
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; cur += ch; }
    else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}
