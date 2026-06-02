"use client";

/**
 * SeasonalChart — demand seasonality curve for the AI Sales Coordinator.
 * Bars show each month's demand multiplier vs an average month. The current
 * month is highlighted; provisional months (no real data yet) are muted.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { SEASONAL_INDEX, PROVISIONAL_MONTHS } from "@/lib/sales/seasonality";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TipProps { active?: boolean; payload?: { payload: { name: string; value: number; provisional: boolean } }[] }
function ChartTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-3">
      <p className="text-xs font-semibold text-brand-black">{p.name}</p>
      <p className="text-xs text-brand-gray-mid mt-1">{p.value.toFixed(2)}× an average month{p.provisional ? " (estimate)" : ""}</p>
    </div>
  );
}

export function SeasonalChart({ currentMonth }: { currentMonth: number }) {
  const data = MONTHS.map((name, i) => ({
    name,
    value: SEASONAL_INDEX[i + 1] ?? 1,
    provisional: PROVISIONAL_MONTHS.includes(i + 1),
    current: i + 1 === currentMonth,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F4F4" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9A9596" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9A9596" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={1} stroke="#9A9596" strokeDasharray="4 4" />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(229,45,49,0.06)" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.current ? "#F7DA11" : d.provisional ? "#E5E2E2" : d.value >= 1 ? "#E52D31" : "#C9A8A8"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
