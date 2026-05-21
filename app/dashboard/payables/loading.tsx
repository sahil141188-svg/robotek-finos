export default function PayablesLoading() {
  return (
    <main className="flex-1 p-6 space-y-6 max-w-6xl animate-pulse">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-24" />
        ))}
      </div>
      {/* Aging bars */}
      <div className="bg-white rounded-xl border border-border p-5 space-y-3">
        <div className="h-4 bg-brand-gray-light rounded w-48" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-24 bg-brand-gray-light rounded" />
            <div className="flex-1 h-2.5 bg-brand-gray-light rounded-full" />
            <div className="h-3 w-16 bg-brand-gray-light rounded" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-brand-gray-light border-b border-border" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 border-b border-border px-4 flex items-center gap-4">
            <div className="h-3 w-32 bg-brand-gray-light rounded" />
            <div className="h-3 w-20 bg-brand-gray-light rounded" />
            <div className="ml-auto h-3 w-16 bg-brand-gray-light rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
