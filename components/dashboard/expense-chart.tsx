"use client";

/**
 * ExpenseChart — Horizontal bar chart showing cost breakdown by category.
 * RULE 1: Each bar is clickable — future drill to category transactions.
 * Uses Recharts BarChart with per-bar colour via Cell.
 */

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { ExpenseItem } from "@/lib/dashboard-data";

interface TooltipEntry { name: string; value: number; color: string }
interface ChartTooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const pct = ((payload[0].value as number) / 146.2 * 100).toFixed(1);
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-2.5 min-w-[140px]">
      <p className="text-xs font-semibold text-brand-black">{label}</p>
      <p className="text-xs font-bold mt-1">
        ₹{(payload[0].value as number).toFixed(1)}L
      </p>
      <p className="text-[10px] text-brand-gray-mid">{pct}% of total costs</p>
    </div>
  );
}

interface ExpenseChartProps {
  data: ExpenseItem[];
}

export function ExpenseChart({ data }: ExpenseChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="rounded-xl border border-border bg-white p-5 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-brand-black">Cost Breakdown</h3>
        <p className="text-xs text-brand-gray-mid">
          Mar 2026 · ₹{total.toFixed(1)}L total
        </p>
      </div>

      {/* Chart */}
      {mounted ? (
      <div className="flex-1" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#f0f0f0"
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}L`}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 10, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f4f4" }} />
            <Bar
              dataKey="amount"
              name="Amount"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      ) : (
        <div className="flex-1 bg-brand-gray-light/30 rounded-lg animate-pulse" style={{ minHeight: 220 }} />
      )}
    </div>
  );
}
