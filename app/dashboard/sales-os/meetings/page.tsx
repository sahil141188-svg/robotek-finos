/**
 * Sales OS — Meetings with Sales Expert / FSR (physical / Zoom / phone).
 */
import { Header } from "@/components/layout/header";
import { requireAuth } from "@/lib/auth";
import { getMeetings } from "@/lib/crm/meetings";
import { MeetingsClient } from "@/components/crm/meetings-client";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const { profile } = await requireAuth();
  const meetings = await getMeetings();
  return (
    <>
      <Header
        title="Meetings"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Meetings" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-4xl">
        <MeetingsClient meetings={meetings} currentUserId={profile.id} />
      </main>
    </>
  );
}
