"use client";

/**
 * CashflowChart — Grouped bar chart: weekly inflow vs outflow.
 * Uses Recharts BarChart. Every bar is clickable (RULE 1).
 */

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
interface WeeklyBucket {
  week: string;
  inflow: number;
  outflow: number;
}

interface Props {
  data: WeeklyBucket[];
}

function formatK(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const inflow  = payload.find((p) => p.name === "Inflow");
  const outflow = payload.find((p) => p.name === "Outflow");
  const net     = (inflow?.value ?? 0) - (outflow?.value ?? 0);
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-brand-black">{label}</p>
      {inflow  && <p className="text-green-700">↑ Inflow:  {formatK(inflow.value)}</p>}
      {outflow && <p className="text-red-700">↓ Outflow: {formatK(outflow.value)}</p>}
      <p className={`font-semibold border-t border-border pt-1 ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
        Net: {net >= 0 ? "+" : ""}{formatK(net)}
      </p>
    </div>
  );
}

export function CashflowChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ height: 260 }} />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#F5F4F4" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "#9A9596" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11, fill: "#9A9596" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F5F4F4", radius: 4 }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="inflow"  name="Inflow"  fill="#16a34a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="outflow" name="Outflow" fill="#E52D31" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
