/**
 * NBD — Import leads from a Google Sheet / CSV / Excel export.
 * Upload or paste, auto-map columns to NBD fields, preview, import.
 */
import { Header } from "@/components/layout/header";
import { LeadImport } from "@/components/crm/lead-import";

export const dynamic = "force-dynamic";

export default function ImportLeadsPage() {
  return (
    <>
      <Header
        title="Import Leads"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Leads", href: "/dashboard/sales-os/leads" },
          { label: "Import" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <LeadImport />
      </main>
    </>
  );
}
