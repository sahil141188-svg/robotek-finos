export default function ConsolidatedLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 max-w-6xl space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-brand-gray-light rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-brand-gray-light border-b border-border" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-12 border-b border-border px-4 flex items-center gap-4">
            <div className="h-7 w-7 bg-brand-gray-light rounded-lg shrink-0" />
            <div className="h-3 w-32 bg-brand-gray-light rounded" />
            <div className="ml-auto flex gap-6">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-3 w-16 bg-brand-gray-light rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-40" />
        ))}
      </div>
    </main>
  );
}
