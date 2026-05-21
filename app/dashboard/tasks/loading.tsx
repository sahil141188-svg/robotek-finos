import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="flex-1 p-6 space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="flex gap-2">
        {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
      </div>
      <div className="space-y-3">
        {[0,1,2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-border">
            <Skeleton className="h-12 w-full rounded-t-xl" />
            {[0,1,2].map(j => <Skeleton key={j} className="h-14 w-full mt-px" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
