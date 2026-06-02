/**
 * Server-side queries for the AI Sales Coordinator (Module 9).
 *
 * Reads the sales_* tables (RLS: any authenticated user can SELECT) and
 * derives:
 *   • Churn Radar   — who is overdue vs their own reorder rhythm
 *   • Target board  — breakeven items + their seasonal monthly target
 *   • Per-customer focus targets — the daily push list for one customer
 *
 * NOTE: the order data is currently HISTORICAL (the live current-year tab is
 * not wired yet), so Churn Radar is computed "as of" the latest order date in
 * the data, not today. Once live data syncs, this becomes real-time.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { seasonalFactor, PROVISIONAL_MONTHS } from "@/lib/sales/seasonality";

type DB = SupabaseClient<Database>;
const DAY = 86_400_000;

// Row aliases — the project casts query results to these (supabase-js `.select("*")`
// resolves to `never` here because the schema omits `Relationships`; see party-aging.ts).
type CustomerRow = Database["public"]["Tables"]["sales_customers"]["Row"];
type ProductRow = Database["public"]["Tables"]["sales_products"]["Row"];
type TargetRow = Database["public"]["Tables"]["sales_customer_item_targets"]["Row"];

export type ChurnRow = {
  id: string;
  name: string;
  phone: string | null;
  segment: string | null;
  totalOrders: number;
  lastOrderAt: string | null;
  avgGapDays: number;
  daysSince: number;
  overdueRatio: number; // daysSince / avgGapDays; >=1 means overdue
};

export type BreakevenItem = {
  id: string;
  name: string;
  monthlyTarget: number;       // baseline monthly target (history +10%)
  thisMonthTarget: number;     // baseline * seasonal factor for current month
  totalSold: number;
  highValue: boolean;          // ⭐ rough value signal — push first (no ₹ shown)
};

// sales_products + the new unit_value column (rough Rs/unit, reference only)
type ProductRowV = ProductRow & { unit_value: number | null };
/** A product is "high value" if its rough Rs/unit is at/above this. Internal only. */
const HIGH_VALUE_PER_UNIT = 20;
const isHighValue = (uv: number | null | undefined) => (uv ?? 0) >= HIGH_VALUE_PER_UNIT;
/** Rough value-weight for ranking which items to push first (never displayed). */
const valueWeight = (qty: number, uv: number | null | undefined) => qty * (uv ?? 0);

export type OverviewKpis = {
  asOf: string | null;
  currentMonth: number;
  provisionalMonth: boolean;
  customerCount: number;
  breakevenItemCount: number;
  focusTargetCount: number;
  monthlyTargetBaseline: number;  // sum of breakeven monthly targets
  thisMonthTarget: number;        // seasonally scaled
  overdueCount: number;
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / DAY));
}

/** Compute churn rows from the maintained sales_customers columns (no heavy join). */
function buildChurn(
  customers: Database["public"]["Tables"]["sales_customers"]["Row"][],
  asOf: Date
): ChurnRow[] {
  const rows: ChurnRow[] = [];
  for (const c of customers) {
    if (c.total_orders < 3 || !c.first_order_at || !c.last_order_at) continue;
    const first = new Date(c.first_order_at);
    const last = new Date(c.last_order_at);
    const spanDays = daysBetween(last, first);
    const avgGapDays = spanDays / Math.max(1, c.total_orders - 1);
    if (avgGapDays <= 0) continue;
    const daysSince = daysBetween(asOf, last);
    rows.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      segment: c.segment,
      totalOrders: c.total_orders,
      lastOrderAt: c.last_order_at,
      avgGapDays: Math.round(avgGapDays * 10) / 10,
      daysSince,
      overdueRatio: Math.round((daysSince / avgGapDays) * 10) / 10,
    });
  }
  return rows.sort((a, b) => b.overdueRatio - a.overdueRatio);
}

/** Overview: KPIs + Churn Radar + breakeven target board. */
export async function getSalesOverview(db: DB) {
  const currentMonth = new Date().getMonth() + 1;
  const factor = seasonalFactor(currentMonth);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sb = db as any;
  const { data: customers } = await sb.from("sales_customers").select("*");
  const { data: products } = await sb
    .from("sales_products").select("*").eq("is_breakeven", true).order("monthly_target_qty", { ascending: false });
  const { count: focusTargetCount } = await sb
    .from("sales_customer_item_targets").select("*", { count: "exact", head: true }).eq("is_focus", true);

  const custList = (customers ?? []) as CustomerRow[];
  const prodList = (products ?? []) as ProductRowV[];

  // reference "today" = latest order date in the data (historical dataset)
  const asOfStr = custList.reduce<string | null>(
    (m, c) => (c.last_order_at && (!m || c.last_order_at > m) ? c.last_order_at : m),
    null
  );
  const asOf = asOfStr ? new Date(asOfStr) : new Date();

  const churn = buildChurn(custList, asOf);
  const overdueCount = churn.filter((r) => r.overdueRatio >= 1.5).length;

  const breakevenItems: BreakevenItem[] = prodList
    .map((p) => {
      const monthlyTarget = p.monthly_target_qty ?? 0;
      return {
        id: p.id,
        name: p.name,
        monthlyTarget,
        thisMonthTarget: Math.round(monthlyTarget * factor),
        totalSold: p.total_qty_sold,
        highValue: isHighValue(p.unit_value),
        _w: valueWeight(p.total_qty_sold, p.unit_value),
      };
    })
    // push the highest-value items first (rough signal, never shown)
    .sort((a, b) => b._w - a._w)
    .map(({ _w, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

  const monthlyTargetBaseline = breakevenItems.reduce((a, b) => a + b.monthlyTarget, 0);

  const kpis: OverviewKpis = {
    asOf: asOfStr,
    currentMonth,
    provisionalMonth: PROVISIONAL_MONTHS.includes(currentMonth),
    customerCount: custList.length,
    breakevenItemCount: prodList.length,
    focusTargetCount: focusTargetCount ?? 0,
    monthlyTargetBaseline,
    thisMonthTarget: Math.round(monthlyTargetBaseline * factor),
    overdueCount,
  };

  return { kpis, churn: churn.slice(0, 15), breakevenItems: breakevenItems.slice(0, 20) };
}

export type CustomerTargetRow = {
  productId: string;
  productName: string;
  monthlyTarget: number;
  thisMonthTarget: number;
  monthsActive: number;
  totalQty: number;
  lastQty: number | null;
  lastOrderedAt: string | null;
  isFocus: boolean;
  highValue: boolean;          // ⭐ push first (rough value signal, no ₹ shown)
};

/** Per-customer detail: their focus + occasional item targets, and churn status. */
export async function getCustomerDetail(db: DB, customerId: string) {
  const currentMonth = new Date().getMonth() + 1;
  const factor = seasonalFactor(currentMonth);

  const sb = db as any;
  const { data: customerData } = await sb.from("sales_customers").select("*").eq("id", customerId).maybeSingle();
  const customer = customerData as CustomerRow | null;
  if (!customer) return null;

  const { data: targetsData } = await sb
    .from("sales_customer_item_targets").select("*").eq("customer_id", customerId).order("total_qty", { ascending: false });
  const { data: latestData } = await sb
    .from("sales_customers").select("last_order_at").order("last_order_at", { ascending: false }).limit(1).maybeSingle();
  const targets = (targetsData ?? []) as TargetRow[];
  const latest = latestData as { last_order_at: string | null } | null;

  // map product ids → name + rough unit value
  const ids = targets.map((t) => t.product_id);
  const nameMap = new Map<string, string>();
  const valueMap = new Map<string, number | null>();
  if (ids.length) {
    const { data: prods } = await sb.from("sales_products").select("id,name,unit_value").in("id", ids);
    for (const p of (prods ?? []) as Pick<ProductRowV, "id" | "name" | "unit_value">[]) {
      nameMap.set(p.id, p.name);
      valueMap.set(p.id, p.unit_value);
    }
  }

  const rows: CustomerTargetRow[] = targets
    .map((t) => ({
      productId: t.product_id,
      productName: nameMap.get(t.product_id) ?? "—",
      monthlyTarget: t.monthly_target_qty,
      thisMonthTarget: Math.round(t.monthly_target_qty * factor),
      monthsActive: t.months_active,
      totalQty: t.total_qty,
      lastQty: t.last_qty,
      lastOrderedAt: t.last_ordered_at,
      isFocus: t.is_focus,
      highValue: isHighValue(valueMap.get(t.product_id)),
    }))
    // push high-value items first within each list (rough signal, never shown)
    .sort((a, b) => valueWeight(b.monthlyTarget, valueMap.get(b.productId)) - valueWeight(a.monthlyTarget, valueMap.get(a.productId)));

  // churn status for this customer (as of latest order date in data)
  const asOf = latest?.last_order_at ? new Date(latest.last_order_at) : new Date();
  const [churn] = buildChurn([customer], asOf);

  return {
    customer,
    currentMonth,
    provisionalMonth: PROVISIONAL_MONTHS.includes(currentMonth),
    focus: rows.filter((r) => r.isFocus),
    occasional: rows.filter((r) => !r.isFocus),
    churn: churn ?? null,
    focusMonthlyTotal: rows.filter((r) => r.isFocus).reduce((a, r) => a + r.monthlyTarget, 0),
  };
}
