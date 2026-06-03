/**
 * Sales OS — Calendar of follow-ups (month view).
 */
import { Header } from "@/components/layout/header";
import { getFollowups } from "@/lib/crm/queries";
import { CalendarView, type CalItem } from "@/components/crm/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const followups = await getFollowups();
  const items: CalItem[] = followups
    .filter((f) => f.due_at)
    .map((f) => ({
      id: f.id,
      subject: f.subject,
      due_at: f.due_at as string,
      type: f.type,
      done: f.done,
      context_label: f.context_label,
      context_href: f.context_href,
    }));

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <>
      <Header
        title="Calendar"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Calendar" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <CalendarView items={items} initialYear={now.getFullYear()} initialMonth={now.getMonth()} todayKey={todayKey} />
      </main>
    </>
  );
}
