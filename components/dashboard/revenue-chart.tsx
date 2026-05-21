"use client";

/**
 * RevenueChart — Area chart showing Revenue vs COGS vs Gross Profit trend.
 * RULE 1: Every chart point is clickable — navigates to the monthly drill page.
 * Uses Recharts AreaChart with gradient fills and a custom Indian-format tooltip.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RevenueTrendPoint } from "@/lib/dashboard-data";

// ─── Custom tooltip (Indian currency format) ─────────────────────────────────

interface TooltipEntry { name: string; value: number; color: string }
interface ChartTooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-brand-black mb-2">{label}</p>
      {payload.map((entry: TooltipEntry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-6 mb-0.5"
        >
          <span className="text-xs" style={{ color: entry.color }}>
            {entry.name}
          </span>
          <span className="text-xs font-semibold text-brand-black">
            ₹{(entry.value as number).toFixed(1)}L
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  data: RevenueTrendPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const router = useRouter();

  /** Navigate to Layer 2 drill for the clicked month */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (chartData: any) => {
    const period = chartData?.activePayload?.[0]?.payload?.period as
      | string
      | undefined;
    if (period) router.push(`/dashboard/drill/revenue/${period}`);
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-brand-black">
            Revenue vs Cost Trend
          </h3>
          <p className="text-xs text-brand-gray-mid">
            FY 2025–26 · last 6 months · ₹ Lakhs · click a month to drill down
          </p>
        </div>
        <Link
          href="/dashboard/drill/revenue"
          className="text-xs text-brand-red hover:underline shrink-0"
        >
          All months →
        </Link>
      </div>

      {/* Chart */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E52D31" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#E52D31" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#852321" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#852321" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gradGP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v}L`}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#E52D31"
              strokeWidth={2}
              fill="url(#gradRevenue)"
              dot={{ r: 3, fill: "#E52D31", strokeWidth: 0 }}
              activeDot={{ r: 5, cursor: "pointer" }}
            />
            <Area
              type="monotone"
              dataKey="cogs"
              name="COGS"
              stroke="#852321"
              strokeWidth={2}
              fill="url(#gradCogs)"
              dot={{ r: 3, fill: "#852321", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="grossProfit"
              name="Gross Profit"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#gradGP)"
              dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
