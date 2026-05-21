import { Skeleton } from "@/components/ui/skeleton";

export default function TaskDetailLoading() {
  return (
    <div className="flex-1 p-6 max-w-3xl space-y-5">
      <Skeleton className="h-4 w-24" />
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
