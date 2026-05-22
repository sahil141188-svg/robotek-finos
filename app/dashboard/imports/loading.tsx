export default function Loading() {
  return (
    <div className="flex-1 p-6 space-y-5 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-4 space-y-2 animate-pulse">
            <div className="h-3 bg-brand-gray-light rounded w-1/2" />
            <div className="h-7 bg-brand-gray-light rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 animate-pulse">
            <div className="h-4 bg-brand-gray-light rounded w-48" />
            <div className="h-4 bg-brand-gray-light rounded w-24" />
            <div className="h-4 bg-brand-gray-light rounded w-32 hidden sm:block" />
            <div className="ml-auto h-5 bg-brand-gray-light rounded-full w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
