import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <div className="h-16 border-b border-border bg-white px-6 flex items-center">
        <Skeleton className="h-6 w-48" />
      </div>
      <main className="flex-1 p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </main>
    </>
  );
}
