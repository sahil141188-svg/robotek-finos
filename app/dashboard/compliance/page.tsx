import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { CalendarCheck, Clock } from "lucide-react";

const UPCOMING_DEADLINES = [
  { label: "GSTR-3B",        date: "20 Jun 2025", days: 30, color: "bg-green-50 text-green-700 border-green-200" },
  { label: "GSTR-1",         date: "11 Jun 2025", days: 21, color: "bg-green-50 text-green-700 border-green-200" },
  { label: "TDS Deposit",    date: "7 Jun 2025",  days: 17, color: "bg-brand-yellow/20 text-amber-700 border-amber-200" },
  { label: "PF / ESI",       date: "15 Jun 2025", days: 25, color: "bg-green-50 text-green-700 border-green-200" },
  { label: "Advance Tax Q1", date: "15 Jun 2025", days: 25, color: "bg-green-50 text-green-700 border-green-200" },
  { label: "TCS Deposit",    date: "7 Jun 2025",  days: 17, color: "bg-brand-yellow/20 text-amber-700 border-amber-200" },
];

export default async function CompliancePage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Compliance Calendar"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Compliance Calendar" }]}
        showImport={true}
        importModule="compliance"
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <CalendarCheck className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Full Compliance Calendar — coming on Day 4–5</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Auto-loaded with GST, TDS, TCS, PF/ESI, Advance Tax, ROC and Income Tax deadlines.
              Color-coded: Green = filed · Yellow = due within 7 days · Red = overdue.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-brand-black mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-red" /> Upcoming Deadlines (preview)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {UPCOMING_DEADLINES.map(({ label, date, days, color }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs mt-1 opacity-80">Due: {date}</p>
                <p className="text-xs opacity-70">{days} days away</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
