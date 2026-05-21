import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="flex-1 p-6 space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-border p-5">
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
