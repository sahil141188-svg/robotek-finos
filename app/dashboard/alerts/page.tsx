import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Bell, AlertTriangle, Info, CheckCircle } from "lucide-react";

const SAMPLE_ALERTS = [
  {
    type: "warning",
    title: "TDS Deposit Due in 3 Days",
    body: "TDS for May salaries (₹2,84,000) must be deposited by 7 June 2025.",
    time: "2 hours ago",
  },
  {
    type: "error",
    title: "Vendor Payment Overdue — Anand Cables",
    body: "₹8,30,000 outstanding for 67 days. Payment terms were 30 days.",
    time: "1 day ago",
  },
  {
    type: "info",
    title: "GSTR-1 Due in 7 Days",
    body: "Monthly GSTR-1 for May 2025 is due on 11 June 2025.",
    time: "1 day ago",
  },
  {
    type: "success",
    title: "GSTR-3B Filed — April 2025",
    body: "GSTR-3B for April 2025 was filed successfully. Tax paid: ₹4,12,500.",
    time: "3 days ago",
  },
  {
    type: "warning",
    title: "Customer Collection Overdue — Croma",
    body: "₹11,20,000 receivable from Croma is 78 days overdue. DSO target: 30 days.",
    time: "5 days ago",
  },
];

const ICON_MAP = {
  warning: { icon: AlertTriangle, cls: "text-amber-600 bg-amber-50" },
  error:   { icon: AlertTriangle, cls: "text-red-600 bg-red-50" },
  info:    { icon: Info,          cls: "text-blue-600 bg-blue-50" },
  success: { icon: CheckCircle,   cls: "text-green-600 bg-green-50" },
};

export default async function AlertsPage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Alerts"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Alerts" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <Bell className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Smart Alerts & Notifications — coming on Day 12</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Real-time in-app alerts + optional WhatsApp notifications. Compliance reminders at
              14 · 7 · 3 · 1 day before due. Automatic escalation if not actioned within 24 hours.
            </p>
          </div>
        </div>

        {/* Alert feed */}
        <div className="space-y-3">
          {SAMPLE_ALERTS.map(({ type, title, body, time }) => {
            const { icon: Icon, cls } = ICON_MAP[type as keyof typeof ICON_MAP];
            return (
              <div key={title} className="rounded-xl border border-border bg-white p-4 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-black">{title}</p>
                  <p className="text-xs text-brand-gray-mid mt-0.5">{body}</p>
                </div>
                <span className="text-xs text-brand-gray-mid whitespace-nowrap">{time}</span>
              </div>
            );
          })}
        </div>

      </main>
    </>
  );
}
