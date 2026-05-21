import { Skeleton } from "@/components/ui/skeleton";

export default function ComplianceDetailLoading() {
  return (
    <div className="flex-1 p-6 max-w-3xl space-y-5">
      <Skeleton className="h-4 w-48" />
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-12" />)}
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
