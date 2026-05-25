/**
 * GlobalAlerts — server-rendered banner strip shown above every dashboard
 * page so important warnings (e.g. customers excluded from WhatsApp
 * reminders due to missing phone) are visible to the user on every screen,
 * regardless of role.
 *
 * Currently surfaces:
 *   - Missing-phone-number warning for AR customers in the selected company
 *
 * The CompanySwitcher controls which company's data is shown.
 */

import { listOverdueCustomers } from "@/app/actions/reminders";
import { fmtAmt } from "@/lib/payables-data";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export async function GlobalAlerts() {
  // listOverdueCustomers returns {} when no company is selected — graceful no-op.
  let missing: Awaited<ReturnType<typeof listOverdueCustomers>>["customers"] = [];
  try {
    const { customers } = await listOverdueCustomers();
    missing = customers.filter((c) => !c.phone);
  } catch {
    return null;
  }

  if (missing.length === 0) return null;

  const totalOutstanding = missing.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-2.5">
      <div className="flex items-start gap-3 max-w-7xl mx-auto">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-amber-900 leading-snug">
          <strong>{missing.length} customer{missing.length === 1 ? "" : "s"} excluded from WhatsApp reminders</strong>
          {" — "}
          <strong>{fmtAmt(totalOutstanding)}</strong> outstanding has no phone number on file.
          {" "}
          <Link href="/dashboard/reminders" className="underline font-semibold hover:text-amber-700">
            Fix inline →
          </Link>
          {" "}or{" "}
          <Link href="/dashboard/contacts" className="underline font-semibold hover:text-amber-700">
            bulk-import contacts →
          </Link>
        </div>
      </div>
    </div>
  );
}
