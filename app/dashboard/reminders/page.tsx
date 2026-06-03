/**
 * AR Reminder Center — Module 12
 *
 * Lists overdue customers for the selected company, lets the user (CEO /
 * CFO / Accounts) edit their phone and email inline, and send WhatsApp
 * payment reminders. Bulk-select supported.
 *
 * For "All Companies" view this page directs the user to pick a single
 * company first (we don't want to send mixed-template messages).
 */

import { Header } from "@/components/layout/header";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { listOverdueCustomers } from "@/app/actions/reminders";
import { getNotificationSettings } from "@/app/actions/notification-settings";
import { isWhatsAppLive } from "@/lib/whatsapp";
import { ReminderCenter } from "@/components/reminders/reminder-center";
import { createClient } from "@/lib/supabase/server";
import { AlertCircle, MessageSquare } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const { profile } = await requireAuth();
  if (!["ceo", "cfo", "accounts"].includes(profile.role)) redirect("/dashboard");

  const { customers, companyId, cooldownDays } = await listOverdueCustomers();
  const settings = await getNotificationSettings();
  // Centralised check — handles every supported provider (meta/twilio/maytapi).
  const waEnabled = isWhatsAppLive(settings.whatsapp);

  // Resolve the company display name for the message template preview
  let companyName = "Your Company";
  if (companyId) {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("companies").select("name").eq("id", companyId).maybeSingle();
    if (data?.name) companyName = data.name;
  }

  return (
    <>
      <Header
        title="Send AR Reminders"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminders" }]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-5 max-w-6xl">
        {/* WhatsApp status banner */}
        {!waEnabled && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800">
              <strong>WhatsApp is not configured.</strong> Reminders will be drafted but not sent.
              {" "}
              <Link href="/dashboard/admin/settings" className="underline font-semibold hover:text-amber-900">
                Set up WhatsApp credentials →
              </Link>
              {" "}
              (CEO only)
            </div>
          </div>
        )}

        {waEnabled && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-green-800">
              <strong>WhatsApp is live.</strong> Provider: <code className="font-mono">{settings.whatsapp.provider}</code>.
              Reminders will be sent to customers with a phone number on file.
              Reminder schedule is configured in
              {" "}
              <Link href="/dashboard/admin/settings" className="underline font-semibold">
                Notification Settings
              </Link>.
            </div>
          </div>
        )}

        {!companyId ? (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-brand-black">Pick a company first</p>
            <p className="text-xs text-brand-gray-mid">
              Reminders are scoped per company so the message template matches
              the entity that issued the invoice. Use the sidebar switcher to
              select a specific company (not "All Companies").
            </p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center">
            <p className="text-sm font-semibold text-brand-black">No outstanding receivables.</p>
            <p className="text-xs text-brand-gray-mid mt-1">
              All customer balances net to zero. Nothing to chase.
            </p>
          </div>
        ) : (
          <ReminderCenter
            customers={customers}
            waEnabled={waEnabled}
            template={settings.templates.ar_reminder}
            cooldownDays={cooldownDays}
            companyName={companyName}
          />
        )}
      </main>
    </>
  );
}
