/**
 * Phone Audit — Module added 2026-06-03 after the wrong-message incident.
 *
 * Lists every customer who has a phone number on file and lets the operator
 * mark each as "verified ✓" or correct/clear if wrong. Until a customer is
 * verified, they are EXCLUDED from bulk WhatsApp sends — even when the
 * bulk-send kill switch is lifted.
 *
 * This is the human-in-the-loop checkpoint that prevents another SRMC-
 * style mismapping from going out to customers.
 */

import { Header } from "@/components/layout/header";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { listOverdueCustomers } from "@/app/actions/reminders";
import { getPhoneAudit } from "@/app/actions/phone-audit";
import { PhoneAuditTable } from "@/components/reminders/phone-audit-table";

export const dynamic = "force-dynamic";

export default async function PhoneAuditPage() {
  const { profile } = await requireAuth();
  if (!["ceo", "cfo", "accounts"].includes(profile.role)) redirect("/dashboard");

  const { customers, companyId } = await listOverdueCustomers();
  if (!companyId) {
    // Tell the user to pick a company first
    return (
      <>
        <Header
          title="Phone Audit"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminders", href: "/dashboard/reminders" }, { label: "Phone Audit" }]}
          showImport={false}
        />
        <main className="p-6">
          <p className="text-sm text-brand-gray-mid">
            Switch to a specific company in the sidebar to audit its customer phones.
            &quot;All Companies&quot; view does not support per-company phone audits.
          </p>
        </main>
      </>
    );
  }

  const audit = await getPhoneAudit();

  // Build the audit-table rows: every customer who has a phone, with their
  // verification state attached. Outstanding amount is shown so the operator
  // can spot suspiciously large/small amounts at a glance.
  const rows = customers
    .filter((c) => c.phone && String(c.phone).trim().length > 0)
    .map((c) => {
      const v = audit.verified[c.id];
      const verifiedMatches = v && v.phone === String(c.phone).trim();
      return {
        id:           c.id,
        name:         c.name,
        phone:        c.phone || "",
        outstanding:  c.outstanding,
        daysOverdue:  c.daysOverdue,
        verifiedAt:   verifiedMatches ? v.verified_at : null,
        verifiedPhone: verifiedMatches ? v.phone : null,
      };
    });

  // Customers with phone whose verification record points to an OLD phone:
  // include them but flag them as "phone changed since verification".
  const stale = customers
    .filter((c) => c.phone && audit.verified[c.id] && audit.verified[c.id].phone !== String(c.phone).trim())
    .length;

  return (
    <>
      <Header
        title="Phone Audit"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminders", href: "/dashboard/reminders" }, { label: "Phone Audit" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-5 max-w-5xl">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <h2 className="text-sm font-bold text-red-900">🚨 Why this exists</h2>
          <p className="text-xs text-red-800 mt-1.5 leading-relaxed">
            On <strong>2026-06-03</strong> a WhatsApp reminder addressed to &quot;Ashish Sachdev&quot;
            was delivered to SRMC&apos;s WhatsApp number — because that phone was incorrectly
            attached to Ashish Sachdev&apos;s customer record. Until every phone on this list
            is human-verified, the &quot;Send All&quot; button stays locked. Verify each row, fix
            wrong ones, then ask the CEO to lift the kill switch in Admin &rarr; Notification Settings.
          </p>
        </div>

        {stale > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <strong>{stale} customer{stale === 1 ? "" : "s"}</strong> had their phone changed since last verification.
            They are shown as unverified below and need a fresh review.
          </div>
        )}

        <PhoneAuditTable rows={rows} />
      </main>
    </>
  );
}
