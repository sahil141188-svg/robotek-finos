import { Skeleton } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <div className="flex-1 p-6 space-y-6 max-w-6xl">
      {/* Health bar skeleton */}
      <div className="bg-white rounded-xl border border-border p-4">
        <Skeleton className="h-14 w-full" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
      </div>
      {/* List sections */}
      <div className="space-y-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-border p-4 space-y-3">
            <Skeleton className="h-6 w-32" />
            {[0,1,2].map(j => <Skeleton key={j} className="h-12 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
