"use client";

/**
 * AlertsClient — interactive alert feed.
 * Supports category filter tabs, dismiss (localStorage), and drill-down links.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Alert, AlertCategory } from "@/lib/alerts-data";
import { PRIORITY_META, CATEGORY_META_ALERTS } from "@/lib/alerts-data";
import {
  AlertTriangle, ShieldAlert, TrendingDown, TrendingUp,
  CheckSquare, Landmark, X, Bell, ArrowRight,
} from "lucide-react";

const LS_DISMISSED = "rk_dismissed_alerts";

const CATEGORY_ICONS: Record<AlertCategory | "all", React.ElementType> = {
  all:        Bell,
  compliance: ShieldAlert,
  ap:         TrendingDown,
  ar:         TrendingUp,
  tasks:      CheckSquare,
  banking:    Landmark,
};

interface Props {
  alerts: Alert[];
}

export function AlertsClient({ alerts }: Props) {
  const [activeTab,     setActiveTab]     = useState<AlertCategory | "all">("all");
  // Lazy initializer reads localStorage once on mount — avoids setState-in-effect
  const [dismissed,     setDismissed]     = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(LS_DISMISSED);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [showDismissed, setShowDismissed] = useState(false);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(LS_DISMISSED, JSON.stringify([...next]));
      return next;
    });
  }

  function dismissAll() {
    const allIds = alerts.map((a) => a.id);
    const next = new Set(allIds);
    setDismissed(next);
    localStorage.setItem(LS_DISMISSED, JSON.stringify(allIds));
  }

  function restoreAll() {
    setDismissed(new Set());
    localStorage.removeItem(LS_DISMISSED);
  }

  // Filter by tab
  const tabFiltered = activeTab === "all"
    ? alerts
    : alerts.filter((a) => a.category === activeTab);

  const visible   = tabFiltered.filter((a) => !dismissed.has(a.id));
  const hidden    = tabFiltered.filter((a) => dismissed.has(a.id));

  // Category tab counts (undismissed only)
  const undismissed = alerts.filter((a) => !dismissed.has(a.id));
  function tabCount(cat: AlertCategory | "all") {
    return cat === "all" ? undismissed.length : undismissed.filter((a) => a.category === cat).length;
  }

  const TABS: (AlertCategory | "all")[] = ["all", "compliance", "ap", "ar", "tasks"];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => {
          const Icon  = CATEGORY_ICONS[tab];
          const count = tabCount(tab);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-brand-red text-white"
                  : "bg-white border border-border text-brand-gray-mid hover:text-brand-black"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab === "all" ? "All" : CATEGORY_META_ALERTS[tab as AlertCategory].label}
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                activeTab === tab
                  ? "bg-white/20 text-white"
                  : count > 0 ? "bg-brand-red/10 text-brand-red" : "bg-brand-gray-light text-brand-gray-mid"
              )}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Bulk actions */}
        {visible.length > 0 && (
          <button
            onClick={dismissAll}
            className="ml-auto text-xs text-brand-gray-mid hover:text-brand-black transition-colors"
          >
            Dismiss all
          </button>
        )}
        {dismissed.size > 0 && (
          <button
            onClick={restoreAll}
            className="text-xs text-brand-red hover:underline transition-colors"
          >
            Restore ({dismissed.size})
          </button>
        )}
      </div>

      {/* No alerts */}
      {visible.length === 0 && (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-semibold text-brand-black">All clear!</p>
          <p className="text-xs text-brand-gray-mid mt-1">
            {dismissed.size > 0
              ? `${dismissed.size} alert${dismissed.size > 1 ? "s" : ""} dismissed.`
              : "No active alerts for this category."}
          </p>
        </div>
      )}

      {/* Alert cards */}
      <div className="space-y-2">
        {visible.map((alert) => {
          const pm   = PRIORITY_META[alert.priority];
          const Icon = CATEGORY_ICONS[alert.category];

          return (
            <div
              key={alert.id}
              className={cn(
                "bg-white rounded-xl border border-border border-l-4 overflow-hidden transition-all",
                pm.borderCls
              )}
            >
              <div className="p-4 flex items-start gap-3">
                {/* Priority icon */}
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", pm.iconCls)}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide", pm.badgeCls)}>
                      {pm.label}
                    </span>
                    <span className="text-[10px] text-brand-gray-mid bg-brand-gray-light px-2 py-0.5 rounded-full">
                      {CATEGORY_META_ALERTS[alert.category].emoji} {CATEGORY_META_ALERTS[alert.category].label}
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold ml-auto",
                      alert.days_delta < 0 ? "text-red-600" : "text-brand-gray-mid"
                    )}>
                      {alert.time_label}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-brand-black leading-tight">{alert.title}</p>
                  <p className="text-xs text-brand-gray-mid mt-0.5 line-clamp-2">{alert.body}</p>

                  {/* Amount + drill link */}
                  <div className="flex items-center gap-3 mt-2">
                    {alert.amount && (
                      <span className="text-sm font-bold text-brand-black">{alert.amount}</span>
                    )}
                    {alert.drill_href && (
                      <Link
                        href={alert.drill_href}
                        className="inline-flex items-center gap-1 text-xs text-brand-red hover:underline font-medium"
                      >
                        View details <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => dismiss(alert.id)}
                  className="text-brand-gray-mid hover:text-brand-black p-1 rounded hover:bg-brand-gray-light transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show/hide dismissed alerts */}
      {hidden.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="text-xs text-brand-gray-mid hover:text-brand-black transition-colors"
          >
            {showDismissed ? "Hide" : `Show ${hidden.length} dismissed alert${hidden.length > 1 ? "s" : ""}`}
          </button>

          {showDismissed && (
            <div className="mt-3 space-y-2 opacity-50">
              {hidden.map((alert) => {
                const pm = PRIORITY_META[alert.priority];
                return (
                  <div key={alert.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3 line-through">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pm.dotCls)} />
                    <p className="text-xs text-brand-gray-mid flex-1 truncate">{alert.title}</p>
                    <button
                      onClick={() => {
                        setDismissed((prev) => {
                          const next = new Set(prev);
                          next.delete(alert.id);
                          localStorage.setItem(LS_DISMISSED, JSON.stringify([...next]));
                          return next;
                        });
                      }}
                      className="text-xs text-brand-red hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
