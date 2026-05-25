/**
 * Contacts — central directory of every customer + vendor for the selected
 * company, with bulk-import from spreadsheet and inline edit.
 *
 * RULE 3 (Import everywhere): bulk-update via CSV/XLSX. Map by firm name
 * (case-insensitive) or GSTIN, preview changes, commit.
 */

import { Header } from "@/components/layout/header";
import { requireAuth } from "@/lib/auth";
import { listAllContacts } from "@/app/actions/contacts-import";
import { ContactsManager } from "@/components/contacts/contacts-manager";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const { profile } = await requireAuth();
  if (!["ceo", "cfo", "accounts", "coo"].includes(profile.role)) redirect("/dashboard");

  const { contacts, companyId } = await listAllContacts();

  return (
    <>
      <Header
        title="Contacts"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Contacts" }]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-5 max-w-6xl">
        {!companyId ? (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-brand-gray-mid mx-auto" />
            <p className="text-sm font-semibold text-brand-black">Pick a company first</p>
            <p className="text-xs text-brand-gray-mid">
              Contacts are scoped per company. Use the sidebar switcher to
              select a specific company (not &quot;All Companies&quot;).
            </p>
          </div>
        ) : (
          <ContactsManager contacts={contacts} />
        )}
      </main>
    </>
  );
}
