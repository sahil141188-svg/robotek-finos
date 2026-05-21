/**
 * Smart Alerts Engine — Module 8
 *
 * Generates prioritised, real-data alerts from compliance, AP, AR, and tasks.
 * TODAY = 2026-05-22.
 *
 * Priority levels:
 *   critical — overdue items, heavy penalties, 90+ day aging
 *   high     — due in ≤ 3 days, 61-90 day aging, urgent tasks overdue
 *   medium   — due in 4-7 days, 31-60 day aging, high-priority tasks due soon
 *   low      — due in 8-14 days, 0-30 day aging reminders
 */

import { COMPLIANCE_ITEMS, daysFromToday } from "./compliance-data";
import { SAMPLE_VENDORS, SAMPLE_AP_INVOICES, vendorTotal, fmtAmt } from "./payables-data";
import { SAMPLE_CUSTOMERS, SAMPLE_AR_INVOICES, customerTotal } from "./receivables-data";
import { SAMPLE_TASKS, effectiveStatus } from "./tasks-data";

const TODAY = "2026-05-22";

export type AlertPriority = "critical" | "high" | "medium" | "low";
export type AlertCategory = "compliance" | "ap" | "ar" | "tasks" | "banking";

export interface Alert {
  id:          string;
  priority:    AlertPriority;
  category:    AlertCategory;
  title:       string;
  body:        string;
  drill_href?: string;           // where to navigate on click
  amount?:     string;           // formatted INR amount if relevant
  time_label:  string;           // "2 days overdue", "Due in 3 days", etc.
  days_delta:  number;           // negative = overdue, positive = days remaining
}

// ─── Priority sort weight ─────────────────────────────────────────────────────
const PRIORITY_WEIGHT: Record<AlertPriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

// ─── Compliance alerts ────────────────────────────────────────────────────────
function buildComplianceAlerts(): Alert[] {
  const alerts: Alert[] = [];

  COMPLIANCE_ITEMS.forEach((item) => {
    if (item.status === "filed" || item.status === "paid" || item.status === "not_applicable") return;

    const days = daysFromToday(item.due_date, TODAY);   // negative = overdue
    if (days > 14) return;   // only alert on items within 14 days

    let priority: AlertPriority;
    let time_label: string;

    if (days < 0) {
      priority   = "critical";
      time_label = `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} OVERDUE`;
    } else if (days === 0) {
      priority   = "critical";
      time_label = "Due TODAY";
    } else if (days <= 3) {
      priority   = "high";
      time_label = `Due in ${days} day${days !== 1 ? "s" : ""}`;
    } else if (days <= 7) {
      priority   = "medium";
      time_label = `Due in ${days} days`;
    } else {
      priority   = "low";
      time_label = `Due in ${days} days`;
    }

    const amtStr = item.amount_due
      ? ` Tax: ${fmtAmt(item.amount_due)}.`
      : "";

    alerts.push({
      id:         `comp-${item.id}`,
      priority,
      category:   "compliance",
      title:      `${item.title}`,
      body:       `${item.description}${amtStr} Period: ${item.period}.`,
      drill_href: `/dashboard/compliance/${item.id}`,
      amount:     item.amount_due ? fmtAmt(item.amount_due) : undefined,
      time_label,
      days_delta: days,
    });
  });

  return alerts;
}

// ─── AP alerts ────────────────────────────────────────────────────────────────
function buildAPAlerts(): Alert[] {
  const alerts: Alert[] = [];

  // Group invoices by vendor
  const byVendor: Record<string, typeof SAMPLE_AP_INVOICES> = {};
  SAMPLE_AP_INVOICES.forEach((inv) => {
    if (inv.status !== "overdue") return;
    (byVendor[inv.vendor_id] ??= []).push(inv);
  });

  Object.entries(byVendor).forEach(([vendorId, invoices]) => {
    const vendor = SAMPLE_VENDORS.find((v) => v.id === vendorId);
    if (!vendor) return;

    const totalOverdue = invoices.reduce((s, i) => s + i.amount, 0);
    const maxDays      = Math.max(...invoices.map((i) => i.days_outstanding));

    let priority: AlertPriority;
    if (maxDays >= 90)      priority = "critical";
    else if (maxDays >= 61) priority = "high";
    else if (maxDays >= 31) priority = "medium";
    else                    priority = "low";

    alerts.push({
      id:         `ap-${vendorId}`,
      priority,
      category:   "ap",
      title:      `AP Overdue — ${vendor.name}`,
      body:       `${invoices.length} invoice${invoices.length > 1 ? "s" : ""} overdue. ` +
                  `Oldest: ${maxDays} days. Payment terms: ${vendor.payment_terms_days} days.`,
      drill_href: `/dashboard/payables/${vendorId}`,
      amount:     fmtAmt(totalOverdue),
      time_label: `${maxDays} days overdue`,
      days_delta: -maxDays,
    });
  });

  // Also alert on invoices due very soon (within 3 days)
  SAMPLE_AP_INVOICES
    .filter((inv) => inv.status === "outstanding")
    .forEach((inv) => {
      const days = Math.round(
        (new Date(inv.due_date).getTime() - new Date(TODAY).getTime()) / 86400000
      );
      if (days <= 3 && days >= 0) {
        const vendor = SAMPLE_VENDORS.find((v) => v.id === inv.vendor_id);
        if (!vendor) return;
        alerts.push({
          id:         `ap-due-${inv.id}`,
          priority:   days === 0 ? "critical" : "high",
          category:   "ap",
          title:      `AP Due Soon — ${vendor.name}`,
          body:       `Invoice ${inv.invoice_no} for ${fmtAmt(inv.amount)} is due ${days === 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`}.`,
          drill_href: `/dashboard/payables/${vendor.id}`,
          amount:     fmtAmt(inv.amount),
          time_label: days === 0 ? "Due TODAY" : `Due in ${days} day${days !== 1 ? "s" : ""}`,
          days_delta: days,
        });
      }
    });

  return alerts;
}

// ─── AR alerts ────────────────────────────────────────────────────────────────
function buildARAlerts(): Alert[] {
  const alerts: Alert[] = [];

  const byCustomer: Record<string, typeof SAMPLE_AR_INVOICES> = {};
  SAMPLE_AR_INVOICES.forEach((inv) => {
    if (inv.status !== "overdue") return;
    (byCustomer[inv.customer_id] ??= []).push(inv);
  });

  Object.entries(byCustomer).forEach(([customerId, invoices]) => {
    const customer = SAMPLE_CUSTOMERS.find((c) => c.id === customerId);
    if (!customer) return;

    const totalOverdue = invoices.reduce((s, i) => s + i.amount, 0);
    const maxDays      = Math.max(...invoices.map((i) => i.days_outstanding));

    let priority: AlertPriority;
    if (maxDays >= 90)      priority = "critical";
    else if (maxDays >= 61) priority = "high";
    else if (maxDays >= 31) priority = "medium";
    else                    priority = "low";

    alerts.push({
      id:         `ar-${customerId}`,
      priority,
      category:   "ar",
      title:      `AR Overdue — ${customer.name}`,
      body:       `${invoices.length} invoice${invoices.length > 1 ? "s" : ""} uncollected. ` +
                  `Oldest: ${maxDays} days. Credit limit: ${fmtAmt(customer.credit_limit)}.`,
      drill_href: `/dashboard/receivables/${customerId}`,
      amount:     fmtAmt(totalOverdue),
      time_label: `${maxDays} days overdue`,
      days_delta: -maxDays,
    });
  });

  return alerts;
}

// ─── Task alerts ──────────────────────────────────────────────────────────────
function buildTaskAlerts(): Alert[] {
  const alerts: Alert[] = [];

  SAMPLE_TASKS.forEach((task) => {
    const status = effectiveStatus(task, TODAY);
    if (status === "completed" || status === "cancelled") return;

    if (!task.due_date) return;

    const days = Math.round(
      (new Date(task.due_date).getTime() - new Date(TODAY).getTime()) / 86400000
    );

    if (days > 7) return;   // only alert tasks due within 7 days or overdue

    let priority: AlertPriority;
    let time_label: string;

    if (status === "overdue" || days < 0) {
      priority   = task.priority === "urgent" ? "critical" : "high";
      time_label = `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} OVERDUE`;
    } else if (days === 0) {
      priority   = "high";
      time_label = "Due TODAY";
    } else if (days <= 3) {
      priority   = task.priority === "urgent" || task.priority === "high" ? "high" : "medium";
      time_label = `Due in ${days} day${days !== 1 ? "s" : ""}`;
    } else {
      priority   = "medium";
      time_label = `Due in ${days} days`;
    }

    alerts.push({
      id:         `task-${task.id}`,
      priority,
      category:   "tasks",
      title:      task.title,
      body:       `Assigned to: ${task.assigned_to}. Priority: ${task.priority.toUpperCase()}. ${task.description.slice(0, 100)}${task.description.length > 100 ? "…" : ""}`,
      drill_href: `/dashboard/tasks/${task.id}`,
      time_label,
      days_delta: days,
    });
  });

  return alerts;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/** Returns all active alerts sorted by priority then days_delta */
export function getAllAlerts(): Alert[] {
  const all = [
    ...buildComplianceAlerts(),
    ...buildAPAlerts(),
    ...buildARAlerts(),
    ...buildTaskAlerts(),
  ];

  // Sort: critical first, then by most overdue/most urgent
  return all.sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    return a.days_delta - b.days_delta;   // most overdue first
  });
}

export function alertsByCategory(cat: AlertCategory | "all"): Alert[] {
  const all = getAllAlerts();
  return cat === "all" ? all : all.filter((a) => a.category === cat);
}

export function alertCounts() {
  const all = getAllAlerts();
  return {
    total:    all.length,
    critical: all.filter((a) => a.priority === "critical").length,
    high:     all.filter((a) => a.priority === "high").length,
    medium:   all.filter((a) => a.priority === "medium").length,
    low:      all.filter((a) => a.priority === "low").length,
    compliance: all.filter((a) => a.category === "compliance").length,
    ap:       all.filter((a) => a.category === "ap").length,
    ar:       all.filter((a) => a.category === "ar").length,
    tasks:    all.filter((a) => a.category === "tasks").length,
  };
}

/** Colour/style metadata per priority */
export const PRIORITY_META: Record<AlertPriority, {
  label:      string;
  badgeCls:   string;
  iconCls:    string;
  borderCls:  string;
  dotCls:     string;
}> = {
  critical: {
    label:     "Critical",
    badgeCls:  "bg-red-100 text-red-800 border-red-200",
    iconCls:   "bg-red-100 text-red-700",
    borderCls: "border-l-red-500",
    dotCls:    "bg-red-500",
  },
  high: {
    label:     "High",
    badgeCls:  "bg-orange-100 text-orange-800 border-orange-200",
    iconCls:   "bg-orange-100 text-orange-700",
    borderCls: "border-l-orange-400",
    dotCls:    "bg-orange-400",
  },
  medium: {
    label:     "Medium",
    badgeCls:  "bg-amber-100 text-amber-800 border-amber-200",
    iconCls:   "bg-amber-100 text-amber-700",
    borderCls: "border-l-amber-400",
    dotCls:    "bg-amber-400",
  },
  low: {
    label:     "Low",
    badgeCls:  "bg-blue-100 text-blue-800 border-blue-200",
    iconCls:   "bg-blue-100 text-blue-700",
    borderCls: "border-l-blue-400",
    dotCls:    "bg-blue-400",
  },
};

export const CATEGORY_META_ALERTS: Record<AlertCategory, { label: string; emoji: string }> = {
  compliance: { label: "Compliance", emoji: "📋" },
  ap:         { label: "Payables",   emoji: "📤" },
  ar:         { label: "Receivables",emoji: "📥" },
  tasks:      { label: "Tasks",      emoji: "✅" },
  banking:    { label: "Banking",    emoji: "🏦" },
};
