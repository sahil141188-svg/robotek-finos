import { requireAuth }         from "@/lib/auth";
import { Header }              from "@/components/layout/header";
import { IntelHub }            from "@/components/intel/intel-hub";
import { getIntelligenceReport } from "@/app/actions/ai-insights";

/**
 * Intelligence Hub — Owner's AI-powered command centre.
 * Shows health score, anomalies, duplicates, fraud signals, GST issues,
 * cashflow forecast, vendor risk, and the CFO morning briefing.
 */
export default async function IntelPage() {
  await requireAuth();
  const report = await getIntelligenceReport();

  return (
    <>
      <Header
        title="Intelligence Hub"
        breadcrumbs={[
          { label: "Dashboard",        href: "/dashboard" },
          { label: "Intelligence Hub" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-4 sm:p-6">
        <IntelHub report={report} />
      </main>
    </>
  );
}
