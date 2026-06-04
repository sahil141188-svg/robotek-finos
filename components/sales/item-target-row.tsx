"use client";

/**
 * One row in the Company Item Targets table. The monthly target cell is
 * inline-editable via EditableTarget. The seasonal goal auto-updates after save.
 */
import { useState } from "react";
import { Star } from "lucide-react";
import { EditableTarget } from "./editable-target";
import { updateProductTarget } from "@/app/actions/sales";
import { formatQty } from "@/lib/format";
import type { ItemTargetRow } from "@/lib/supabase/sales-queries";

export function ItemTargetRow({ item, rank, monthLabel }: { item: ItemTargetRow; rank: number; monthLabel: string }) {
  const [target, setTarget] = useState(item.monthlyTarget);

  async function handleSave(qty: number) {
    const res = await updateProductTarget(item.id, qty);
    if (res.ok) setTarget(qty);
    return res;
  }

  return (
    <tr className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
      <td className="px-5 py-2.5 text-brand-gray-mid">{rank}</td>
      <td className="px-3 py-2.5 font-medium text-brand-black">
        {item.highValue && <Star className="inline w-3.5 h-3.5 mr-1.5 text-brand-yellow fill-brand-yellow align-text-bottom" />}
        {item.name}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs rounded-full bg-brand-gray-light px-2 py-0.5 text-brand-gray-mid">{item.category ?? "—"}</span>
      </td>
      <td className="px-3 py-2.5 text-right text-brand-gray-mid">{formatQty(item.totalSold)}</td>
      <td className="px-3 py-2.5 text-right">
        <EditableTarget value={target} onSave={handleSave} suffix="/mo" />
      </td>
      <td className="px-5 py-2.5 text-right font-semibold text-brand-black">
        {target ? formatQty(item.thisMonthTarget) : "—"}
      </td>
    </tr>
  );
}
