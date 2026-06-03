/**
 * Sales OS — Email channel: compose + send (Resend) and manage templates.
 */
import { Header } from "@/components/layout/header";
import { getEmailTemplates } from "@/lib/crm/email";
import { getLeads } from "@/lib/crm/queries";
import { EmailClient } from "@/components/crm/email-client";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const [templates, leads] = await Promise.all([getEmailTemplates(), getLeads()]);
  return (
    <>
      <Header
        title="Email"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Email" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-3xl">
        <EmailClient
          templates={templates}
          leads={leads.map((l) => ({ id: l.id, name: l.name, email: l.email, company: l.company }))}
        />
      </main>
    </>
  );
}
