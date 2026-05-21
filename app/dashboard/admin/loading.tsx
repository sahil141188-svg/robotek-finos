import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <>
      <div className="h-16 border-b border-border bg-white px-6 flex items-center">
        <Skeleton className="h-6 w-36" />
      </div>
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </main>
    </>
  );
}
