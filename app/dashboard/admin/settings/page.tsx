import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { NotificationSettings } from "@/components/admin/notification-settings";

/**
 * Notification & Reminder Settings — Admin (CEO only).
 * Configure SMTP email, WhatsApp API, and reminder schedules.
 */
export default async function AdminSettingsPage() {
  const { profile } = await requireAuth();
  if (profile.role !== "ceo") redirect("/dashboard");

  return (
    <>
      <Header
        title="Notification Settings"
        breadcrumbs={[
          { label: "Admin",         href: "/dashboard/admin" },
          { label: "Notification Settings" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-4 sm:p-6 max-w-3xl">
        <NotificationSettings />
      </main>
    </>
  );
}
