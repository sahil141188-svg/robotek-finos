"use client";

/**
 * AgingChart — Grouped bar chart showing AP and AR aging buckets side-by-side.
 * RULE 1: Each bar group is clickable — navigates to the dedicated AP / AR module.
 * Payables bars → /dashboard/payables, Receivables bars → /dashboard/receivables.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AgingBucket } from "@/lib/dashboard-data";

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
            ₹{(entry.value as number).toFixed(2)}L
          </span>
        </div>
      ))}
    </div>
  );
}

interface AgingChartProps {
  data: AgingBucket[];
}

export function AgingChart({ data }: AgingChartProps) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-brand-black">AP & AR Aging</h3>
          <p className="text-xs text-brand-gray-mid">
            Outstanding by age bucket · ₹ Lakhs · click a bar to drill down
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/payables"
            className="text-xs text-brand-red hover:underline"
          >
            AP →
          </Link>
          <Link
            href="/dashboard/receivables"
            className="text-xs text-brand-red hover:underline"
          >
            AR →
          </Link>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9A9596" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v}L`}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f4f4" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="ap"
              name="Payables"
              fill="#E52D31"
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={() => router.push("/dashboard/payables")}
            />
            <Bar
              dataKey="ar"
              name="Receivables"
              fill="#4f46e5"
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={() => router.push("/dashboard/receivables")}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
