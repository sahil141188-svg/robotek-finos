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

// sales_products + the newer unit_value + is_active columns
type ProductRowV = ProductRow & { unit_value: number | null; is_active: boolean };
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
    .from("sales_products").select("*").eq("is_breakeven", true).eq("is_active", true).order("monthly_target_qty", { ascending: false });
  const { count: focusTargetCount } = await sb
    .from("sales_customer_item_targets").select("*", { count: "exact", head: true }).eq("is_focus", true);

  // exclude discontinued dealers from churn + counts (status added in migration 014)
  const custList = ((customers ?? []) as (CustomerRow & { status?: string })[]).filter((c) => c.status !== "discontinued");
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
  const activeMap = new Map<string, boolean>();
  if (ids.length) {
    const { data: prods } = await sb.from("sales_products").select("id,name,unit_value,is_active").in("id", ids);
    for (const p of (prods ?? []) as Pick<ProductRowV, "id" | "name" | "unit_value" | "is_active">[]) {
      nameMap.set(p.id, p.name);
      valueMap.set(p.id, p.unit_value);
      activeMap.set(p.id, p.is_active);
    }
  }

  const rows: CustomerTargetRow[] = targets
    .filter((t) => activeMap.get(t.product_id) !== false) // drop discontinued items
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

// ─── CRR section: company item targets, category targets, customer list ───────

export type ItemTargetRow = {
  id: string;
  name: string;
  category: string | null;
  totalSold: number;
  monthlyTarget: number;        // history +10% (0 if not a target item)
  thisMonthTarget: number;      // seasonally scaled
  highValue: boolean;
  isBreakeven: boolean;
};

/** Company item-wise targets — top N selling items with their monthly target. */
export async function getItemTargets(db: DB, limit = 50) {
  const currentMonth = new Date().getMonth() + 1;
  const factor = seasonalFactor(currentMonth);
  const sb = db as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("sales_products").select("*").eq("is_active", true).order("total_qty_sold", { ascending: false }).limit(limit);
  const items: ItemTargetRow[] = ((data ?? []) as ProductRowV[]).map((p) => {
    const monthlyTarget = p.monthly_target_qty ?? 0;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      totalSold: p.total_qty_sold,
      monthlyTarget,
      thisMonthTarget: Math.round(monthlyTarget * factor),
      highValue: isHighValue(p.unit_value),
      isBreakeven: p.is_breakeven,
    };
  });
  return { currentMonth, provisionalMonth: PROVISIONAL_MONTHS.includes(currentMonth), items };
}

export type CategoryTargetRow = {
  category: string;
  itemCount: number;
  breakevenCount: number;
  highValueCount: number;
  totalSold: number;
  monthlyTarget: number;
  thisMonthTarget: number;
};

/** Category-wise targets — roll up monthly targets by product series. */
export async function getCategoryTargets(db: DB) {
  const currentMonth = new Date().getMonth() + 1;
  const factor = seasonalFactor(currentMonth);
  const sb = db as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("sales_products").select("*");
  const prods = (data ?? []) as ProductRowV[];
  const map = new Map<string, CategoryTargetRow>();
  for (const p of prods) {
    const cat = p.category || "OTHER";
    if (!map.has(cat)) map.set(cat, { category: cat, itemCount: 0, breakevenCount: 0, highValueCount: 0, totalSold: 0, monthlyTarget: 0, thisMonthTarget: 0 });
    const r = map.get(cat)!;
    r.totalSold += p.total_qty_sold || 0; // ALL qty incl. discontinued — demand stays in the category
    if (p.is_active) {
      r.itemCount++;
      if (p.is_breakeven) r.breakevenCount++;
      if (isHighValue(p.unit_value)) r.highValueCount++;
      r.monthlyTarget += p.monthly_target_qty ?? 0;
    }
  }
  const rows = [...map.values()].map((r) => ({ ...r, thisMonthTarget: Math.round(r.monthlyTarget * factor) }));
  rows.sort((a, b) => b.monthlyTarget - a.monthlyTarget || b.totalSold - a.totalSold);
  const totalMonthly = rows.reduce((a, r) => a + r.monthlyTarget, 0);
  return { currentMonth, provisionalMonth: PROVISIONAL_MONTHS.includes(currentMonth), rows, totalMonthly };
}

export type CustomerListRow = {
  id: string;
  name: string;
  segment: string | null;
  hasPhone: boolean;
  totalOrders: number;
  lastOrderAt: string | null;
  focusItems: number;
  focusMonthlyTotal: number;
  overdueRatio: number | null;
};

/** Customer item-wise targets — list of all customers (link to their item targets). */
export async function getCustomerTargetsList(db: DB) {
  const sb = db as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: customers } = await sb.from("sales_customers").select("*");
  const { data: foci } = await sb.from("sales_customer_item_targets").select("customer_id,product_id,monthly_target_qty,is_focus").eq("is_focus", true);
  const { data: actives } = await sb.from("sales_products").select("id").eq("is_active", true);
  const activeSet = new Set((actives ?? []).map((p: { id: string }) => p.id));
  const custList = ((customers ?? []) as (CustomerRow & { status?: string })[]).filter((c) => c.status !== "discontinued");
  const focusByCust = new Map<string, { n: number; total: number }>();
  for (const f of (foci ?? []) as { customer_id: string; product_id: string; monthly_target_qty: number }[]) {
    if (!activeSet.has(f.product_id)) continue; // skip discontinued items
    if (!focusByCust.has(f.customer_id)) focusByCust.set(f.customer_id, { n: 0, total: 0 });
    const e = focusByCust.get(f.customer_id)!;
    e.n++; e.total += f.monthly_target_qty || 0;
  }
  const asOfStr = custList.reduce<string | null>((m, c) => (c.last_order_at && (!m || c.last_order_at > m) ? c.last_order_at : m), null);
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const churnMap = new Map(buildChurn(custList, asOf).map((c) => [c.id, c.overdueRatio]));

  const rows: CustomerListRow[] = custList.map((c) => {
    const f = focusByCust.get(c.id) ?? { n: 0, total: 0 };
    return {
      id: c.id,
      name: c.name,
      segment: c.segment,
      hasPhone: !!(c.phone && c.phone.trim()),
      totalOrders: c.total_orders,
      lastOrderAt: c.last_order_at,
      focusItems: f.n,
      focusMonthlyTotal: f.total,
      overdueRatio: churnMap.get(c.id) ?? null,
    };
  });
  rows.sort((a, b) => b.focusMonthlyTotal - a.focusMonthlyTotal);
  return { rows, withPhone: rows.filter((r) => r.hasPhone).length };
}
