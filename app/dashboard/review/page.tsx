/**
 * Review Engine — Module 7
 *
 * Server component shell. Renders the ReviewContent client component
 * which handles period switching (Weekly / Monthly / Quarterly) + PDF export.
 *
 * RULE 1: Every metric is clickable — drills to source module
 * RULE 5: Indian number format throughout
 */

import { Header } from "@/components/layout/header";
import { ReviewContent } from "@/components/review/review-content";

export default function ReviewPage() {
  return (
    <>
      <Header
        title="Review Engine"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Review Engine" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-6xl">
        <ReviewContent />
      </main>
    </>
  );
}
