"use client";

/**
 * PriceListClient — interactive price list page.
 *
 * Staff (priceTier = null):  see all three tier tabs + brand/category filters.
 * Customers (priceTier set): see only their tier, no switching.
 *
 * Data pulled from /api/price-list → Google Sheets (New Launches Price sheet).
 */

import { useEffect, useState, useMemo } from "react";
import { Badge }  from "@/components/ui/badge";
import { Input }  from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Search, ExternalLink, Tag } from "lucide-react";
import type { PriceListResponse, PriceRow } from "@/app/api/price-list/route";
import type { PriceTier } from "@/types/database";

const TIER_LABELS: Record<PriceTier, string> = {
  ss:     "Sub-Stockist (SS)",
  dd:     "Distributor (DD)",
  dealer: "Dealer",
};

const TIER_COLORS: Record<PriceTier, string> = {
  ss:     "bg-blue-100 text-blue-800 border-blue-200",
  dd:     "bg-purple-100 text-purple-800 border-purple-200",
  dealer: "bg-green-100 text-green-800 border-green-200",
};

function priceForTier(row: PriceRow, tier: PriceTier): number | null {
  if (tier === "ss")     return row.ssPrice;
  if (tier === "dd")     return row.ddPrice;
  if (tier === "dealer") return row.dealerPrice;
  return null;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return `₹${n.toFixed(2)}`;
}

export function PriceListClient({ priceTier }: { priceTier: PriceTier | null }) {
  const [data,        setData]        = useState<PriceListResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTier,  setActiveTier]  = useState<PriceTier>(priceTier ?? "ss");
  const [search,      setSearch]      = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [catFilter,   setCatFilter]   = useState<string>("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/price-list");
      if (!res.ok) throw new Error(await res.text());
      const json: PriceListResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Unique brands and categories for filter dropdowns
  const brands = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rows.map(r => r.brand).filter(Boolean))].sort();
  }, [data]);

  const categories = useMemo(() => {
    if (!data) return [];
    const filtered = brandFilter === "all"
      ? data.rows
      : data.rows.filter(r => r.brand === brandFilter);
    return [...new Set(filtered.map(r => r.category).filter(Boolean))].sort();
  }, [data, brandFilter]);

  // Filtered rows for the active tier
  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter(r => {
      if (brandFilter !== "all" && r.brand !== brandFilter) return false;
      if (catFilter   !== "all" && r.category !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.model.toLowerCase().includes(q) ||
               r.brand.toLowerCase().includes(q) ||
               r.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, brandFilter, catFilter, search]);

  const tiers: PriceTier[] = priceTier ? [priceTier] : ["ss", "dd", "dealer"];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1F1B20]">Price List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {priceTier
              ? <>Your price tier: <span className="font-medium">{TIER_LABELS[priceTier]}</span></>
              : "Live prices — updated automatically from master sheet"}
          </p>
          {data?.updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {data.updatedAt}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Tier badge for customers ── */}
      {priceTier && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${TIER_COLORS[priceTier]}`}>
          <Tag className="h-4 w-4" />
          You are viewing <strong>{TIER_LABELS[priceTier]}</strong> prices
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={brandFilter} onValueChange={v => { setBrandFilter(v ?? "all"); setCatFilter("all"); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={v => setCatFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabs (hidden for customers — they only have one tier) ── */}
      <Tabs value={activeTier} onValueChange={v => setActiveTier(v as PriceTier)}>
        {!priceTier && (
          <TabsList className="mb-1">
            <TabsTrigger value="ss">Sub-Stockist (SS)</TabsTrigger>
            <TabsTrigger value="dd">Distributor (DD)</TabsTrigger>
            <TabsTrigger value="dealer">Dealer</TabsTrigger>
          </TabsList>
        )}

        {tiers.map(tier => (
          <TabsContent key={tier} value={tier} className="mt-0">
            <PriceTable
              rows={rows}
              tier={tier}
              loading={loading}
              showAllTiers={!priceTier}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Footer count ── */}
      {!loading && data && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {rows.length} of {data.rows.length} products
        </p>
      )}
    </div>
  );
}

// ── Price Table ─────────────────────────────────────────────────────────────

function PriceTable({
  rows,
  tier,
  loading,
  showAllTiers,
}: {
  rows:         PriceRow[];
  tier:         PriceTier;
  loading:      boolean;
  showAllTiers: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-white">
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-32 flex-1" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border bg-white py-16 text-center text-muted-foreground text-sm">
        No products match your filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#1F1B20] hover:bg-[#1F1B20]">
            <TableHead className="text-white font-semibold w-[100px]">Brand</TableHead>
            <TableHead className="text-white font-semibold w-[130px]">Category</TableHead>
            <TableHead className="text-white font-semibold">Model</TableHead>
            {showAllTiers ? (
              <>
                <TableHead className="text-white font-semibold text-right w-[90px]">SS ₹</TableHead>
                <TableHead className="text-white font-semibold text-right w-[90px]">DD ₹</TableHead>
                <TableHead className="text-white font-semibold text-right w-[90px]">Dealer ₹</TableHead>
              </>
            ) : (
              <TableHead className="text-white font-semibold text-right w-[110px]">Price (₹)</TableHead>
            )}
            <TableHead className="text-white font-semibold w-[80px]">Warranty</TableHead>
            <TableHead className="text-white font-semibold w-[70px]">Box Qty</TableHead>
            <TableHead className="text-white font-semibold w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const price = priceForTier(row, tier);
            return (
              <TableRow
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-[#F5F4F4]"}
              >
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      row.brand === "Robotek"
                        ? "border-[#E52D31] text-[#E52D31] bg-red-50"
                        : "border-[#852321] text-[#852321] bg-red-50/50"
                    }
                  >
                    {row.brand}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.category}
                </TableCell>
                <TableCell className="font-medium text-[#1F1B20]">
                  {row.model}
                  {row.scheme && (
                    <span className="ml-2 text-xs text-[#E52D31] font-normal">
                      🎁 {row.scheme}
                    </span>
                  )}
                  {row.remark && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                      {row.remark}
                    </p>
                  )}
                </TableCell>
                {showAllTiers ? (
                  <>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.ssPrice)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.ddPrice)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(row.dealerPrice)}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-right">
                    <span className="font-bold text-[#E52D31] text-base">
                      {fmt(price)}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">{row.warranty || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.boxQty || "—"}</TableCell>
                <TableCell>
                  {row.imageLink && (
                    <a
                      href={row.imageLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-[#E52D31] transition-colors"
                      title="View product image"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
