/**
 * "What changed today?" AI summary card — React Server Component.
 *
 * Calls getDailySummaryBullets() which queries the transactions table and
 * optionally calls Claude Haiku for 5 natural-language bullets.
 * Wrap in <Suspense> on the dashboard page so it streams in after the
 * KPI tiles (which render immediately from cached data).
 */

import { getDailySummaryBullets } from "@/app/actions/daily-summary";
import { Sparkles } from "lucide-react";

export async function DailySummaryCard() {
  const { bullets, todayDate, hasClaude } = await getDailySummaryBullets();

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-brand-red" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-black">What changed today?</h3>
            <p className="text-xs text-brand-gray-mid">
              {new Date(todayDate).toLocaleDateString("en-IN", {
                weekday: "short", day: "numeric", month: "short",
              })} · {hasClaude ? "AI-powered" : "Auto"} summary vs yesterday
            </p>
          </div>
        </div>
        {hasClaude && (
          <span className="text-[9px] font-semibold bg-brand-red/10 text-brand-red px-2 py-0.5 rounded-full border border-brand-red/20 shrink-0">
            Claude Haiku
          </span>
        )}
      </div>

      <ul className="space-y-2.5">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-gray-light text-brand-black text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-brand-black leading-snug">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Skeleton shown by <Suspense> while the server component is loading */
export function DailySummaryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border p-5 animate-pulse">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-gray-light" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 bg-brand-gray-light rounded" />
          <div className="h-2.5 w-28 bg-brand-gray-light rounded" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-brand-gray-light shrink-0 mt-0.5" />
            <div className="h-3.5 bg-brand-gray-light rounded flex-1" style={{ width: `${70 + i * 5}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
