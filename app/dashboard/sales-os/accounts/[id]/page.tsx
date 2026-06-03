/**
 * Sales OS — Account detail.
 * Full view of a customer account: profile, contacts, deals, and
 * activity timeline. Add contacts and log activities inline.
 */
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getAccountDetail, getSalesTeam } from "@/lib/crm/queries";
import { AccountDetailView } from "@/components/crm/account-detail";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, sales] = await Promise.all([getAccountDetail(id), getSalesTeam()]);
  if (!detail) notFound();

  return (
    <>
      <Header
        title={detail.account.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Accounts", href: "/dashboard/sales-os/accounts" },
          { label: detail.account.name },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <AccountDetailView detail={detail} sales={sales} />
      </main>
    </>
  );
}
